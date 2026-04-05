const state = {
  refreshTimer: null,
  historyKey: "fatturavault-icp-monitor-history"
};

const nodes = {
  projectName: document.getElementById("projectName"),
  updatedAt: document.getElementById("updatedAt"),
  identityName: document.getElementById("identityName"),
  defaultIdentity: document.getElementById("defaultIdentity"),
  icpBalance: document.getElementById("icpBalance"),
  cyclesBalance: document.getElementById("cyclesBalance"),
  cliVersion: document.getElementById("cliVersion"),
  principal: document.getElementById("principal"),
  fundingAccount: document.getElementById("fundingAccount"),
  ledgerAccount: document.getElementById("ledgerAccount"),
  alerts: document.getElementById("alerts"),
  checklist: document.getElementById("checklist"),
  history: document.getElementById("history"),
  canisters: document.getElementById("canisters"),
  errors: document.getElementById("errors"),
  commands: document.getElementById("commands"),
  refreshButton: document.getElementById("refreshButton")
};

function relativeDate(isoString) {
  const date = new Date(isoString);
  return `Aggiornato ${date.toLocaleString("it-IT")}`;
}

function parseNumber(raw) {
  if (!raw) return NaN;
  return Number(String(raw).replace(/[^\d.]/g, ""));
}

function readHistory() {
  try {
    const raw = window.localStorage.getItem(state.historyKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistoryEntry(data) {
  try {
    const history = readHistory();
    const entry = {
      at: data.generatedAt,
      icpBalance: data.identity.icpBalance,
      cyclesBalance: data.identity.cyclesBalance,
      frontendCycles: data.canisters.find((item) => item.name === "Frontend")?.parsed?.cycles ?? "N/D",
      backendCycles: data.canisters.find((item) => item.name === "Backend")?.parsed?.cycles ?? "N/D"
    };

    const next = [entry, ...history]
      .filter((item, index, array) => index === array.findIndex((other) => other.at === item.at))
      .slice(0, 10);

    window.localStorage.setItem(state.historyKey, JSON.stringify(next));
  } catch {
    // niente: se localStorage non va, la dashboard continua a funzionare
  }
}

function commandMarkup(data) {
  const identity = data.identity.selected;
  const frontend = data.canisters.find((item) => item.name === "Frontend")?.id ?? "CANISTER_ID";
  const backend = data.canisters.find((item) => item.name === "Backend")?.id ?? "CANISTER_ID";

  const commands = [
    {
      label: "Saldo ICP",
      value: `icp token balance -n ic --identity ${identity}`
    },
    {
      label: "Saldo cycles",
      value: `icp cycles balance -n ic --identity ${identity}`
    },
    {
      label: "Status frontend",
      value: `icp canister status ${frontend} -n ic --identity ${identity}`
    },
    {
      label: "Status backend",
      value: `icp canister status ${backend} -n ic --identity ${identity}`
    },
    {
      label: "Mint cycles",
      value: `icp cycles mint --icp 0.5 -n ic --identity ${identity}`
    },
    {
      label: "Top-up frontend",
      value: `icp canister top-up ${frontend} --amount 500b -n ic --identity ${identity}`
    }
  ];

  nodes.commands.innerHTML = commands
    .map(
      (command) => `
        <div class="command-card">
          <p>${command.label}</p>
          <code>${command.value}</code>
        </div>
      `
    )
    .join("");
}

function renderAlerts(data) {
  const thresholds = data.config.thresholds || {};
  const alerts = [];
  const icpValue = parseNumber(data.identity.icpBalance);
  const cyclesValue = parseNumber(data.identity.cyclesBalance);

  if (!Number.isNaN(icpValue)) {
    if (icpValue <= (thresholds.identityIcpCritical ?? 0.5)) {
      alerts.push({
        level: "critical",
        title: "Saldo ICP critico",
        body: `L'identita' ha solo ${data.identity.icpBalance}. Meglio ricaricare presto o non potrai mintare nuovi cycles.`
      });
    } else if (icpValue <= (thresholds.identityIcpWarning ?? 1)) {
      alerts.push({
        level: "warning",
        title: "Saldo ICP da monitorare",
        body: `L'identita' ha ${data.identity.icpBalance}. Conviene pianificare un nuovo finanziamento.`
      });
    }
  }

  if (!Number.isNaN(cyclesValue)) {
    if (cyclesValue <= (thresholds.identityCyclesCritical ?? 200_000_000_000)) {
      alerts.push({
        level: "critical",
        title: "Cycles identita' bassi",
        body: `Hai ${data.identity.cyclesBalance} disponibili sull'identita'. Prima di fare top-up o deploy, meglio mintare nuovi cycles.`
      });
    } else if (cyclesValue <= (thresholds.identityCyclesWarning ?? 500_000_000_000)) {
      alerts.push({
        level: "warning",
        title: "Cycles identita' in diminuzione",
        body: `Il saldo attuale e' ${data.identity.cyclesBalance}. Non e' urgente, ma vale la pena tenerlo d'occhio.`
      });
    }
  }

  for (const canister of data.canisters) {
    const canisterCycles = parseNumber(canister.parsed?.cycles);
    if (!Number.isNaN(canisterCycles)) {
      if (canisterCycles <= (thresholds.canisterCyclesCritical ?? 200_000_000_000)) {
        alerts.push({
          level: "critical",
          title: `${canister.name}: cycles critici`,
          body: `${canister.name} ha ${canister.parsed.cycles}. Meglio fare top-up appena possibile.`
        });
      } else if (canisterCycles <= (thresholds.canisterCyclesWarning ?? 500_000_000_000)) {
        alerts.push({
          level: "warning",
          title: `${canister.name}: soglia da monitorare`,
          body: `${canister.name} ha ${canister.parsed.cycles}. Non e' urgente, ma conviene programmare un controllo.`
        });
      }
    }
  }

  if (!alerts.length) {
    alerts.push({
      level: "ok",
      title: "Situazione sana",
      body: "Saldo ICP, cycles e canister sono sopra le soglie impostate nel monitor."
    });
  }

  nodes.alerts.innerHTML = alerts
    .map(
      (alert) => `
        <div class="alert-item alert-${alert.level}">
          <strong>${alert.title}</strong>
          <div>${alert.body}</div>
        </div>
      `
    )
    .join("");
}

function renderChecklist(data) {
  const identity = data.identity.selected;
  const frontend = data.canisters.find((item) => item.name === "Frontend")?.id ?? "CANISTER_ID";
  const checks = [
    {
      title: "Backup chiave",
      body: "Controlla di avere una copia cifrata del PEM e la password salvata nel password manager."
    },
    {
      title: "Controllo saldo",
      body: `Verifica ogni tanto \`icp token balance -n ic --identity ${identity}\` e \`icp cycles balance -n ic --identity ${identity}\`.`
    },
    {
      title: "Top-up frontend",
      body: `Se il frontend scende troppo, usa \`icp canister top-up ${frontend} --amount 500b -n ic --identity ${identity}\`.`
    }
  ];

  nodes.checklist.innerHTML = checks
    .map(
      (item) => `
        <div class="check-item">
          <strong>${item.title}</strong>
          <div>${item.body}</div>
        </div>
      `
    )
    .join("");
}

function renderCanisters(canisters) {
  nodes.canisters.innerHTML = canisters
    .map((canister) => {
      const status = canister.parsed?.status ?? "Errore";
      const statusClass =
        status === "Running" ? "status-running" : status === "Stopped" ? "status-stopped" : "status-error";

      return `
        <article class="canister-card">
          <div class="canister-top">
            <div>
              <p class="eyebrow">${canister.role}</p>
              <h3>${canister.name}</h3>
              <p class="subtle">${canister.id}</p>
            </div>
            <span class="status-chip ${statusClass}">${status}</span>
          </div>
          <div class="canister-meta">
            <div><span>Cycles</span><strong>${canister.parsed?.cycles ?? "N/D"}</strong></div>
            <div><span>Memoria</span><strong>${canister.parsed?.memorySize ?? "N/D"}</strong></div>
            <div><span>Consumo idle/giorno</span><strong>${canister.parsed?.idleBurnedPerDay ?? "N/D"}</strong></div>
            <div><span>Controller</span><strong>${canister.parsed?.controllers ?? "N/D"}</strong></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderHistory() {
  const history = readHistory();
  if (!history.length) {
    nodes.history.innerHTML = `<div class="subtle">Lo storico locale comparira' dai prossimi aggiornamenti della dashboard.</div>`;
    return;
  }

  nodes.history.innerHTML = history
    .map(
      (entry) => `
        <div class="history-row">
          <div>
            <strong>${new Date(entry.at).toLocaleDateString("it-IT")}</strong>
            <span class="subtle">${new Date(entry.at).toLocaleTimeString("it-IT")}</span>
          </div>
          <div>
            <strong>ICP: ${entry.icpBalance}</strong>
            <span class="subtle">Cycles identita': ${entry.cyclesBalance}</span>
          </div>
          <div>
            <strong>Frontend: ${entry.frontendCycles}</strong>
            <span class="subtle">Backend: ${entry.backendCycles}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function renderErrors(canisters) {
  const problemCanisters = canisters.filter((item) => !item.ok);
  if (!problemCanisters.length) {
    nodes.errors.innerHTML = `<div class="subtle">Nessun errore segnalato. I comandi ICP stanno rispondendo correttamente.</div>`;
    return;
  }

  nodes.errors.innerHTML = problemCanisters
    .map(
      (item) => `
        <div class="error-item">
          <strong>${item.name}</strong>
          <div>${item.raw}</div>
        </div>
      `
    )
    .join("");
}

function render(data) {
  nodes.projectName.textContent = data.config.projectName;
  nodes.updatedAt.textContent = relativeDate(data.generatedAt);
  nodes.identityName.textContent = data.identity.selected;
  nodes.defaultIdentity.textContent = `Default locale: ${data.identity.default}`;
  nodes.icpBalance.textContent = data.identity.icpBalance;
  nodes.cyclesBalance.textContent = data.identity.cyclesBalance;
  nodes.cliVersion.textContent = data.cliVersion;
  nodes.principal.textContent = data.identity.principal;
  nodes.fundingAccount.textContent = data.identity.fundingAccount;
  nodes.ledgerAccount.textContent = data.identity.ledgerAccount;

  renderAlerts(data);
  renderChecklist(data);
  commandMarkup(data);
  renderCanisters(data.canisters);
  saveHistoryEntry(data);
  renderHistory();
  renderErrors(data.canisters);
}

async function refresh() {
  nodes.refreshButton.disabled = true;
  nodes.refreshButton.textContent = "Aggiornamento...";

  try {
    const response = await fetch(`/api/status?ts=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    render(data);
  } catch (error) {
    nodes.errors.innerHTML = `
      <div class="error-item">
        <strong>Dashboard non aggiornata</strong>
        <div>${error.message}</div>
      </div>
    `;
  } finally {
    nodes.refreshButton.disabled = false;
    nodes.refreshButton.textContent = "Aggiorna ora";
  }
}

nodes.refreshButton.addEventListener("click", refresh);

refresh();
state.refreshTimer = window.setInterval(refresh, 30000);
