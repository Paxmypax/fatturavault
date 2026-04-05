import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const configPath = path.join(__dirname, "config.local.json");

async function loadConfig() {
  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw);
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function runIcp(args) {
  try {
    const command = `& icp ${args.map(psQuote).join(" ")}`;
    const { stdout, stderr } = await execFileAsync("powershell", ["-NoProfile", "-Command", command], {
      cwd: __dirname,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });

    return {
      ok: true,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    };
  } catch (error) {
    return {
      ok: false,
      stdout: (error.stdout || "").trim(),
      stderr: (error.stderr || error.message || "").trim()
    };
  }
}

function parseBalance(raw, suffix) {
  const match = raw.match(/Balance:\s*(.+?)\s*$/m);
  if (!match) return raw || "N/D";
  if (suffix && !match[1].includes(suffix)) return `${match[1]} ${suffix}`;
  return match[1];
}

function parseCanisterStatus(raw) {
  const pick = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escaped}:\\s*(.+)`, "m");
    return raw.match(regex)?.[1]?.trim() ?? "N/D";
  };

  return {
    status: pick("Status"),
    controllers: pick("Controllers"),
    memorySize: pick("Memory size"),
    cycles: pick("Cycles"),
    idleBurnedPerDay: pick("Idle cycles burned per day"),
    moduleHash: pick("Module hash")
  };
}

async function collectStatus() {
  const config = await loadConfig();
  const common = ["-n", config.network, "--identity", config.identity];

  const [
    version,
    principal,
    accountId,
    icpBalance,
    cyclesBalance,
    defaultIdentity,
    canisterResults
  ] = await Promise.all([
    runIcp(["--version"]),
    runIcp(["identity", "principal", "--identity", config.identity]),
    runIcp(["identity", "account-id", "--identity", config.identity]),
    runIcp(["token", "balance", ...common]),
    runIcp(["cycles", "balance", ...common]),
    runIcp(["identity", "default"]),
    Promise.all(
      config.canisters.map(async (canister) => {
        const result = await runIcp(["canister", "status", canister.id, ...common]);
        return {
          ...canister,
          ok: result.ok,
          raw: result.stdout || result.stderr,
          parsed: result.ok ? parseCanisterStatus(result.stdout) : null
        };
      })
    )
  ]);

  return {
    generatedAt: new Date().toISOString(),
    config,
    cliVersion: version.stdout || version.stderr,
    identity: {
      selected: config.identity,
      default: defaultIdentity.stdout || "N/D",
      principal: principal.stdout || principal.stderr,
      fundingAccount: config.fundingAccount || accountId.stdout || accountId.stderr,
      ledgerAccount: accountId.stdout || accountId.stderr,
      icpBalance: parseBalance(icpBalance.stdout || icpBalance.stderr, "ICP"),
      cyclesBalance: parseBalance(cyclesBalance.stdout || cyclesBalance.stderr, "cycles")
    },
    canisters: canisterResults
  };
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "text/plain; charset=utf-8";
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

  if (requestUrl.pathname === "/api/status") {
    try {
      const data = await collectStatus();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(data, null, 2));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify(
          {
            error: "Impossibile leggere lo stato ICP",
            detail: error.message
          },
          null,
          2
        )
      );
    }
    return;
  }

  let filePath = path.join(publicDir, requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname);
  if (!existsSync(filePath)) {
    filePath = path.join(publicDir, "index.html");
  }

  res.writeHead(200, { "Content-Type": contentType(filePath) });
  createReadStream(filePath).pipe(res);
});

loadConfig()
  .then((config) => {
    server.listen(config.port, "127.0.0.1", () => {
      console.log(`ICP monitor disponibile su http://127.0.0.1:${config.port}`);
    });
  })
  .catch((error) => {
    console.error("Errore caricando config.local.json:", error);
    process.exit(1);
  });
