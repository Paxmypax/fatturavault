<svelte:head>
  <title>Informativa AI e Cookie | Fattura Vault</title>
  <meta
    name="description"
    content="Informativa su funzioni AI, cookie e tecnologie simili in Fattura Vault."
  />
</svelte:head>

<script lang="ts">
  const faqs = [
    {
      question: 'Il prefill documenti usa la mia API personale?',
      answer:
        "Sì. Il prefill documenti è opzionale e usa la chiave API personale inserita dall'utente in Impostazioni. Se non attivi la funzione, il form resta manuale."
    },
    {
      question: "L'LLM on-chain ICP legge i miei PDF o le mie immagini?",
      answer:
        "No. In Fattura Vault l'LLM on-chain ICP è pensato per lavorare su testo e dati strutturati già presenti nel vault, ad esempio riepiloghi e chat sui dati archiviati. Non sostituisce il prefill documenti con API personale."
    },
    {
      question: 'Usate cookie di profilazione o marketing?',
      answer:
        "Allo stato attuale il servizio è pensato per usare solo elementi tecnici e funzionali necessari al funzionamento dell'app. Prima di introdurre strumenti ulteriori di marketing o profilazione serve una valutazione dedicata e, se necessario, un meccanismo di consenso."
    }
  ];
</script>

<div class="min-h-screen bg-[#f7fafc] text-[#12303b] [font-family:'Inter',system-ui,sans-serif]">
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.95),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.2),transparent_24%)]"></div>

  <main class="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
    <div class="rounded-[2rem] border border-white/85 bg-white/80 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
      <a class="text-sm font-semibold text-[#0f5d6c] hover:underline" href="/">← Torna alla home</a>
      <p class="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Trasparenza AI e tecnologie tecniche</p>
      <h1 class="mt-3 text-[2.2rem] font-extrabold tracking-[-0.05em] text-[#103844] sm:text-[3rem]">Informativa AI e Cookie</h1>

      <section class="mt-6 rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
        <h2 class="text-lg font-bold tracking-[-0.03em] text-[#173843]">Come usiamo l’AI</h2>
        <div class="mt-3 grid gap-3 text-sm leading-7 text-[#5a707a]">
          <p>
            Fattura Vault usa due famiglie di funzioni AI distinte. Il prefill documenti è opzionale e, se attivato dall'utente, usa l'API personale configurata in Impostazioni per aiutare a precompilare alcuni campi durante la catalogazione di un documento.
          </p>
          <p>
            L'LLM on-chain ICP è separato dal prefill: serve per riepiloghi e chat sui dati strutturati già presenti nel vault. In questa fase usa il modello Llama 3.1 8B tramite l'infrastruttura on-chain di ICP.
          </p>
          <p>
            Le funzioni AI hanno sempre natura assistiva. L'utente deve verificare i risultati prima di archiviare documenti o prendere decisioni operative.
          </p>
        </div>
      </section>

      <section class="mt-6 rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
        <h2 class="text-lg font-bold tracking-[-0.03em] text-[#173843]">Cookie e tecnologie simili</h2>
        <div class="mt-3 grid gap-3 text-sm leading-7 text-[#5a707a]">
          <p>
            Fattura Vault usa principalmente elementi tecnici necessari al funzionamento dell'app, come sessioni, preferenze locali del browser, stato UI, cache operative e configurazioni salvate sul dispositivo dell'utente.
          </p>
          <p>
            Alla data attuale il servizio non è progettato per basarsi su cookie di marketing o profilazione. Se in futuro verranno introdotti strumenti di tracciamento non tecnici, la relativa informativa e gli eventuali meccanismi di consenso dovranno essere aggiornati.
          </p>
        </div>
      </section>

      <section class="mt-6 rounded-[1.5rem] border border-[#e3edf1] bg-white p-5 shadow-[0_12px_30px_rgba(148,163,184,0.08)]">
        <h2 class="text-lg font-bold tracking-[-0.03em] text-[#173843]">Domande rapide</h2>
        <div class="mt-4 grid gap-4">
          {#each faqs as faq}
            <details class="rounded-[1.25rem] border border-[#e3edf1] bg-[#f8fbfc] p-4">
              <summary class="cursor-pointer list-none text-base font-semibold text-[#173843]">{faq.question}</summary>
              <p class="mt-3 text-sm leading-7 text-[#5a707a]">{faq.answer}</p>
            </details>
          {/each}
        </div>
      </section>
    </div>
  </main>
</div>
