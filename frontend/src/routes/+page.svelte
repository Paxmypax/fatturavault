<svelte:head>
  <title>FatturaVault</title>
  <meta
    content="Il tuo cassetto digitale sicuro per fatture e documenti importanti."
    name="description"
  />
  <link href="https://fonts.googleapis.com" rel="preconnect" />
  <link crossorigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<script lang="ts">
  import { goto } from '$app/navigation';
  import { authState, login } from '$lib/auth';

  async function handleHeroAction() {
    if ($authState.authenticated) {
      await goto('/dashboard');
      return;
    }

    await login('hero');
  }

  async function handleNavbarLogin() {
    if ($authState.authenticated) {
      await goto('/dashboard');
      return;
    }

    await login('dashboard');
  }
</script>

<div class="min-h-screen overflow-hidden bg-[#f7fafc] text-[#12303b] [font-family:'Inter',system-ui,sans-serif]">
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.95),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.2),transparent_24%)]"></div>

  <main class="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
    <header class="flex items-center justify-between gap-4 rounded-full border border-white/70 bg-white/65 px-4 py-3 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur md:px-6">
      <div class="flex items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0e5a68] text-white shadow-[0_10px_24px_rgba(14,90,104,0.24)]">
          <svg aria-hidden="true" class="h-7 w-7" fill="none" viewBox="0 0 24 24">
            <path
              d="M12 3 6 5.5V11c0 4.25 2.56 7.36 6 9 3.44-1.64 6-4.75 6-9V5.5L12 3Z"
              fill="currentColor"
              opacity="0.18"
            />
            <path
              d="M12 3 6 5.5V11c0 4.25 2.56 7.36 6 9 3.44-1.64 6-4.75 6-9V5.5L12 3Z"
              stroke="currentColor"
              stroke-linejoin="round"
              stroke-width="1.7"
            />
            <path
              d="M8.3 9.2h7.4m-6.6 2.1h5.8a.9.9 0 0 1 .9.9v3.2a.9.9 0 0 1-.9.9H9.1a.9.9 0 0 1-.9-.9v-3.2a.9.9 0 0 1 .9-.9Zm2.9 2.55h.01"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
            />
            <path
              d="M10 7.2h4"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="1.5"
            />
          </svg>
        </div>

        <div>
          <p class="text-[1.35rem] font-extrabold tracking-[-0.03em] text-[#0f5666]">FATTURA VAULT</p>
        </div>
      </div>

      <div class="hidden items-center gap-10 md:flex">
        <nav class="flex items-center gap-9 text-[1.05rem] font-medium text-[#172d37]">
          <a class="transition-opacity hover:opacity-70" href="#funzionalita">Funzionalità</a>
          <a class="transition-opacity hover:opacity-70" href="#sicurezza">Sicurezza</a>
        </nav>

        <button
          class="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-6 text-lg font-medium text-[#112d37] shadow-[0_10px_25px_rgba(148,163,184,0.12)] transition-transform hover:-translate-y-0.5"
          type="button"
          onclick={handleNavbarLogin}
        >
          {$authState.authenticated ? "Dashboard" : "Accedi"}
        </button>
      </div>

      <button
        class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-4 text-base font-medium text-[#112d37] shadow-[0_10px_25px_rgba(148,163,184,0.12)] md:hidden"
        type="button"
        onclick={handleNavbarLogin}
      >
        {$authState.authenticated ? "Dashboard" : "Accedi"}
      </button>
    </header>

    <section class="grid flex-1 items-center gap-10 py-10 md:gap-14 lg:grid-cols-[minmax(0,0.94fr)_minmax(420px,1.06fr)] lg:py-14">
      <div class="max-w-[42rem]">
        <h1 class="whitespace-nowrap text-[2.85rem] leading-[0.9] font-extrabold tracking-[-0.06em] text-[#0b5666] sm:text-[4rem] lg:text-[4.9rem]">
          FATTURA VAULT
        </h1>
        <h2 class="mt-3 max-w-[11ch] text-[2.2rem] leading-[0.98] font-bold tracking-[-0.05em] text-[#29343b] sm:text-[3rem] lg:text-[4rem]">
          IL TUO CASSETTO DIGITALE SU BLOCKCHAIN.
        </h2>
        <p class="mt-7 max-w-xl text-lg leading-8 text-[#2f4650] sm:text-[1.45rem] sm:leading-9">
          Archivia, gestisci e organizza i tuoi file con la massima sicurezza e trasparenza della
          Blockchain.
        </p>

        <div class="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <button
            class="inline-flex min-h-14 items-center justify-center rounded-2xl bg-[#0f5d6c] px-8 text-lg font-bold text-white shadow-[0_18px_40px_rgba(15,93,108,0.28)] transition-transform hover:-translate-y-0.5"
            type="button"
            onclick={handleHeroAction}
          >
            {$authState.authenticated ? "Entra nell'app" : "Prova gratis"}
          </button>
        </div>
      </div>

      <div class="relative mx-auto flex w-full max-w-[45rem] justify-center lg:justify-end">
        <div class="absolute inset-x-[10%] top-[10%] bottom-[12%] rounded-[2.8rem] bg-[radial-gradient(circle,rgba(255,255,255,0.98),rgba(255,255,255,0.14)_60%,transparent_78%)] blur-[30px]"></div>
        <img
          alt="Cassaforte digitale con documenti protetti"
          class="relative z-10 w-full max-w-[40rem] object-contain drop-shadow-[0_28px_60px_rgba(108,136,158,0.2)]"
          src="/home-vault-hero.png"
        />
      </div>
    </section>

    <section class="grid gap-5 pb-10 lg:gap-6 lg:pb-14">
      <article
        id="come-funziona"
        class="rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8"
      >
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Come funziona</p>
        <h3 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844] sm:text-[2.2rem]">
          Un archivio digitale costruito su blockchain
        </h3>
        <div class="mt-5 grid gap-4 text-sm leading-7 text-[#5a707a] sm:text-[1.02rem]">
          <p>
            Fattura Vault è un archivio digitale pensato per raccogliere e organizzare documenti
            importanti in un unico spazio personale. È costruito su blockchain, cioè su
            un’infrastruttura distribuita che non dipende da un singolo server o da un solo
            operatore.
          </p>
          <p>
            La tecnologia su cui si basa è ICP, Internet Computer, una blockchain progettata per
            ospitare applicazioni e dati accessibili via web. Questo significa che Fattura Vault
            non è solo un sito tradizionale appoggiato a un’infrastruttura privata, ma un’app
            costruita su una rete aperta.
          </p>
          <p>
            Per accedere si usa Internet Identity, il sistema di autenticazione nativo di ICP. In
            pratica ti permette di entrare senza password classiche, usando dispositivi sicuri e
            metodi di recupero pensati per proteggere davvero il tuo accesso.
          </p>
        </div>
      </article>

      <article
        id="funzionalita"
        class="rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8"
      >
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Funzionalità</p>
        <h3 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844] sm:text-[2.2rem]">
          Un flusso semplice per caricare, catalogare e ritrovare
        </h3>
        <div class="mt-5 grid gap-4 text-sm leading-7 text-[#5a707a] sm:text-[1.02rem]">
          <p>
            L’app è organizzata in sezioni semplici: Inbox per caricare tutto al volo, Vault per
            consultare i documenti archiviati, Categorie per tenerli ordinati, Note per
            annotazioni più strutturate e Dashboard per avere una vista rapida d’insieme.
          </p>
          <p>
            L’idea è pratica: prima metti dentro i file, poi li sistemi con calma. Tag, categorie,
            date, importi e dettagli ti aiutano a ritrovare tutto senza trasformare l’archivio in
            un caos.
          </p>
        </div>
      </article>

      <article
        id="sicurezza"
        class="rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8"
      >
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Sicurezza</p>
        <h3 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844] sm:text-[2.2rem]">
          Più controllo, meno dipendenza da una piattaforma chiusa
        </h3>
        <div class="mt-5 grid gap-4 text-sm leading-7 text-[#5a707a] sm:text-[1.02rem]">
          <p>
            Con Fattura Vault l’accesso passa da Internet Identity, un sistema pensato per ridurre
            la dipendenza da password tradizionali e migliorare la protezione dell’account. La
            sicurezza non si basa solo su un login, ma su un modello costruito per dare più
            controllo all’utente.
          </p>
          <p>
            A differenza di un prodotto chiuso gestito interamente da una singola azienda, un’app
            su blockchain vive su un’infrastruttura aperta e distribuita. Questo riduce la
            dipendenza da un singolo datacenter o da un unico gestore centrale e rende il servizio
            meno legato alle logiche di una piattaforma proprietaria.
          </p>
          <p>
            In pratica significa più continuità, più trasparenza sull’infrastruttura e un archivio
            costruito per restare nel tempo, senza essere chiuso dentro l’ecosistema di un grande
            fornitore.
          </p>
        </div>
      </article>
    </section>
  </main>
</div>
