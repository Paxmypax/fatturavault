<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		authState,
		initAuth,
		isSecurityOnboardingComplete,
		logout,
		saveDisplayName
	} from '$lib/auth';
	import {
		askRemoteAiVault,
		fetchRemoteDashboardSuggestions,
		fetchRemoteVaultCounts,
		generateRemoteAiVaultSummary,
		type RemoteDashboardSuggestion,
		type RemoteAiVaultChatAnswer,
		type RemoteAiVaultSummary,
		type RemoteVaultCounts
	} from '$lib/ic/vaultBackend';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import { addPostIt, initPostIts, postitState, removePostIt, togglePostIt } from '$lib/postits';
	import { analyticsAccessState, initAnalyticsAccess } from '$lib/stores/analyticsAccess';
	import { categoriesState, getCategoryByName, initCategories } from '$lib/stores/categories';
	import { initVault, vaultState } from '$lib/vault';
	import { onMount } from 'svelte';

	type DashboardSuggestionView = RemoteDashboardSuggestion & {
		id: string;
		ctaAction?: 'open-postits';
	};

	onMount(async () => {
		await initAuth();

		if (!$authState.authenticated) {
			await goto('/');
			return;
		}

		if (!isSecurityOnboardingComplete($authState)) {
			await goto('/sicurezza');
			return;
		}

		await initVault();
		initCategories();
		initPostIts();
		void initAnalyticsAccess();
		void refreshVaultCounts();
		void refreshDashboardSuggestions();
	});

	let displayNameInput = $state('');
	let showDisplayNameEditor = $state(false);
	let showPostItPanel = $state(false);
	let postItInput = $state('');
	let aiSummaryPending = $state(false);
	let aiSummaryError = $state('');
	let aiSummary = $state<RemoteAiVaultSummary | null>(null);
	let vaultCounts = $state<RemoteVaultCounts | null>(null);
	let dashboardSuggestions = $state<RemoteDashboardSuggestion[]>([]);
	let dashboardSuggestionsPending = $state(false);
	let dashboardSuggestionsError = $state('');
	let aiQuestion = $state('');
	let aiChatPending = $state(false);
	let aiChatError = $state('');
	let aiChatAnswer = $state<RemoteAiVaultChatAnswer | null>(null);

	function principalLabel(principal: string | null) {
		if (!principal) {
			return 'Sessione attiva';
		}

		if (principal.length <= 18) {
			return principal;
		}

		return `${principal.slice(0, 10)}...${principal.slice(-6)}`;
	}

	$effect(() => {
		if ($authState.displayName && !$authState.pending) {
			displayNameInput = $authState.displayName;
		}
	});

	function normalizeAiChatError(error: unknown) {
		if (!(error instanceof Error)) {
			return 'Impossibile ottenere una risposta dalla chat AI.';
		}

		if (error.message.includes('20 domande AI oggi')) {
			return 'Hai raggiunto il limite di 20 domande AI oggi. Riprova domani.';
		}

		return error.message;
	}

	async function handleDisplayNameSave() {
		if (!displayNameInput.trim()) {
			return;
		}

		await saveDisplayName(displayNameInput);
		showDisplayNameEditor = false;
	}

	function latestVaultSync(documents: { updatedAt: string }[]) {
		if (!documents.length) {
			return 'Mai';
		}

		const lastUpdated = documents.reduce((latest, current) =>
			new Date(current.updatedAt).getTime() > new Date(latest.updatedAt).getTime() ? current : latest
		);

		const date = new Date(lastUpdated.updatedAt);
		return Number.isNaN(date.getTime())
			? 'Mai'
			: new Intl.DateTimeFormat('it-IT', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				}).format(date);
	}

	function formatDocumentDate(iso: string) {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) {
			return 'Data non disponibile';
		}

		return new Intl.DateTimeFormat('it-IT', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}

	function relativeTime(iso: string) {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) {
			return 'Ora';
		}

		const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
		if (minutes < 60) {
			return `${minutes} min fa`;
		}

		const hours = Math.round(minutes / 60);
		if (hours < 24) {
			return `${hours} h fa`;
		}

		const days = Math.round(hours / 24);
		return `${days} gg fa`;
	}

	function activityLabel(type: string) {
		switch (type) {
			case 'processed':
				return 'Documento archiviato';
			case 'uploaded':
				return 'Documento caricato';
			case 'deleted':
				return 'Documento eliminato';
			default:
				return 'Documento aggiornato';
		}
	}

	function activityDescription(activity: (typeof $vaultState.activities)[number]) {
		const label = activity.documentTitle || activity.documentName;
		if (activity.type === 'processed' && activity.categoryName) {
			return `${label} in ${activity.categoryName}`;
		}

		return label;
	}

	function handleAddPostIt() {
		if (!addPostIt(postItInput)) {
			return;
		}

		postItInput = '';
	}

	async function handleGenerateAiSummary() {
		aiSummaryPending = true;
		aiSummaryError = '';
		try {
			aiSummary = await generateRemoteAiVaultSummary();
			if (!aiSummary) {
				aiSummaryError = 'Non riesco a generare il riepilogo AI in questa sessione.';
			}
		} catch (error) {
			aiSummaryError =
				error instanceof Error ? error.message : 'Impossibile generare il riepilogo AI.';
		} finally {
			aiSummaryPending = false;
		}
	}

	async function refreshVaultCounts() {
		try {
			await initVault();
			vaultCounts = await fetchRemoteVaultCounts();
		} catch {
			vaultCounts = null;
		}
	}

	async function refreshDashboardSuggestions() {
		dashboardSuggestionsPending = true;
		dashboardSuggestionsError = '';
		try {
			dashboardSuggestions = (await fetchRemoteDashboardSuggestions()) ?? [];
		} catch (error) {
			dashboardSuggestions = [];
			dashboardSuggestionsError =
				error instanceof Error
					? error.message
					: 'Impossibile caricare i suggerimenti del vault.';
		} finally {
			dashboardSuggestionsPending = false;
		}
	}

	function suggestionToneClasses(tone: string) {
		switch (tone) {
			case 'warning':
				return {
					panel: 'border-[#f5d6a3] bg-[#fff8eb]',
					badge: 'bg-[#fff0cc] text-[#9a5b00]'
				};
			case 'positive':
				return {
					panel: 'border-[#cfe7d8] bg-[#f2fbf5]',
					badge: 'bg-[#dcf5e4] text-[#1d6b3a]'
				};
			default:
				return {
					panel: 'border-[#d8e8ed] bg-[#eef8fa]',
					badge: 'bg-[#dff1f3] text-[#0f5d6c]'
				};
		}
	}

	async function handleAskAiVault() {
		if (!aiQuestion.trim()) {
			aiChatError = 'Scrivi una domanda per la chat AI.';
			return;
		}

		aiChatPending = true;
		aiChatError = '';
		try {
			aiChatAnswer = await askRemoteAiVault(aiQuestion.trim());
			if (!aiChatAnswer) {
				aiChatError = 'Non riesco a interrogare la chat AI in questa sessione.';
			}
		} catch (error) {
			aiChatError = normalizeAiChatError(error);
		} finally {
			aiChatPending = false;
		}
	}

	const orderedPostIts = $derived(
		[...$postitState.notes].sort((a, b) => {
			if (a.completed !== b.completed) {
				return a.completed ? 1 : -1;
			}

			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		})
	);

	const pendingPostIts = $derived(orderedPostIts.filter((note) => !note.completed));

	const localPostItSuggestion = $derived.by<DashboardSuggestionView | null>(() => {
		if (!pendingPostIts.length) {
			return null;
		}

		const preview = pendingPostIts
			.slice(0, 2)
			.map((note) => `"${note.text}"`)
			.join(' e ');

		const body =
			pendingPostIts.length === 1
				? `Hai un promemoria aperto nei post-it: ${preview}.`
				: `Hai ${pendingPostIts.length} promemoria aperti nei post-it. I primi da ricordare sono ${preview}.`;

		return {
			id: 'postits-reminder',
			title: pendingPostIts.length === 1 ? 'Hai un post-it da ricordare' : 'Hai post-it ancora aperti',
			body,
			tone: 'warning',
			ctaLabel: 'Apri post-it',
			ctaHref: '',
			ctaAction: 'open-postits'
		};
	});

	const visibleDashboardSuggestions = $derived<DashboardSuggestionView[]>([
		...(localPostItSuggestion ? [localPostItSuggestion] : []),
		...dashboardSuggestions.map((suggestion, index) => ({
			...suggestion,
			id: `remote-${index}`
		}))
	]);

	const processedDocuments = $derived(
		[...$vaultState.documents]
			.filter((document) => document.status === 'processed')
			.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
	);

	const processedDocumentsCount = $derived(
		vaultCounts?.processedDocuments ?? processedDocuments.length
	);

	const recentActivities = $derived(
		[...$vaultState.activities]
			.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
			.slice(0, 5)
	);
</script>

<svelte:head>
	<title>Dashboard | Fattura Vault</title>
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
				<a class="flex w-full items-center gap-3 rounded-2xl bg-[#0f5d6c] px-4 py-4 text-left text-lg font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.18)]" href="/dashboard">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24">
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
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" data-sveltekit-preload-code="eager" data-sveltekit-preload-data="tap" href="/vault">
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
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" href="/iva-trimestrale">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0 text-[#3e5963]" fill="none" viewBox="0 0 24 24">
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

					<div class="relative">
						<button class="flex items-center gap-3 rounded-full border border-white/80 bg-white/82 px-4 py-3 shadow-[0_10px_25px_rgba(148,163,184,0.1)] transition-transform hover:-translate-y-0.5" type="button" onclick={() => (showDisplayNameEditor = !showDisplayNameEditor)}>
							<p class="max-w-[12rem] truncate text-base font-semibold text-[#183843]">
								{$authState.displayName ?? principalLabel($authState.principal)}
							</p>
							<svg aria-hidden="true" class="h-4 w-4 text-[#58707a]" fill="none" viewBox="0 0 24 24">
								<path d="m6 9 6 6 6-6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
							</svg>
						</button>

						{#if showDisplayNameEditor}
							<div class="absolute right-0 z-20 mt-3 w-[20rem] rounded-[1.4rem] border border-[#dce9ed] bg-white p-4 shadow-[0_24px_60px_rgba(148,163,184,0.18)]">
								<p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#6a8792]">Profilo</p>
								<h2 class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#103844]">Modifica nome</h2>
								<p class="mt-2 text-sm leading-6 text-[#58707a]">Scegli il nome da mostrare nella dashboard.</p>

								<input class="mt-4 min-h-12 w-full rounded-2xl border border-[#d6e2e7] bg-white px-4 text-base font-medium text-[#173843] outline-none ring-0 placeholder:text-[#8aa0aa] focus:border-[#0f5d6c]" type="text" bind:value={displayNameInput} placeholder="Es. Mario Rossi" />

								<div class="mt-4 flex gap-3">
									<button class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#0f5d6c] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.22)] transition-transform hover:-translate-y-0.5" type="button" onclick={handleDisplayNameSave}>
										Salva
									</button>
									<button class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5" type="button" onclick={() => (showDisplayNameEditor = false)}>
										Chiudi
									</button>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</header>

			<main class="flex-1 px-5 py-6 sm:px-8 lg:px-10">
				<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
					<div>
						<h1 class="text-[2.4rem] font-extrabold tracking-[-0.05em] text-[#0f5666] sm:text-[3.4rem]">
							LA TUA DASHBOARD
						</h1>

						{#if !$authState.security?.ackBackupDevice}
							<div class="mt-4 rounded-[1.5rem] border border-[#f4d889] bg-[linear-gradient(135deg,rgba(255,249,235,0.98),rgba(255,255,255,0.95))] p-4 shadow-[0_16px_36px_rgba(200,169,110,0.14)]">
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6c00]">Sicurezza</p>
								<div class="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
									<div>
										<p class="text-base font-bold tracking-[-0.02em] text-[#173843]">Aggiungi un dispositivo di backup per proteggere il tuo vault.</p>
										<p class="mt-1 text-sm leading-6 text-[#6f5b2f]">
											Hai completato il passaggio minimo di sicurezza, ma ti consigliamo di configurare anche un metodo di accesso di riserva in Internet Identity.
										</p>
									</div>
									<a
										class="inline-flex items-center justify-center rounded-2xl bg-[#c8a96e] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(200,169,110,0.24)] transition-transform hover:-translate-y-0.5"
										href="/impostazioni"
									>
										Vai a sicurezza
									</a>
								</div>
							</div>
						{/if}

						<div class="mt-6 grid gap-4 lg:grid-cols-2">
							<div class="rounded-[1.9rem] border border-white/90 bg-white/82 px-5 py-4 shadow-[0_18px_45px_rgba(148,163,184,0.14)] backdrop-blur">
								<div class="grid min-h-[124px] grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
									<div class="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-[1.3rem] bg-[#d7e8ec] text-[#1b5f6f]">
										<svg aria-hidden="true" class="h-11 w-11" fill="none" viewBox="0 0 24 24">
											<rect x="4.5" y="4.5" width="15" height="15" rx="2.6" stroke="currentColor" stroke-width="1.6" />
											<path d="M8 9.2h8M8 12h8M8 14.8h5.2" stroke="currentColor" stroke-linecap="round" stroke-width="1.6" />
											<circle cx="16.5" cy="16.3" r="2.4" stroke="currentColor" stroke-width="1.5" />
										</svg>
									</div>
									<div class="flex min-h-[80px] flex-col justify-center">
										<p class="text-[1.1rem] font-medium leading-6 text-[#1f3037]">File Archiviati</p>
										<p class="mt-2 text-[3.15rem] leading-none font-extrabold tracking-[-0.07em] text-[#103844]">
											{processedDocumentsCount}
										</p>
									</div>
								</div>
							</div>

							<div class="rounded-[1.9rem] border border-white/90 bg-white/82 px-5 py-4 shadow-[0_18px_45px_rgba(148,163,184,0.14)] backdrop-blur">
								<div class="flex min-h-[124px] flex-col justify-center">
									<p class="text-[1.1rem] font-medium leading-6 text-[#1f3037]">Ultima Sincronizzazione</p>
									<p class="mt-2 text-[2.25rem] leading-none font-extrabold tracking-[-0.06em] text-[#103844]">
										{latestVaultSync(processedDocuments)}
									</p>
								</div>
							</div>
						</div>

						<section class="mt-6 rounded-[2rem] border border-white/85 bg-white/76 p-5 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-6">
							<div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
								<div>
									<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Suggerimenti intelligenti</p>
									<h2 class="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Cose utili da controllare oggi</h2>
									<p class="mt-2 text-sm leading-6 text-[#5c727c]">
										Indicazioni operative costruite sui dati reali del tuo vault: pagamenti, scadenze, ordine dell'archivio e spese ricorrenti.
									</p>
								</div>
								<button
									class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-4 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
									type="button"
									onclick={refreshDashboardSuggestions}
									disabled={dashboardSuggestionsPending}
								>
									{dashboardSuggestionsPending ? 'Aggiorno...' : 'Aggiorna suggerimenti'}
								</button>
							</div>

							{#if dashboardSuggestionsError}
								<div class="mt-5 rounded-[1.4rem] border border-[#f1c7c7] bg-[#fff5f5] px-4 py-3 text-sm leading-6 text-[#8f4040]">
									{dashboardSuggestionsError}
								</div>
							{/if}

							{#if dashboardSuggestionsPending && !visibleDashboardSuggestions.length}
								<div class="mt-5 rounded-[1.6rem] border border-[#d8e8ed] bg-[#eef8fa] px-4 py-4 text-sm leading-6 text-[#22505d]">
									Sto rileggendo il vault per preparare i suggerimenti di oggi.
								</div>
							{:else if visibleDashboardSuggestions.length}
								<div class="mt-5 grid gap-4 xl:grid-cols-2">
									{#each visibleDashboardSuggestions as suggestion (suggestion.id)}
										{@const toneClasses = suggestionToneClasses(suggestion.tone)}
										<div class={`rounded-[1.5rem] border px-5 py-5 shadow-[0_12px_28px_rgba(148,163,184,0.10)] ${toneClasses.panel}`}>
											<span class={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${toneClasses.badge}`}>
												{suggestion.tone === 'warning' ? 'Attenzione' : suggestion.tone === 'positive' ? 'In ordine' : 'Focus'}
											</span>
											<h3 class="mt-3 text-lg font-bold tracking-[-0.03em] text-[#173843]">{suggestion.title}</h3>
											<p class="mt-3 text-sm leading-6 text-[#35535d]">{suggestion.body}</p>
											{#if suggestion.ctaAction === 'open-postits' && suggestion.ctaLabel}
												<button
													class="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#cfe0e5] bg-white px-4 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5"
													type="button"
													onclick={() => (showPostItPanel = true)}
												>
													{suggestion.ctaLabel}
												</button>
											{:else if suggestion.ctaLabel && suggestion.ctaHref}
												<a
													class="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#cfe0e5] bg-white px-4 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5"
													href={suggestion.ctaHref}
												>
													{suggestion.ctaLabel}
												</a>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</section>

						<section class="mt-6 rounded-[2rem] border border-white/85 bg-[linear-gradient(135deg,rgba(12,92,107,0.08),rgba(255,255,255,0.88))] p-5 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-6">
							<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
								<div class="max-w-3xl">
									<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">AI on-chain</p>
									<h2 class="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Riepilogo del vault</h2>
									<p class="mt-2 text-sm leading-6 text-[#5c727c]">
										Genera un riepilogo testuale dai dati già strutturati del tuo archivio: documenti, importi, categorie e attività recenti.
									</p>
								</div>
								<button
									class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#0f5d6c] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.22)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
									type="button"
									onclick={handleGenerateAiSummary}
									disabled={aiSummaryPending}
								>
									{aiSummaryPending ? 'Genero riepilogo...' : aiSummary ? 'Rigenera riepilogo AI' : 'Genera riepilogo AI'}
								</button>
							</div>

							{#if aiSummaryError}
								<div class="mt-5 rounded-[1.4rem] border border-[#f1c7c7] bg-[#fff5f5] px-4 py-3 text-sm leading-6 text-[#8f4040]">
									{aiSummaryError}
								</div>
							{/if}

							{#if aiSummary}
								<div class="mt-5 rounded-[1.7rem] border border-[#d9e8ec] bg-white/90 p-5">
									<div class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">
										<span>{aiSummary.provider === 'ic-onchain' ? 'LLM on-chain ICP' : aiSummary.provider}</span>
										<span>•</span>
										<span>{aiSummary.model}</span>
										<span>•</span>
										<span>{formatDocumentDate(aiSummary.generatedAt)}</span>
									</div>
									<p class="mt-4 text-base leading-7 text-[#173843]">{aiSummary.summary}</p>

									{#if aiSummary.highlights.length}
										<div class="mt-5 grid gap-3 sm:grid-cols-2">
											{#each aiSummary.highlights as highlight}
												<div class="rounded-[1.25rem] border border-[#e4edf1] bg-[#f8fbfc] px-4 py-3 text-sm font-medium leading-6 text-[#173843]">
													{highlight}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{:else if aiSummaryPending}
								<div class="mt-5 rounded-[1.7rem] border border-[#d9e8ec] bg-white/90 p-5 text-sm leading-6 text-[#5c727c]">
									Sto leggendo i dati del vault e preparando un riepilogo operativo.
								</div>
							{/if}

							<div class="mt-5 rounded-[1.7rem] border border-[#d9e8ec] bg-white/90 p-5">
								<div class="flex flex-col gap-3 lg:flex-row lg:items-end">
								<div class="min-w-0 flex-1">
									<label class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]" for="vault-ai-question">
										Chat AI del vault
									</label>
									<p class="mt-2 text-xs leading-5 text-[#6a8792]">
										Massimo 20 domande al giorno per account.
									</p>
									<input
										id="vault-ai-question"
										class="mt-2 min-h-12 w-full rounded-2xl border border-[#d6e2e7] bg-white px-4 text-sm font-medium text-[#173843] outline-none ring-0 placeholder:text-[#8aa0aa] focus:border-[#0f5d6c]"
											type="text"
											bind:value={aiQuestion}
											placeholder="Es. Quanto ho speso in hosting?"
											onkeydown={(event) => {
												if (event.key === 'Enter') {
													handleAskAiVault();
												}
											}}
										/>
									</div>
									<button
										class="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
										type="button"
										onclick={handleAskAiVault}
										disabled={aiChatPending}
									>
										{aiChatPending ? 'Sto rispondendo...' : 'Chiedi al vault'}
									</button>
								</div>

								<div class="mt-3 flex flex-wrap gap-2">
									<button class="rounded-full bg-[#eef6f8] px-3 py-1.5 text-xs font-semibold text-[#0f5d6c]" type="button" onclick={() => (aiQuestion = 'Quali documenti risultano da pagare?')}>
										Quali documenti risultano da pagare?
									</button>
									<button class="rounded-full bg-[#eef6f8] px-3 py-1.5 text-xs font-semibold text-[#0f5d6c]" type="button" onclick={() => (aiQuestion = 'Quanto ho speso in hosting e server?')}>
										Quanto ho speso in hosting e server?
									</button>
									<button class="rounded-full bg-[#eef6f8] px-3 py-1.5 text-xs font-semibold text-[#0f5d6c]" type="button" onclick={() => (aiQuestion = 'Mi fai un riepilogo IVA delle fatture?')}>
										Mi fai un riepilogo IVA delle fatture?
									</button>
									<button class="rounded-full bg-[#eef6f8] px-3 py-1.5 text-xs font-semibold text-[#0f5d6c]" type="button" onclick={() => (aiQuestion = 'Ci sono documenti con scadenza o rinnovo?')}>
										Ci sono documenti con scadenza o rinnovo?
									</button>
									<button class="rounded-full bg-[#eef6f8] px-3 py-1.5 text-xs font-semibold text-[#0f5d6c]" type="button" onclick={() => (aiQuestion = 'Hai un riepilogo delle garanzie?')}>
										Hai un riepilogo delle garanzie?
									</button>
								</div>

								{#if aiChatError}
									<div class="mt-4 rounded-[1.4rem] border border-[#f1c7c7] bg-[#fff5f5] px-4 py-3 text-sm leading-6 text-[#8f4040]">
										{aiChatError}
									</div>
								{/if}

								{#if aiChatAnswer}
									<div class="mt-4 rounded-[1.4rem] border border-[#e4edf1] bg-[#f8fbfc] px-4 py-4">
										<div class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">
											<span>{aiChatAnswer.provider === 'ic-onchain' ? 'LLM on-chain ICP' : aiChatAnswer.provider}</span>
											<span>•</span>
											<span>{aiChatAnswer.model}</span>
											<span>•</span>
											<span>{formatDocumentDate(aiChatAnswer.generatedAt)}</span>
										</div>
										<p class="mt-3 text-sm leading-7 text-[#173843]">{aiChatAnswer.answer}</p>
									</div>
								{:else if aiChatPending}
									<div class="mt-4 rounded-[1.4rem] border border-[#e4edf1] bg-[#f8fbfc] px-4 py-4 text-sm leading-6 text-[#5c727c]">
										Sto consultando i dati strutturati del vault per risponderti.
									</div>
								{/if}
							</div>
						</section>

						<section class="mt-6 rounded-[2rem] border border-white/85 bg-white/76 p-5 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-6">
							<div>
								<h2 class="text-2xl font-bold tracking-[-0.04em] text-[#103844]">Il tuo vault</h2>
								<p class="mt-2 text-sm leading-6 text-[#5c727c]">
									Qui trovi una panoramica dei file principali che hai inserito e degli ultimi documenti passati dal tuo archivio.
								</p>
							</div>

							<div class="mt-6 rounded-[1.7rem] border border-[#e3edf1] bg-white/85 p-6">
								{#if processedDocuments.length}
									<div class="grid gap-3">
										{#each processedDocuments.slice(0, 4) as document}
											{@const category = getCategoryByName(document.categoryName, $categoriesState)}
											<div class={`flex flex-col gap-4 rounded-[1.35rem] border bg-white px-4 py-4 shadow-[0_10px_24px_rgba(148,163,184,0.08)] md:flex-row md:items-center md:justify-between ${document.paymentStatus === 'due' ? 'border-[#dc2626] bg-[#fff8f8]' : 'border-[#e8eff2]'}`}>
												<div class="min-w-0">
													<p class="break-all text-lg font-semibold tracking-[-0.02em] text-[#173843] sm:break-normal sm:truncate">
														{document.title || document.name}
													</p>
													<p class="mt-1 text-sm text-[#5a707a]">
														{document.categoryName} · {formatDocumentDate(document.updatedAt)}
													</p>
												</div>
												<div class="flex flex-wrap items-center gap-2">
													<span
														class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
														style={`background-color: ${(category?.color ?? '#6B7280')}20; color: ${category?.color ?? '#6B7280'};`}
													>
														{document.status === 'processed' ? 'Archiviato' : 'In inbox'}
													</span>
													{#if document.paymentStatus === 'due'}
														<span class="inline-flex rounded-full bg-[#fff1f1] px-3 py-1 text-xs font-semibold text-[#b42318]">
															Da pagare
														</span>
													{/if}
													<a class="inline-flex items-center justify-center rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" href={`/documento?id=${encodeURIComponent(document.id)}`}>
														Apri
													</a>
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<div class="flex flex-col gap-6">
										<div class="flex items-start gap-4">
											<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.3rem] bg-[#dff1f3] text-[#0f5d6c]">
												<svg aria-hidden="true" class="h-8 w-8" fill="none" viewBox="0 0 24 24">
													<path d="M5 7.8A2.8 2.8 0 0 1 7.8 5h3.7l1.7 1.9h3.8A2.8 2.8 0 0 1 19.8 9.7V16.2A2.8 2.8 0 0 1 17 19H7.8A2.8 2.8 0 0 1 5 16.2V7.8Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7" />
													<path d="M8.5 11.2h7M8.5 14.5h5.2" stroke="currentColor" stroke-linecap="round" stroke-width="1.7" />
												</svg>
											</div>
											<div class="max-w-2xl">
												<h3 class="text-2xl font-bold tracking-[-0.03em] text-[#173843]">Nessun documento nel vault</h3>
												<p class="mt-2 text-sm leading-6 text-[#5a707a]">
													L'esperienza giusta qui è semplice: carichi tutto al volo, poi sistemi i documenti quando hai tempo. Quando inizierai a usare l'app, questo spazio diventerà il centro del tuo archivio.
												</p>
											</div>
										</div>

										<div class="grid gap-3 md:grid-cols-3">
											<div class="rounded-[1.3rem] border border-[#e7eef2] bg-[#f9fcfd] px-4 py-4">
												<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Formato</p>
												<p class="mt-2 text-base font-semibold text-[#173843]">PDF, DOC, XML, immagini, CSV</p>
											</div>
											<div class="rounded-[1.3rem] border border-[#e7eef2] bg-[#f9fcfd] px-4 py-4">
												<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Approccio</p>
												<p class="mt-2 text-base font-semibold text-[#173843]">Carica ora, organizza dopo</p>
											</div>
											<div class="rounded-[1.3rem] border border-[#e7eef2] bg-[#f9fcfd] px-4 py-4">
												<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Sicurezza</p>
												<p class="mt-2 text-base font-semibold text-[#173843]">Archivio privato su blockchain</p>
											</div>
										</div>
									</div>
								{/if}
							</div>
						</section>
					</div>

					<aside class="relative z-10 rounded-[2rem] border border-white/85 bg-white/76 p-5 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-6">
						<h2 class="text-2xl font-bold tracking-[-0.04em] text-[#103844]">Attività recenti</h2>

						{#if recentActivities.length}
							<div class="mt-6 space-y-4">
								{#each recentActivities as activity}
									<div class="rounded-[1.4rem] border border-[#e3edf1] bg-white/80 p-4">
										<div class="flex items-start gap-3">
											<div class="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#0f5d6c]"></div>
											<div>
												<p class="text-base font-bold tracking-[-0.02em] text-[#173843]">
													{activityLabel(activity.type)}
												</p>
												<p class="mt-1 text-sm leading-6 text-[#5a707a]">{activityDescription(activity)}</p>
												<p class="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">
													{relativeTime(activity.at)}
												</p>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="mt-6 rounded-[1.7rem] border border-[#e3edf1] bg-white/80 p-5">
								<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dff1f3] text-[#0f5d6c]">
									<svg aria-hidden="true" class="h-7 w-7" fill="none" viewBox="0 0 24 24">
										<path d="M7.5 6.5h9m-9 4h9m-9 4H13m6.5 5H4.5A1.5 1.5 0 0 1 3 18V6A1.5 1.5 0 0 1 4.5 4.5h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
									</svg>
								</div>

								<h3 class="mt-5 text-xl font-bold tracking-[-0.03em] text-[#173843]">Nessuna attività recente</h3>
								<p class="mt-2 text-sm leading-6 text-[#5a707a]">
									Qui compariranno gli ultimi movimenti del tuo vault: accessi, documenti caricati, rinomine e azioni importanti.
								</p>
							</div>
						{/if}
					</aside>
				</div>
			</main>
		</div>
	</div>

	<button
		class="fixed bottom-6 right-6 z-30 inline-flex min-h-14 items-center gap-3 rounded-full border border-[#cde0e5] bg-white px-5 py-3 text-sm font-semibold text-[#173843] shadow-[0_20px_40px_rgba(15,35,48,0.16)] transition-transform hover:-translate-y-0.5"
		type="button"
		onclick={() => (showPostItPanel = !showPostItPanel)}
	>
		<span class="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-[#fff0a8] text-[#8c6c00] shadow-[inset_0_-4px_0_rgba(0,0,0,0.06)]">
			<svg aria-hidden="true" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24">
				<path d="M6 5.8A1.8 1.8 0 0 1 7.8 4h8.4A1.8 1.8 0 0 1 18 5.8v8.8L13.6 20H7.8A1.8 1.8 0 0 1 6 18.2V5.8Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7" />
				<path d="M13.5 20v-4.1a1.4 1.4 0 0 1 1.4-1.4H18" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7" />
			</svg>
		</span>
		Post-it
	</button>

	{#if showPostItPanel}
		<div class="fixed inset-y-0 right-0 z-40 w-full max-w-[360px] border-l border-[#dbe6ea] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.98))] px-5 py-6 shadow-[-18px_0_45px_rgba(15,35,48,0.12)] backdrop-blur">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Dashboard</p>
					<h2 class="mt-2 text-[2rem] font-extrabold tracking-[-0.04em] text-[#103844]">Post-it</h2>
					<p class="mt-2 text-sm leading-6 text-[#5a707a]">
						Appunti veloci per ricordarti chiamate, scadenze e richieste.
					</p>
				</div>

				<button
					class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white text-[#173843] transition-transform hover:-translate-y-0.5"
					type="button"
					onclick={() => (showPostItPanel = false)}
					aria-label="Chiudi pannello post-it"
				>
					<svg aria-hidden="true" class="h-5 w-5" fill="none" viewBox="0 0 24 24">
						<path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
					</svg>
				</button>
			</div>

			<div class="mt-6 rounded-[1.6rem] border border-[#dce7eb] bg-white/92 p-4 shadow-[0_16px_36px_rgba(148,163,184,0.12)]">
				<div class="flex gap-3">
					<input
						class="min-h-12 flex-1 rounded-2xl border border-[#d6e2e7] bg-white px-4 text-sm font-medium text-[#173843] outline-none placeholder:text-[#8aa0aa] focus:border-[#0f5d6c]"
						type="text"
						bind:value={postItInput}
						placeholder="Scrivi un appunto veloce..."
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								handleAddPostIt();
							}
						}}
					/>
					<button
						class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f5d6c] text-white shadow-[0_18px_40px_rgba(15,93,108,0.22)] transition-transform hover:-translate-y-0.5"
						type="button"
						onclick={handleAddPostIt}
						aria-label="Aggiungi post-it"
					>
						<svg aria-hidden="true" class="h-5 w-5" fill="none" viewBox="0 0 24 24">
							<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
						</svg>
					</button>
				</div>
			</div>

			<div class="mt-6 grid gap-3 overflow-y-auto pb-8">
				{#if orderedPostIts.length}
					{#each orderedPostIts as note}
						<div
							class="group relative rounded-[1.45rem] border border-[rgba(23,56,67,0.08)] p-4 text-left shadow-[0_12px_28px_rgba(148,163,184,0.1)] transition-transform hover:-translate-y-0.5"
							style={`background: linear-gradient(180deg, ${note.color}, color-mix(in srgb, ${note.color} 88%, white));`}
						>
							<div
								class="pointer-events-none absolute right-0 top-0 h-14 w-14 rounded-tr-[1.45rem] [clip-path:polygon(100%_0,0_0,100%_100%)]"
								style={`background: linear-gradient(135deg, rgba(255,255,255,0.82), color-mix(in srgb, ${note.color} 55%, #d7c77d));`}
							></div>
							<div class="pr-10">
								<button
									class="block w-full text-left"
									type="button"
									onclick={() => togglePostIt(note.id)}
								>
									<p class={`text-sm font-semibold leading-6 text-[#173843] ${note.completed ? 'line-through opacity-60' : ''}`}>
										{note.text}
									</p>
								</button>
								<p class="mt-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#5f6f75]">
									{new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(note.createdAt))}
								</p>
							</div>

							{#if note.completed}
								<span class="mt-3 inline-flex rounded-full bg-white/70 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#0f5d6c]">
									Completato
								</span>
							{/if}

							<button
								class="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-[#8f4040] opacity-100 shadow-[0_8px_18px_rgba(143,64,64,0.12)] transition-opacity md:opacity-0 md:group-hover:opacity-100"
								type="button"
								aria-label="Elimina post-it"
								onclick={(event) => {
									event.stopPropagation();
									removePostIt(note.id);
								}}
							>
								<svg aria-hidden="true" class="h-4 w-4" fill="none" viewBox="0 0 24 24">
									<path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
								</svg>
							</button>
						</div>
					{/each}
				{:else}
					<div class="rounded-[1.6rem] border border-[#e3edf1] bg-white/86 p-5">
						<h3 class="text-lg font-bold tracking-[-0.03em] text-[#173843]">Nessun post-it</h3>
						<p class="mt-2 text-sm leading-6 text-[#5a707a]">
							Aggiungi il primo appunto veloce: chiamare il commercialista, ricordare una scadenza o chiedere una fattura.
						</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
