<svelte:head>
  <title>Termini di Servizio | Fattura Vault</title>
  <meta
    name="description"
    content="Termini di servizio di Fattura Vault: uso della beta, limiti del servizio, responsabilità e regole generali."
  />
</svelte:head>

<script lang="ts">
  const sections = [
    {
      title: '1. Natura del servizio',
      body: [
        "Fattura Vault è un'applicazione per archiviazione, organizzazione e consultazione di documenti personali e professionali. Alla data attuale il servizio deve essere considerato in fase beta evolutiva.",
        "Questo significa che funzioni, interfacce, limiti tecnici e componenti AI possono cambiare nel tempo."
      ]
    },
    {
      title: '2. Accesso al servizio',
      body: [
        "L'accesso avviene tramite Internet Identity. L'utente è responsabile della custodia dei propri metodi di accesso, dispositivi autorizzati e strumenti di recupero.",
        "La perdita dell'accesso a Internet Identity può compromettere l'accesso al proprio archivio."
      ]
    },
    {
      title: '3. Uso consentito',
      body: [
        "L'utente si impegna a usare Fattura Vault in modo lecito, corretto e compatibile con la normativa applicabile.",
        "Non è consentito usare il servizio per caricamento di contenuti illeciti, dannosi, fraudolenti, abusivi o in violazione di diritti altrui."
      ]
    },
    {
      title: '4. Limiti tecnici',
      body: [
        "Il servizio applica limiti operativi per garantire stabilità e sostenibilità. Alla data attuale: massimo 5 MB per file, Inbox temporanea fino a 500 MB per utente, Vault personale fino a 5 GB e chat AI del vault fino a 20 domande al giorno.",
        "Questi limiti possono cambiare nel tempo."
      ]
    },
    {
      title: '5. Funzioni AI',
      body: [
        "Le funzioni AI hanno natura assistiva. Il prefill documenti con API personale aiuta a compilare il form ma non sostituisce il controllo dell'utente.",
        "La chat AI del vault e i riepiloghi AI lavorano sui dati strutturati presenti nell'archivio e possono produrre errori o semplificazioni: l'utente deve sempre verificare le informazioni rilevanti."
      ]
    },
    {
      title: '6. Disponibilità e supporto',
      body: [
        "Durante la fase beta non è garantito alcun livello di servizio minimo, continuità assoluta, tempi di risposta prefissati o assenza totale di malfunzionamenti.",
        "Il supporto viene fornito nei limiti ragionevoli dell'attuale fase di sviluppo."
      ]
    },
    {
      title: '7. Responsabilità',
      body: [
        "Nei limiti consentiti dalla legge, il gestore del servizio non risponde di danni indiretti, perdita di opportunità, perdita di dati causata da uso improprio del servizio, perdita dell'accesso a Internet Identity o mancata verifica da parte dell'utente dei dati precompilati.",
        "Resta fermo quanto non può essere escluso o limitato dalla normativa applicabile."
      ]
    },
    {
      title: '8. Sospensione o modifica del servizio',
      body: [
        "Il servizio può essere modificato, sospeso o aggiornato per ragioni tecniche, di sicurezza, normative o operative.",
        "In caso di cambiamenti rilevanti il gestore potrà informare gli utenti con notifiche in-app o aggiornando la documentazione del sito."
      ]
    },
    {
      title: '9. Versioni e aggiornamenti',
      body: [
        "Questi termini possono essere aggiornati nel tempo. Prima di un'apertura pubblica o commerciale, questa pagina va completata con i dati del soggetto che offre il servizio e con eventuali condizioni economiche o consumer.",
        "Ultimo aggiornamento: 5 aprile 2026."
      ]
    }
  ];
</script>

<div class="min-h-screen bg-[#f7fafc] text-[#12303b] [font-family:'Inter',system-ui,sans-serif]">
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.95),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.2),transparent_24%)]"></div>

  <main class="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
    <div class="rounded-[2rem] border border-white/85 bg-white/80 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
      <a class="text-sm font-semibold text-[#0f5d6c] hover:underline" href="/">← Torna alla home</a>
      <p class="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Documenti legali</p>
      <h1 class="mt-3 text-[2.2rem] font-extrabold tracking-[-0.05em] text-[#103844] sm:text-[3rem]">Termini di Servizio</h1>
      <p class="mt-4 max-w-3xl text-sm leading-7 text-[#5a707a] sm:text-[1.02rem]">
        Questa pagina definisce le regole base di utilizzo del servizio in fase beta. Prima di un lancio aperto o a pagamento va completata con i dati del soggetto offerente e, se necessario, con condizioni commerciali specifiche.
      </p>

      <div class="mt-8 grid gap-5">
        {#each sections as section}
          <section class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
            <h2 class="text-lg font-bold tracking-[-0.03em] text-[#173843]">{section.title}</h2>
            <div class="mt-3 grid gap-3 text-sm leading-7 text-[#5a707a]">
              {#each section.body as paragraph}
                <p>{paragraph}</p>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    </div>
  </main>
</div>
