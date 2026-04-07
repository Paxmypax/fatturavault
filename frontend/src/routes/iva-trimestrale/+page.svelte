<script lang="ts">
	import { goto } from '$app/navigation';
	import { authState, initAuth, logout } from '$lib/auth';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import { analyticsAccessState, initAnalyticsAccess } from '$lib/stores/analyticsAccess';
	import { computeVatCsv, formatEuro, type VatCsvComputation } from '$lib/vatQuarterly';
	import { onMount } from 'svelte';

	type VatReport = {
		issued: VatCsvComputation;
		received: VatCsvComputation;
		receipts: VatCsvComputation;
		outputVat: number;
		inputVat: number;
		quarterBalance: number;
		previousCredit: number;
		finalBalance: number;
	};

	const quarterOptions = [
		{ value: 'Q1', label: '1° trimestre (gen-mar)' },
		{ value: 'Q2', label: '2° trimestre (apr-giu)' },
		{ value: 'Q3', label: '3° trimestre (lug-set)' },
		{ value: 'Q4', label: '4° trimestre (ott-dic)' }
	];

	const uploadSections: Array<{ kind: 'issued' | 'received' | 'receipts' }> = [
		{ kind: 'issued' },
		{ kind: 'received' },
		{ kind: 'receipts' }
	];

	onMount(async () => {
		await initAuth();

		if (!$authState.authenticated) {
			await goto('/');
			return;
		}

		void initAnalyticsAccess();
	});

	let issuedFiles = $state<File[]>([]);
	let receivedFiles = $state<File[]>([]);
	let receiptFiles = $state<File[]>([]);
	let previousQuarterCreditInput = $state('');
	let selectedQuarter = $state('Q1');
	let selectedYear = $state(String(new Date().getFullYear()));
	let pending = $state(false);
	let errorMessage = $state('');
	let report = $state<VatReport | null>(null);
	let disclaimerAccepted = $state(false);
	let dragOverKind = $state<'issued' | 'received' | 'receipts' | null>(null);

	function principalLabel(principal: string | null) {
		if (!principal) {
			return 'Profilo';
		}

		if (principal.length <= 18) {
			return principal;
		}

		return `${principal.slice(0, 10)}...${principal.slice(-6)}`;
	}

	function normalizeNumberInput(value: string) {
		const cleaned = value.replace(/[^\d,.-]/g, '');
		const normalized = cleaned.replace(/\./g, '').replace(',', '.');
		const parsed = Number.parseFloat(normalized);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	function handleFileSelection(
		event: Event & {
			currentTarget: EventTarget & HTMLInputElement;
		},
		kind: 'issued' | 'received' | 'receipts'
	) {
		const nextFiles = Array.from(event.currentTarget.files ?? []).filter(
			(file) => file.name.toLowerCase().endsWith('.csv')
		);

		if (kind === 'issued') {
			issuedFiles = nextFiles;
			return;
		}

		if (kind === 'received') {
			receivedFiles = nextFiles;
			return;
		}

		receiptFiles = nextFiles;
	}

	function assignFiles(kind: 'issued' | 'received' | 'receipts', nextFiles: File[]) {
		if (kind === 'issued') {
			issuedFiles = nextFiles;
			return;
		}

		if (kind === 'received') {
			receivedFiles = nextFiles;
			return;
		}

		receiptFiles = nextFiles;
	}

	function handleDragOver(event: DragEvent, kind: 'issued' | 'received' | 'receipts') {
		event.preventDefault();
		dragOverKind = kind;
	}

	function handleDragLeave(event: DragEvent, kind: 'issued' | 'received' | 'receipts') {
		event.preventDefault();
		if (dragOverKind === kind) {
			dragOverKind = null;
		}
	}

	function handleDrop(event: DragEvent, kind: 'issued' | 'received' | 'receipts') {
		event.preventDefault();
		dragOverKind = null;
		const nextFiles = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
			file.name.toLowerCase().endsWith('.csv')
		);
		assignFiles(kind, nextFiles);
	}

	function clearAll() {
		issuedFiles = [];
		receivedFiles = [];
		receiptFiles = [];
		previousQuarterCreditInput = '';
		errorMessage = '';
		report = null;
		disclaimerAccepted = false;
	}

	function totalBytesLabel(files: File[]) {
		const total = files.reduce((sum, file) => sum + file.size, 0);
		if (total < 1024 * 1024) {
			return `${Math.max(1, Math.round(total / 1024))} KB`;
		}

		return `${(total / (1024 * 1024)).toFixed(2)} MB`;
	}

	async function handleCalculate() {
		errorMessage = '';
		report = null;

		if (!issuedFiles.length && !receivedFiles.length && !receiptFiles.length) {
			errorMessage = 'Carica almeno un file CSV prima di avviare il calcolo.';
			return;
		}

		if (!disclaimerAccepted) {
			errorMessage =
				'Conferma di aver letto l’avviso: questo strumento non sostituisce il commercialista e i risultati non sono dati certi.';
			return;
		}

		pending = true;
		try {
			const [issued, received, receipts] = await Promise.all([
				computeVatCsv(issuedFiles, 'issued'),
				computeVatCsv(receivedFiles, 'received'),
				computeVatCsv(receiptFiles, 'receipts')
			]);

			const outputVat = issued.vat + receipts.vat;
			const inputVat = received.vat;
			const quarterBalance = outputVat - inputVat;
			const previousCredit = normalizeNumberInput(previousQuarterCreditInput);
			const finalBalance = quarterBalance - previousCredit;

			report = {
				issued,
				received,
				receipts,
				outputVat,
				inputVat,
				quarterBalance,
				previousCredit,
				finalBalance
			};
		} catch (error) {
			errorMessage =
				error instanceof Error
					? error.message
					: 'Impossibile completare il calcolo IVA trimestrale.';
		} finally {
			pending = false;
		}
	}

	function filePanelTitle(kind: 'issued' | 'received' | 'receipts') {
		switch (kind) {
			case 'issued':
				return 'Fatture emesse / vendite';
			case 'received':
				return 'Fatture ricevute / acquisti';
			default:
				return 'Corrispettivi';
		}
	}

	function filePanelDescription(kind: 'issued' | 'received' | 'receipts') {
		switch (kind) {
			case 'issued':
				return 'CSV del trimestre per le operazioni attive: base imponibile, IVA e totale delle fatture emesse.';
			case 'received':
				return 'CSV del trimestre per le operazioni passive: IVA detraibile delle fatture ricevute o di acquisto.';
			default:
				return 'CSV dei corrispettivi del trimestre con imponibile e IVA per aliquota, se presenti.';
		}
	}

	function filesFor(kind: 'issued' | 'received' | 'receipts') {
		if (kind === 'issued') {
			return issuedFiles;
		}

		if (kind === 'received') {
			return receivedFiles;
		}

		return receiptFiles;
	}

	function reportTone(balance: number) {
		if (balance > 0) {
			return {
				label: 'IVA a debito',
				panel: 'border-[#f5d6a3] bg-[#fff8eb]',
				badge: 'bg-[#fff0cc] text-[#9a5b00]'
			};
		}

		if (balance < 0) {
			return {
				label: 'IVA a credito',
				panel: 'border-[#cfe7d8] bg-[#f2fbf5]',
				badge: 'bg-[#dcf5e4] text-[#1d6b3a]'
			};
		}

		return {
			label: 'Saldo IVA pari a zero',
			panel: 'border-[#d8e8ed] bg-[#eef8fa]',
			badge: 'bg-[#dff1f3] text-[#0f5d6c]'
		};
	}
</script>

<svelte:head>
	<title>IVA Trimestrale | Fattura Vault</title>
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
				<a class="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/dashboard">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0 text-[#3e5963]" fill="none" viewBox="0 0 24 24">
						<rect x="3.5" y="3.5" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.7" />
						<rect x="13.5" y="3.5" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.7" />
						<rect x="3.5" y="13.5" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.7" />
						<rect x="13.5" y="13.5" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.7" />
					</svg>
					Dashboard
				</a>
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/inbox">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0 text-[#3e5963]" fill="none" viewBox="0 0 24 24">
						<path d="M5 8.2A2.2 2.2 0 0 1 7.2 6h9.6A2.2 2.2 0 0 1 19 8.2v7.6A2.2 2.2 0 0 1 16.8 18H7.2A2.2 2.2 0 0 1 5 15.8V8.2Z" stroke="currentColor" stroke-width="1.7" />
						<path d="M5.2 9.5h4l1.6 2.1h8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
					</svg>
					Inbox
				</a>
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/vault">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0 text-[#3e5963]" fill="none" viewBox="0 0 24 24">
						<path d="M5 7.8A2.8 2.8 0 0 1 7.8 5h8.4L19 7.8v8.4A2.8 2.8 0 0 1 16.2 19H7.8A2.8 2.8 0 0 1 5 16.2V7.8Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7" />
						<path d="M14.2 5.2V9H18" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
						<path d="M8 12h8M8 15.5h5" stroke="currentColor" stroke-linecap="round" stroke-width="1.7" />
					</svg>
					Vault
				</a>
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/note">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0 text-[#3e5963]" fill="none" viewBox="0 0 24 24">
						<path d="M6 5.8A1.8 1.8 0 0 1 7.8 4h8.4A1.8 1.8 0 0 1 18 5.8v12.4A1.8 1.8 0 0 1 16.2 20H7.8A1.8 1.8 0 0 1 6 18.2V5.8Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7" />
						<path d="M9 9h6M9 12.5h6M9 16h4" stroke="currentColor" stroke-linecap="round" stroke-width="1.7" />
					</svg>
					Note
				</a>
				{#if $analyticsAccessState.canView}
					<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/analytics">
						<svg aria-hidden="true" class="h-6 w-6 shrink-0 text-[#3e5963]" fill="none" viewBox="0 0 24 24">
							<path d="M5 18.2V10.8m7 7.4V6.8m7 11.4v-4.8" stroke="currentColor" stroke-linecap="round" stroke-width="1.9" />
							<path d="M3.8 19.2h16.4" stroke="currentColor" stroke-linecap="round" stroke-width="1.7" />
							<circle cx="5" cy="8.8" r="1.8" fill="currentColor" />
							<circle cx="12" cy="4.8" r="1.8" fill="currentColor" opacity="0.78" />
							<circle cx="19" cy="11.8" r="1.8" fill="currentColor" opacity="0.55" />
						</svg>
						Analytics
					</a>
				{/if}
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/categorie">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0 text-[#3e5963]" fill="none" viewBox="0 0 24 24">
						<circle cx="7" cy="7" r="2.2" fill="currentColor" />
						<circle cx="7" cy="17" r="2.2" fill="currentColor" opacity="0.72" />
						<circle cx="17" cy="12" r="2.2" fill="currentColor" opacity="0.52" />
						<path d="M9.2 7H19M9.2 17H19M3 12h10" stroke="currentColor" stroke-linecap="round" stroke-width="1.7" />
					</svg>
					Categorie
				</a>
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl bg-[#0f5d6c] px-4 py-4 text-left text-lg font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.18)]" href="/iva-trimestrale">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24">
						<path d="M4.8 6.8h14.4M7.5 12h9m-11 5.2h13" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
						<path d="M6.2 4h11.6A2.2 2.2 0 0 1 20 6.2v11.6A2.2 2.2 0 0 1 17.8 20H6.2A2.2 2.2 0 0 1 4 17.8V6.2A2.2 2.2 0 0 1 6.2 4Z" stroke="currentColor" stroke-width="1.7" />
					</svg>
					IVA trimestrale
				</a>
			</nav>

			<div class="mt-8 hidden flex-1 lg:block"></div>

			<div class="mt-8 grid gap-2 lg:mt-auto">
				<a class="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/impostazioni">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0 text-[#3e5963]" fill="none" viewBox="0 0 24 24">
						<path d="M4 12.2V8.6a2.6 2.6 0 0 1 2.6-2.6h10.8A2.6 2.6 0 0 1 20 8.6v3.6" stroke="currentColor" stroke-width="1.7" />
						<path d="M8.2 6V3.8m7.6 2.2V3.8M6.8 20h10.4A2.8 2.8 0 0 0 20 17.2v-4.4H4v4.4A2.8 2.8 0 0 0 6.8 20Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7" />
					</svg>
					Impostazioni
				</a>
				<a class="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/supporto">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0 text-[#3e5963]" fill="none" viewBox="0 0 24 24">
						<path d="M12 20c4.42 0 8-3.36 8-7.5S16.42 5 12 5 4 8.36 4 12.5c0 1.97.81 3.77 2.14 5.1L5 21l3.83-1.12A8.54 8.54 0 0 0 12 20Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7" />
						<path d="M9.2 10.3h5.6M9.2 13.7h3.8" stroke="currentColor" stroke-linecap="round" stroke-width="1.7" />
					</svg>
					Supporto
				</a>
				<button class="mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-medium text-[#8f4040] transition-colors hover:bg-[#fff1f1]" type="button" onclick={logout}>
					<svg aria-hidden="true" class="h-6 w-6 shrink-0 text-[#8f4040]" fill="none" viewBox="0 0 24 24">
						<path d="M10 5H7.8A2.8 2.8 0 0 0 5 7.8v8.4A2.8 2.8 0 0 0 7.8 19H10" stroke="currentColor" stroke-linecap="round" stroke-width="1.7" />
						<path d="M14 8.2 18.8 12 14 15.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
						<path d="M18.5 12H9.2" stroke="currentColor" stroke-linecap="round" stroke-width="1.7" />
					</svg>
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
							{$authState.displayName ?? principalLabel($authState.principal)}
						</p>
					</div>
				</div>
			</header>

			<main class="flex-1 px-5 py-6 sm:px-8 lg:px-10">
				<div class="mx-auto max-w-7xl">
					<h1 class="text-[2.4rem] font-extrabold tracking-[-0.05em] text-[#0f5666] sm:text-[3.4rem]">
						IVA TRIMESTRALE
					</h1>
					<p class="mt-3 max-w-4xl text-sm leading-6 text-[#5a707a] sm:text-[1.02rem]">
						Carica i CSV del trimestre, lancia il calcolo e ottieni un riepilogo semplice di IVA a debito o a credito.
						Tutto viene elaborato solo nel browser: i file e i risultati non vengono salvati nel vault, nel backend o in blockchain.
					</p>

					<div class="mt-6 rounded-[1.6rem] border border-[#f4d889] bg-[linear-gradient(135deg,rgba(255,249,235,0.98),rgba(255,255,255,0.95))] p-5 shadow-[0_16px_36px_rgba(200,169,110,0.14)]">
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6c00]">Avviso importante</p>
						<p class="mt-3 text-sm leading-6 text-[#6f5b2f]">
							Questo strumento serve come supporto rapido e non produce dati certi. Non sostituisce il lavoro di un commercialista o una verifica fiscale professionale. I risultati dipendono anche dalla qualità dei CSV caricati e dalle colonne riconosciute.
						</p>
					</div>

					<section class="mt-6 rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
						<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Guida rapida</p>
						<h2 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Come recuperare i CSV dal portale dell’Agenzia delle Entrate</h2>
						<div class="mt-5 grid gap-4 text-sm leading-7 text-[#5a707a] sm:text-[1.02rem]">
							<p>
								Accedi all’area riservata dell’Agenzia delle Entrate e apri il portale <strong>Fatture e Corrispettivi</strong>. Cerca la sezione di consultazione o i dati rilevanti ai fini IVA del trimestre che ti interessa.
							</p>
							<p>
								Esporta, quando disponibili, i CSV delle <strong>fatture emesse</strong>, delle <strong>fatture ricevute</strong> e dei <strong>corrispettivi</strong>. I nomi esatti dei menu possono cambiare nel tempo, quindi usa questa guida come orientamento generale e non come procedura ufficiale passo passo.
							</p>
							<p>
								Una volta scaricati i file, caricali qui sotto nelle tre aree corrette. Il calcolo resta locale nel browser e non memorizza nulla nel tuo vault.
							</p>
						</div>
					</section>

					<section class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
						<div class="rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
							<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Input trimestre</p>
							<h2 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Carica i CSV da elaborare</h2>

							<div class="mt-6 grid gap-4 sm:grid-cols-2">
								<div>
									<label class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]" for="vat-quarter">Trimestre</label>
									<select id="vat-quarter" class="mt-2 min-h-12 w-full rounded-2xl border border-[#d6e2e7] bg-white px-4 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]" bind:value={selectedQuarter}>
										{#each quarterOptions as quarter}
											<option value={quarter.value}>{quarter.label}</option>
										{/each}
									</select>
								</div>
								<div>
									<label class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]" for="vat-year">Anno</label>
									<input id="vat-year" class="mt-2 min-h-12 w-full rounded-2xl border border-[#d6e2e7] bg-white px-4 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]" type="number" min="2020" max="2100" bind:value={selectedYear} />
								</div>
							</div>

							<div class="mt-6 grid gap-4">
								{#each uploadSections as section}
									{@const kind = section.kind}
									<div class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
										<h3 class="text-lg font-bold tracking-[-0.03em] text-[#173843]">{filePanelTitle(kind)}</h3>
										<p class="mt-2 text-sm leading-6 text-[#5a707a]">{filePanelDescription(kind)}</p>
										<label
											class={`mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-[1.3rem] border-2 border-dashed px-4 text-center transition-all ${
												dragOverKind === kind
													? 'border-[#0f5d6c] bg-[#eef8fa]'
													: 'border-[#d7e1e8] bg-white hover:-translate-y-0.5'
											}`}
											ondragover={(event) => handleDragOver(event, kind)}
											ondragleave={(event) => handleDragLeave(event, kind)}
											ondrop={(event) => handleDrop(event, kind)}
										>
											<input
												class="hidden"
												type="file"
												accept=".csv,text/csv"
												multiple
												onchange={(event) => handleFileSelection(event, kind)}
											/>
											<span class="text-sm font-semibold text-[#173843]">Carica CSV</span>
											<span class="mt-2 text-xs leading-5 text-[#6a8792]">
												Oppure trascina qui i file del trimestre
											</span>
										</label>

										{#if filesFor(kind).length}
											<div class="mt-4 rounded-[1.2rem] border border-[#e1eaee] bg-white px-4 py-4">
												<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">
													{filesFor(kind).length} file • {totalBytesLabel(filesFor(kind))}
												</p>
												<ul class="mt-3 grid gap-2 text-sm leading-6 text-[#173843]">
													{#each filesFor(kind) as file}
														<li class="break-all">{file.name}</li>
													{/each}
												</ul>
											</div>
										{:else}
											<p class="mt-4 text-sm leading-6 text-[#7a8f98]">Nessun CSV selezionato.</p>
										{/if}
									</div>
								{/each}
							</div>
						</div>

						<div class="rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
							<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Controlli</p>
							<h2 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Calcolo e recupero credito</h2>

							<label class="mt-6 block text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]" for="previous-credit">
								IVA a credito trimestre precedente
							</label>
							<input
								id="previous-credit"
								class="mt-2 min-h-12 w-full rounded-2xl border border-[#d6e2e7] bg-white px-4 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]"
								type="text"
								inputmode="decimal"
								placeholder="Es. 350,00"
								bind:value={previousQuarterCreditInput}
							/>
							<p class="mt-2 text-sm leading-6 text-[#5a707a]">
								Questo importo resta separato dal saldo classico del trimestre e viene applicato solo nel riepilogo finale.
							</p>

							<label class="mt-6 flex items-start gap-3 rounded-[1.2rem] border border-[#dce7eb] bg-[#f8fbfc] px-4 py-4">
								<input class="mt-1 h-4 w-4 rounded border-[#bfd2d9]" type="checkbox" bind:checked={disclaimerAccepted} />
								<span class="text-sm leading-6 text-[#35535d]">
									Confermo di aver letto l’avviso: i risultati non sono dati certi, non sostituiscono un commercialista e non vengono salvati.
								</span>
							</label>

							<div class="mt-6 flex flex-wrap gap-3">
								<button
									class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#0f5d6c] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.22)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
									type="button"
									onclick={handleCalculate}
									disabled={pending}
								>
									{pending ? 'Calcolo in corso...' : 'Calcola'}
								</button>
								<button
									class="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5"
									type="button"
									onclick={clearAll}
								>
									Azzera tutto
								</button>
							</div>

							{#if errorMessage}
								<div class="mt-5 rounded-[1.4rem] border border-[#f1c7c7] bg-[#fff5f5] px-4 py-3 text-sm leading-6 text-[#8f4040]">
									{errorMessage}
								</div>
							{/if}
						</div>
					</section>

					{#if report}
						{@const tone = reportTone(report.finalBalance)}
						<section class="mt-6 rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
							<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Report</p>
							<h2 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844]">
								Calcolo IVA {selectedQuarter} {selectedYear}
							</h2>

							<div class={`mt-6 rounded-[1.6rem] border px-5 py-5 ${tone.panel}`}>
								<div class="flex flex-wrap items-center gap-3">
									<span class={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${tone.badge}`}>
										{tone.label}
									</span>
									<p class="text-3xl font-extrabold tracking-[-0.06em] text-[#173843]">
										{formatEuro(Math.abs(report.finalBalance))}
									</p>
								</div>
								<p class="mt-3 text-sm leading-6 text-[#35535d]">
									Saldo classico del trimestre: {formatEuro(report.quarterBalance)}.
									Credito precedente applicato: {formatEuro(report.previousCredit)}.
									Saldo finale dopo recupero credito: {formatEuro(report.finalBalance)}.
								</p>
							</div>

							<div class="mt-6 grid gap-4 lg:grid-cols-3">
								<div class="rounded-[1.4rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
									<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">IVA a debito da fatture emesse</p>
									<p class="mt-3 text-2xl font-extrabold tracking-[-0.05em] text-[#173843]">{formatEuro(report.issued.vat)}</p>
								</div>
								<div class="rounded-[1.4rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
									<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">IVA da corrispettivi</p>
									<p class="mt-3 text-2xl font-extrabold tracking-[-0.05em] text-[#173843]">{formatEuro(report.receipts.vat)}</p>
								</div>
								<div class="rounded-[1.4rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
									<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">IVA detraibile da fatture ricevute</p>
									<p class="mt-3 text-2xl font-extrabold tracking-[-0.05em] text-[#173843]">{formatEuro(report.received.vat)}</p>
								</div>
							</div>

							<div class="mt-6 overflow-hidden rounded-[1.5rem] border border-[#e3edf1] bg-white">
								<div class="grid gap-px bg-[#e3edf1] sm:grid-cols-2 lg:grid-cols-4">
									<div class="bg-[#f8fbfc] px-4 py-4">
										<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">IVA vendite + corrispettivi</p>
										<p class="mt-2 text-lg font-bold text-[#173843]">{formatEuro(report.outputVat)}</p>
									</div>
									<div class="bg-[#f8fbfc] px-4 py-4">
										<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">IVA acquisti</p>
										<p class="mt-2 text-lg font-bold text-[#173843]">{formatEuro(report.inputVat)}</p>
									</div>
									<div class="bg-[#f8fbfc] px-4 py-4">
										<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Saldo trimestre</p>
										<p class="mt-2 text-lg font-bold text-[#173843]">{formatEuro(report.quarterBalance)}</p>
									</div>
									<div class="bg-[#f8fbfc] px-4 py-4">
										<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Dopo credito precedente</p>
										<p class="mt-2 text-lg font-bold text-[#173843]">{formatEuro(report.finalBalance)}</p>
									</div>
								</div>
							</div>

							<div class="mt-6 grid gap-4 xl:grid-cols-3">
								{#each [
									{ label: 'Fatture emesse', data: report.issued },
									{ label: 'Fatture ricevute', data: report.received },
									{ label: 'Corrispettivi', data: report.receipts }
								] as block}
									<div class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
										<h3 class="text-lg font-bold tracking-[-0.03em] text-[#173843]">{block.label}</h3>
										<div class="mt-4 grid gap-2 text-sm leading-6 text-[#5a707a]">
											<p>File letti: <strong class="text-[#173843]">{block.data.filesCount}</strong></p>
											<p>Righe totali: <strong class="text-[#173843]">{block.data.totalRows}</strong></p>
											<p>Righe riconosciute: <strong class="text-[#173843]">{block.data.recognizedRows}</strong></p>
											<p>Righe saltate: <strong class="text-[#173843]">{block.data.skippedRows}</strong></p>
											<p>Imponibile: <strong class="text-[#173843]">{formatEuro(block.data.taxable)}</strong></p>
											<p>IVA: <strong class="text-[#173843]">{formatEuro(block.data.vat)}</strong></p>
										</div>

										{#if block.data.issues.length}
											<div class="mt-4 rounded-[1.2rem] border border-[#f4d889] bg-[#fff8eb] px-4 py-4">
												<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6c00]">Attenzioni</p>
												<ul class="mt-3 grid gap-2 text-sm leading-6 text-[#6f5b2f]">
													{#each block.data.issues as issue}
														<li>{issue}</li>
													{/each}
												</ul>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</section>
					{/if}
				</div>
			</main>
		</div>
	</div>
</div>
