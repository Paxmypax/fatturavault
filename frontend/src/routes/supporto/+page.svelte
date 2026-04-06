<script lang="ts">
	import { goto } from '$app/navigation';
	import { authState, initAuth, logout } from '$lib/auth';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import { analyticsAccessState, initAnalyticsAccess } from '$lib/stores/analyticsAccess';
	import { onMount } from 'svelte';

	onMount(async () => {
		await initAuth();

		if (!$authState.authenticated) {
			await goto('/');
			return;
		}

		void initAnalyticsAccess();
	});

	type GuideStep = {
		title: string;
		body: string;
	};

	type FaqItem = {
		question: string;
		answer: string;
	};

	const guideSteps: GuideStep[] = [
		{
			title: '1. Carica i file in Inbox',
			body:
				'Vai in Inbox e seleziona uno o più file. Durante il caricamento lasciali finire: ogni documento passa da "In caricamento" a "Pronto da gestire".'
		},
		{
			title: '2. Attendi che siano pronti',
			body:
				'Quando un file è pronto da gestire puoi aprirlo senza rischiare di perdere il caricamento. Se stai caricando più documenti, lasciali completare prima di cambiare pagina.'
		},
		{
			title: '3. Attiva il prefill AI se vuoi usarlo',
			body:
				'Da Impostazioni puoi attivare il prefill documenti con la tua API personale OpenAI. È facoltativo: se lo abiliti, alcuni campi del form possono arrivare già compilati e vanno sempre verificati prima di archiviare.'
		},
		{
			title: '4. Apri e controlla il documento',
			body:
				'Apri il file da Inbox, controlla l anteprima e completa i campi del form. Se hai attivato il prefill LLM con API personale, troverai già alcuni campi compilati da verificare.'
		},
		{
			title: '5. Salva e archivia nel Vault',
			body:
				'Con "Salva e archivia" il documento entra nel Vault finale. Da quel momento viene registrato come archiviato e inizia la sincronizzazione definitiva con il tuo archivio.'
		},
		{
			title: '6. Ritrovalo in Vault e Categorie',
			body:
				'Una volta confermato, il file compare in Vault e anche nella sua categoria. In Dashboard vedrai aggiornarsi il numero dei file archiviati e le attività recenti.'
		},
		{
			title: '7. Elimina solo ciò che non ti serve più',
			body:
				'Se elimini un documento dal Vault viene rimosso anche dal backend e dallo storage remoto dopo la sincronizzazione, liberando davvero spazio nel tuo archivio.'
		}
	];

	const faqItems: FaqItem[] = [
		{
			question: 'Cosa succede se perdo l accesso a Internet Identity?',
			answer:
				'Internet Identity è la chiave di accesso al tuo vault. Se perdi l accesso e non hai recovery phrase o dispositivo di backup, potresti non riuscire più a entrare nel tuo archivio.'
		},
		{
			question: 'Come vengono salvati i miei file nel vault?',
			answer:
				'I file arrivano prima in Inbox come area temporanea di lavoro. Quando li archivi, vengono registrati nel Vault finale insieme ai metadati e ai blob necessari per anteprima e download.'
		},
		{
			question: 'La mia privacy è protetta?',
			answer:
				'Sì. Il Vault finale è pensato come archivio personale. L Inbox è una zona temporanea di lavorazione: utile per caricamento, anteprima e analisi, ma non va confusa con l archivio definitivo.'
		},
		{
			question: 'Perché alcuni file impiegano un po a completare il salvataggio?',
			answer:
				'Durante l archiviazione il sistema prepara il file, aggiorna i metadati, sincronizza il Vault e salva i blob necessari. Su mobile o con file più pesanti il processo può richiedere qualche secondo in più.'
		},
		{
			question: 'Come funziona il prefill dei documenti?',
			answer:
				'Il prefill è opzionale e si attiva da Impostazioni con la tua API personale OpenAI. Se attivo, prova a leggere il file in Inbox e a compilare alcuni campi del form, ma il controllo finale resta sempre tuo.'
		},
		{
			question: 'Perché c è un limite di 5 MB per file?',
			answer:
				'Il limite aiuta a mantenere caricamento e sincronizzazione rapidi. Le immagini sopra 5 MB vengono compresse automaticamente nel browser prima dell upload; i PDF invece devono già rientrare nel limite.'
		},
		{
			question: 'Cosa succede alle notifiche della campanella?',
			answer:
				'Le notifiche servono per messaggi e avvisi inviati agli iscritti di Fattura Vault. Il pallino rosso sparisce quando apri la campanella e le notifiche lette si nascondono automaticamente dopo 24 ore.'
		},
		{
			question: 'Come funziona la chat AI del vault?',
			answer:
				'La chat AI in Dashboard lavora sui dati strutturati già presenti nel tuo archivio, come importi, categorie, stati pagamento e scadenze. Non sostituisce il controllo umano, ma ti aiuta a leggere meglio il contenuto del vault.'
		}
	];
</script>

<svelte:head>
	<title>Supporto | Fattura Vault</title>
</svelte:head>

<div class="min-h-screen bg-[#f7fafc] text-[#12303b] [font-family:'Inter',system-ui,sans-serif]">
	<div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.96),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.18),transparent_24%)]"></div>

	<div class="relative flex min-h-screen flex-col lg:flex-row">
		<aside class="flex w-full shrink-0 flex-col border-b border-[#dbe5ea] bg-white/72 px-5 py-5 shadow-[0_18px_50px_rgba(148,163,184,0.08)] backdrop-blur lg:w-[278px] lg:border-r lg:border-b-0 lg:px-4 lg:py-4">
			<div class="flex items-center gap-3 px-2 py-2">
				<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0e5a68] text-white shadow-[0_10px_24px_rgba(14,90,104,0.24)]">
					<svg aria-hidden="true" class="h-7 w-7" fill="none" viewBox="0 0 24 24">
						<path d="M12 3 6 5.5V11c0 4.25 2.56 7.36 6 9 3.44-1.64 6-4.75 6-9V5.5L12 3Z" fill="currentColor" opacity="0.18" />
						<path d="M12 3 6 5.5V11c0 4.25 2.56 7.36 6 9 3.44-1.64 6-4.75 6-9V5.5L12 3Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7" />
						<path d="M8.3 9.2h7.4m-6.6 2.1h5.8a.9.9 0 0 1 .9.9v3.2a.9.9 0 0 1-.9.9H9.1a.9.9 0 0 1-.9-.9v-3.2a.9.9 0 0 1 .9-.9Zm2.9 2.55h.01" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" />
						<path d="M10 7.2h4" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" />
					</svg>
				</div>
				<p class="text-[1.35rem] font-extrabold tracking-[-0.03em] text-[#0f5666]">FATTURA VAULT</p>
			</div>

			<nav class="mt-7">
				<a class="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/dashboard">Dashboard</a>
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/inbox">Inbox</a>
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/vault">Vault</a>
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/note">Note</a>
				{#if $analyticsAccessState.canView}
					<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/analytics">Analytics</a>
				{/if}
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/categorie">Categorie</a>
			</nav>

			<div class="mt-8 hidden flex-1 lg:block"></div>

			<div class="mt-8 grid gap-2 lg:mt-auto">
				<a class="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/impostazioni">
					Impostazioni
				</a>
				<a class="flex items-center gap-3 rounded-2xl bg-[#0f5d6c] px-4 py-3 text-left text-lg font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.18)]" href="/supporto">
					Supporto
				</a>
				<button class="mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-medium text-[#8f4040] transition-colors hover:bg-[#fff1f1]" type="button" onclick={logout}>
					Esci
				</button>
			</div>
		</aside>

		<div class="flex min-h-screen flex-1 flex-col">
			<header class="relative z-30 border-b border-[#dbe5ea] bg-white/62 px-5 py-4 backdrop-blur sm:px-8">
				<div class="flex items-center justify-end gap-4">
					<NotificationBell />

					<div class="rounded-full border border-white/80 bg-white/82 px-4 py-3 shadow-[0_10px_25px_rgba(148,163,184,0.1)]">
						<p class="max-w-[12rem] truncate text-base font-semibold text-[#183843]">
							{$authState.displayName ?? 'Profilo'}
						</p>
					</div>
				</div>
			</header>

			<main class="flex-1 px-5 py-6 sm:px-8 lg:px-10">
				<div class="mx-auto max-w-6xl">
					<h1 class="text-[2.4rem] font-extrabold tracking-[-0.05em] text-[#0f5666] sm:text-[3.4rem]">SUPPORTO</h1>
					<p class="mt-3 max-w-3xl text-sm leading-6 text-[#5a707a]">
						Una guida semplice per usare Fattura Vault senza dubbi: caricamento, archiviazione, ritrovamento dei documenti e risposte rapide alle domande più comuni.
					</p>

					<section class="mt-8 rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
						<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Guida passo passo</p>
						<h2 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Come funziona il vault</h2>

						<div class="mt-6 grid gap-4">
							{#each guideSteps as step}
								<div class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
									<h3 class="text-lg font-bold tracking-[-0.03em] text-[#173843]">{step.title}</h3>
									<p class="mt-2 text-sm leading-6 text-[#5a707a]">{step.body}</p>
								</div>
							{/each}
						</div>
					</section>

					<section class="mt-8 rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
						<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">FAQ</p>
						<h2 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Domande frequenti</h2>

						<div class="mt-6 grid gap-4">
							{#each faqItems as item}
								<details class="rounded-[1.5rem] border border-[#e3edf1] bg-white p-5 shadow-[0_12px_30px_rgba(148,163,184,0.08)]">
									<summary class="cursor-pointer list-none text-base font-semibold text-[#173843]">
										{item.question}
									</summary>
									<p class="mt-3 text-sm leading-6 text-[#5a707a]">{item.answer}</p>
								</details>
							{/each}
						</div>
					</section>

					<section class="mt-8 rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
						<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Documenti legali</p>
						<h2 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Prima di aprire il servizio</h2>
						<p class="mt-3 max-w-3xl text-sm leading-6 text-[#5a707a]">
							Se vuoi capire meglio come gestiamo privacy, regole d'uso e funzioni AI, qui trovi le tre pagine base da leggere prima di una diffusione più ampia del servizio.
						</p>
						<div class="mt-6 flex flex-wrap gap-3">
							<a class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#12303b] shadow-[0_10px_25px_rgba(148,163,184,0.1)] hover:-translate-y-0.5 transition-transform" href="/privacy">
								Privacy Policy
							</a>
							<a class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#12303b] shadow-[0_10px_25px_rgba(148,163,184,0.1)] hover:-translate-y-0.5 transition-transform" href="/termini">
								Termini di Servizio
							</a>
							<a class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#12303b] shadow-[0_10px_25px_rgba(148,163,184,0.1)] hover:-translate-y-0.5 transition-transform" href="/informativa-ai">
								Informativa AI e Cookie
							</a>
						</div>
					</section>

					<section class="mt-8 rounded-[2rem] border border-[#dbe9ee] bg-[#eef8fa] p-6 shadow-[0_20px_50px_rgba(148,163,184,0.12)] sm:p-8">
						<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f5d6c]">Consiglio rapido</p>
						<h2 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Buone pratiche</h2>
						<ul class="mt-4 grid gap-3 text-sm leading-6 text-[#22505d]">
							<li>Attendi che un file in Inbox diventi pronto prima di aprirlo o cambiare pagina.</li>
							<li>Dopo l archiviazione verifica il file in Vault e nella sua categoria.</li>
							<li>Conserva recovery phrase e dispositivo di backup di Internet Identity.</li>
							<li>Elimina dal Vault solo documenti che non ti servono più, così recuperi spazio reale.</li>
						</ul>
					</section>
				</div>
			</main>
		</div>
	</div>
</div>
