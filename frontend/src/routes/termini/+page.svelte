<svelte:head>
  <title>Termini di Servizio | Fattura Vault</title>
  <meta
    name="description"
    content="Termini di servizio di Fattura Vault per una beta pubblica controllata: accesso, uso consentito, limiti del servizio, AI, responsabilità e modifiche."
  />
</svelte:head>

<script lang="ts">
  const sections = [
    {
      title: '1. Stato del servizio',
      body: [
        "Fattura Vault è un'applicazione web per caricare, organizzare, archiviare e consultare documenti personali o professionali.",
        "Alla data attuale il servizio è offerto come beta pubblica controllata. Questo significa che funzioni, interfacce, limiti tecnici, automazioni e componenti AI possono cambiare nel tempo anche in modo rilevante."
      ]
    },
    {
      title: '2. Accesso e account',
      body: [
        "L'accesso al servizio avviene tramite Internet Identity. L'utente è responsabile della custodia dei propri dispositivi autorizzati, dei metodi di accesso e degli eventuali strumenti di recupero associati a Internet Identity.",
        "La perdita dell'accesso a Internet Identity può impedire l'accesso al vault. Fattura Vault non può garantire il recupero dell'account se l'identità digitale dell'utente non è più accessibile."
      ]
    },
    {
      title: '3. Uso consentito',
      body: [
        "L'utente si impegna a usare Fattura Vault in modo lecito, corretto e compatibile con la normativa applicabile.",
        "Non è consentito usare il servizio per caricare o trattare contenuti illeciti, fraudolenti, abusivi, dannosi, diffamatori o che violino diritti di terzi."
      ]
    },
    {
      title: '4. Funzioni beta e continuità del servizio',
      body: [
        "Durante la fase beta pubblica controllata il servizio può essere soggetto a modifiche, sospensioni, manutenzioni, limiti temporanei o interruzioni non pianificate.",
        "Non è garantito alcun livello di servizio minimo, alcuna continuità assoluta e alcuna assenza totale di errori o malfunzionamenti."
      ]
    },
    {
      title: '5. Limiti tecnici e quote',
      body: [
        "Alla data attuale il servizio applica limiti operativi per garantire stabilità e sostenibilità. In particolare: massimo 5 MB per file, Inbox temporanea fino a 500 MB per utente, Vault personale fino a 5 GB e chat AI del vault fino a 20 domande al giorno per account.",
        "Questi limiti possono cambiare nel tempo per ragioni tecniche, economiche, di sicurezza o di evoluzione del prodotto."
      ]
    },
    {
      title: '6. Documento temporaneo e archivio finale',
      body: [
        "L'Inbox è un'area temporanea di lavoro e revisione. Il Vault è l'archivio finale dei documenti confermati e organizzati dall'utente.",
        "L'utente resta responsabile del controllo dei dati prima del salvataggio finale nel Vault, inclusi categoria, importi, date, tag e campi fattura."
      ]
    },
    {
      title: '7. Funzioni AI',
      body: [
        "Le funzioni AI hanno natura esclusivamente assistiva. Il prefill documenti può aiutare a compilare alcuni campi, mentre la chat AI e i riepiloghi del vault possono aiutare a leggere meglio i dati archiviati.",
        "Le funzioni AI possono commettere errori, omissioni, semplificazioni o classificazioni imprecise. L'utente deve verificare sempre le informazioni prima di archiviarle o usarle per decisioni operative, fiscali, amministrative o legali."
      ]
    },
    {
      title: '8. Contenuti e responsabilità dell’utente',
      body: [
        "L'utente è responsabile dei documenti caricati, delle informazioni inserite manualmente e delle scelte di archiviazione o cancellazione effettuate nel servizio.",
        "Se il servizio viene usato per documenti sensibili o rilevanti sotto il profilo amministrativo, fiscale o contrattuale, l'utente deve mantenere un livello di controllo, verifica e backup coerente con l'importanza dei propri dati."
      ]
    },
    {
      title: '9. Limitazione di responsabilità',
      body: [
        "Nei limiti consentiti dalla legge, il gestore del servizio non risponde di danni indiretti, perdita di opportunità, interruzioni operative, perdita dell'accesso a Internet Identity, errori di prefill AI, errori di riepilogo AI o uso improprio del servizio.",
        "Resta fermo quanto non può essere escluso o limitato ai sensi della normativa applicabile."
      ]
    },
    {
      title: '10. Sospensione, modifica o chiusura della beta',
      body: [
        "Il servizio può essere modificato, sospeso, limitato o chiuso per ragioni tecniche, di sicurezza, normative, organizzative o commerciali.",
        "In caso di cambiamenti rilevanti il gestore può informare gli utenti tramite notifiche in-app, pagina Supporto o aggiornando i documenti legali del sito."
      ]
    },
    {
      title: '11. Legge applicabile e versione del documento',
      body: [
        "Questi termini devono essere completati, prima di un lancio commerciale, con i dati del soggetto offerente, eventuali condizioni economiche e ogni informazione obbligatoria ulteriore richiesta dalla normativa applicabile.",
        "Ultimo aggiornamento: 6 aprile 2026."
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
        Questa versione dei termini è pensata per una beta pubblica controllata. In questa fase
        Fattura Vault è offerto come beta pubblica gratuita: il servizio è utilizzabile, ma
        funzioni, limiti tecnici e componenti AI possono ancora evolvere. Prima di un lancio
        commerciale o di una distribuzione più ampia, il documento va completato con i dati del
        soggetto offerente e con eventuali condizioni economiche o consumer.
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
