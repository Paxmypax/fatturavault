<svelte:head>
  <title>Privacy Policy | Fattura Vault</title>
  <meta
    name="description"
    content="Informativa privacy di Fattura Vault: dati trattati, finalità, basi giuridiche, tempi di conservazione e diritti dell'utente."
  />
</svelte:head>

<script lang="ts">
  const sections = [
    {
      title: '1. Titolare e ambito della policy',
      body: [
        "Questa informativa descrive come Fattura Vault tratta i dati personali degli utenti che usano l'applicazione web e i servizi collegati.",
        "Prima di un'apertura commerciale ampia, questa pagina va completata con i dati identificativi del titolare del trattamento, i recapiti ufficiali e l'eventuale riferimento al DPO o consulente privacy."
      ]
    },
    {
      title: '2. Dati trattati',
      body: [
        "Fattura Vault può trattare dati di autenticazione collegati a Internet Identity, dati di profilo essenziali, metadati dei documenti archiviati, contenuti dei file caricati in Inbox e nel Vault, note, post-it, categorie, stati di pagamento, date di scadenza e messaggi di supporto o notifiche.",
        "Se l'utente attiva il prefill documenti con API personale, il contenuto del documento può essere inviato al provider AI scelto dall'utente per estrarre campi utili alla compilazione del form."
      ]
    },
    {
      title: '3. Finalità del trattamento',
      body: [
        "I dati sono trattati per consentire accesso sicuro all'app, caricamento e archiviazione documenti, organizzazione per categorie e tag, gestione di note e promemoria, notifiche di servizio, riepiloghi del vault e funzioni AI attivate dall'utente.",
        "I dati possono inoltre essere usati per sicurezza, prevenzione abusi, supporto tecnico e miglioramento operativo del servizio in forma compatibile con la normativa applicabile."
      ]
    },
    {
      title: '4. Base giuridica',
      body: [
        "Le basi giuridiche tipiche del trattamento sono l'esecuzione del servizio richiesto dall'utente, l'adempimento di obblighi legali, il legittimo interesse del gestore alla sicurezza e continuità del servizio e, dove necessario, il consenso dell'utente.",
        "Per i provider AI configurati con chiave personale, l'utente decide in autonomia se attivare o meno la funzione."
      ]
    },
    {
      title: '5. Conservazione dei dati',
      body: [
        "I file caricati in Inbox sono trattati come area temporanea di lavoro. I documenti archiviati nel Vault restano disponibili fino a cancellazione da parte dell'utente o fino a diversa esigenza legale o tecnica del servizio.",
        "Le notifiche lette vengono nascoste automaticamente dopo 24 ore. I log tecnici e i dati strettamente operativi possono essere conservati per il tempo necessario a sicurezza, diagnostica e continuità del servizio."
      ]
    },
    {
      title: '6. Destinatari e fornitori terzi',
      body: [
        "I dati possono essere trattati tramite infrastrutture e componenti dell'Internet Computer. Se l'utente attiva il prefill documenti con API personale, i documenti inviati al provider AI transitano secondo le regole del provider stesso.",
        "Prima del lancio pubblico è opportuno formalizzare e documentare gli eventuali rapporti con fornitori che operano come responsabili del trattamento."
      ]
    },
    {
      title: '7. Trasferimenti extra UE',
      body: [
        "Se vengono usati provider esterni non stabiliti nello Spazio Economico Europeo, il titolare deve verificare la base giuridica del trasferimento e la documentazione contrattuale applicabile.",
        "Questo punto va riesaminato con particolare attenzione se il servizio viene aperto al pubblico o monetizzato."
      ]
    },
    {
      title: '8. Diritti dell’utente',
      body: [
        "L'utente può chiedere accesso, rettifica, cancellazione, limitazione del trattamento, opposizione e portabilità nei casi previsti dalla normativa applicabile.",
        "L'utente ha inoltre diritto di proporre reclamo all'autorità di controllo competente, in Italia il Garante per la protezione dei dati personali."
      ]
    },
    {
      title: '9. Sicurezza',
      body: [
        "Fattura Vault adotta misure tecniche e organizzative per proteggere accesso, integrità e disponibilità dei dati. L'accesso al servizio è basato su Internet Identity e parte delle funzioni documentali usa separazione tra Inbox temporanea e Vault finale.",
        "Nessuna misura di sicurezza può però garantire rischio zero: è importante che l'utente custodisca con attenzione i metodi di accesso e le eventuali chiavi API personali."
      ]
    },
    {
      title: '10. Versioni e aggiornamenti',
      body: [
        "Questa policy può essere aggiornata nel tempo. Se vengono introdotte modifiche rilevanti, il servizio può informare gli utenti tramite notifiche in-app o aggiornando questa pagina.",
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
      <h1 class="mt-3 text-[2.2rem] font-extrabold tracking-[-0.05em] text-[#103844] sm:text-[3rem]">Privacy Policy</h1>
      <p class="mt-4 max-w-3xl text-sm leading-7 text-[#5a707a] sm:text-[1.02rem]">
        Questa è una base operativa utile per la beta. Prima di un lancio pubblico o commerciale va completata con i dati del titolare del trattamento, recapiti ufficiali e verifiche legali finali.
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
