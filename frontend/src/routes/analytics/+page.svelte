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
		fetchRemoteNotificationAccessState,
		publishRemoteNotification,
		type RemoteNotificationAccessState
	} from '$lib/ic/vaultBackend';
	import {
		fetchAnalyticsAccessState as fetchAnalyticsAccessStateFromAnalytics,
		fetchAnalyticsLast30Days as fetchAnalyticsLast30DaysFromAnalytics,
		fetchAnalyticsSummary as fetchAnalyticsSummaryFromAnalytics,
		isVaultAnalyticsConfigured,
		type DailyMetrics,
		type ProductSummary
	} from '$lib/ic/vaultAnalytics';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import { onMount } from 'svelte';

	let displayNameInput = $state('');
	let showDisplayNameEditor = $state(false);
	let loading = $state(true);
	let errorMessage = $state('');
	let summary = $state<ProductSummary | null>(null);
	let last30Days = $state<DailyMetrics[]>([]);
	let accessState = $state<{ isAdmin: boolean; hasAdmins: boolean } | null>(null);
	let notificationAccess = $state<RemoteNotificationAccessState | null>(null);
	let notificationTitle = $state('');
	let notificationBody = $state('');
	let notificationPending = $state(false);
	let notificationFeedback = $state('');
	let notificationError = $state('');

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

		await loadAnalytics();
	});

	$effect(() => {
		if ($authState.displayName && !$authState.pending) {
			displayNameInput = $authState.displayName;
		}
	});

	function principalLabel(principal: string | null) {
		if (!principal) {
			return 'Sessione attiva';
		}

		if (principal.length <= 18) {
			return principal;
		}

		return `${principal.slice(0, 10)}...${principal.slice(-6)}`;
	}

	async function handleDisplayNameSave() {
		if (!displayNameInput.trim()) {
			return;
		}

		await saveDisplayName(displayNameInput);
		showDisplayNameEditor = false;
	}

	async function loadAnalytics() {
		loading = true;
		errorMessage = '';
		accessState = null;

		if (!isVaultAnalyticsConfigured()) {
			summary = null;
			last30Days = [];
			loading = false;
			return;
		}

		try {
			accessState =
				(await fetchAnalyticsAccessStateFromAnalytics()) ?? {
					isAdmin: false,
					hasAdmins: false
				};
			notificationAccess = await fetchRemoteNotificationAccessState();
			if (!accessState.isAdmin) {
				summary = null;
				last30Days = [];
				return;
			}

			const [summaryResult, metricsResult] = await Promise.all([
				fetchAnalyticsSummaryFromAnalytics(),
				fetchAnalyticsLast30DaysFromAnalytics()
			]);

			summary = summaryResult;
			last30Days = metricsResult;
		} catch (error) {
			console.warn('Impossibile caricare la dashboard analytics.', error);
			errorMessage = 'Non sono riuscito a leggere i dati analytics dal canister locale.';
		} finally {
			loading = false;
		}
	}

	async function handlePublishNotification() {
		if (!notificationAccess?.canPublish || notificationPending) {
			return;
		}

		if (!notificationTitle.trim() || !notificationBody.trim()) {
			notificationError = 'Inserisci titolo e messaggio prima di inviare.';
			notificationFeedback = '';
			return;
		}

		notificationPending = true;
		notificationError = '';
		notificationFeedback = '';

		try {
			await publishRemoteNotification(notificationTitle.trim(), notificationBody.trim());
			notificationFeedback = 'Notifica inviata agli iscritti.';
			notificationTitle = '';
			notificationBody = '';
		} catch (error) {
			notificationError =
				error instanceof Error ? error.message : 'Impossibile inviare la notifica.';
		} finally {
			notificationPending = false;
		}
	}

	function formatDay(dayKey: string) {
		const date = new Date(`${dayKey}T00:00:00`);
		if (Number.isNaN(date.getTime())) {
			return dayKey;
		}

		return new Intl.DateTimeFormat('it-IT', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		}).format(date);
	}

	function totalDailyEvents(day: DailyMetrics) {
		return (
			day.logins +
			day.securityOnboardingCompleted +
			day.documentsUploaded +
			day.documentsArchived +
			day.notesCreated
		);
	}

	const latestDay = $derived(last30Days[0] ?? null);
</script>

<svelte:head>
	<title>Analytics | Fattura Vault</title>
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
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl bg-[#0f5d6c] px-4 py-4 text-left text-lg font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.18)]" href="/analytics">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24">
						<path d="M5 18.2V10.8m7 7.4V6.8m7 11.4v-4.8" stroke="currentColor" stroke-linecap="round" stroke-width="1.9" />
						<path d="M3.8 19.2h16.4" stroke="currentColor" stroke-linecap="round" stroke-width="1.7" />
						<circle cx="5" cy="8.8" r="1.8" fill="currentColor" />
						<circle cx="12" cy="4.8" r="1.8" fill="currentColor" opacity="0.78" />
						<circle cx="19" cy="11.8" r="1.8" fill="currentColor" opacity="0.55" />
					</svg>
					Analytics
				</a>
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
								<p class="mt-2 text-sm leading-6 text-[#58707a]">Scegli il nome da mostrare nella sezione analytics.</p>

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
				<div class="mx-auto max-w-[1240px]">
					<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p class="text-xs font-semibold uppercase tracking-[0.24em] text-[#6a8792]">Numeri reali</p>
						<h1 class="mt-2 text-[2.4rem] font-extrabold tracking-[-0.05em] text-[#0f5666] sm:text-[3.4rem]">
							ANALYTICS
						</h1>
					</div>

						<button class="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#d7e2e7] bg-white px-5 text-sm font-semibold text-[#173843] shadow-[0_10px_24px_rgba(148,163,184,0.1)] transition-transform hover:-translate-y-0.5" type="button" onclick={loadAnalytics}>
							Aggiorna dati
						</button>
					</div>

					{#if !isVaultAnalyticsConfigured()}
						<section class="mt-6 rounded-[1.8rem] border border-[#e3edf1] bg-white/86 p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
							<h2 class="text-2xl font-bold tracking-[-0.03em] text-[#173843]">Analytics non configurato</h2>
							<p class="mt-3 max-w-2xl text-sm leading-6 text-[#5a707a]">
								Il frontend non trova il canister analytics. Controlla la variabile
								<code class="rounded bg-[#f4f7f8] px-1.5 py-0.5 text-xs">VITE_VAULT_ANALYTICS_CANISTER_ID</code>
								nell'ambiente locale.
							</p>
						</section>
					{:else if loading}
						<section class="mt-6 rounded-[1.8rem] border border-[#e3edf1] bg-white/86 p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
							<h2 class="text-2xl font-bold tracking-[-0.03em] text-[#173843]">Sto caricando le metriche</h2>
							<p class="mt-3 text-sm leading-6 text-[#5a707a]">
								Recupero il riepilogo prodotto e lo storico degli ultimi 30 giorni dal canister locale.
							</p>
						</section>
					{:else if errorMessage}
						<section class="mt-6 rounded-[1.8rem] border border-[#f0d1d1] bg-[#fff6f6] p-6 shadow-[0_18px_40px_rgba(185,77,77,0.1)]">
							<h2 class="text-2xl font-bold tracking-[-0.03em] text-[#8f4040]">Analytics non disponibile</h2>
							<p class="mt-3 text-sm leading-6 text-[#7e5656]">{errorMessage}</p>
						</section>
					{:else if !accessState?.isAdmin}
						<section class="mt-6 rounded-[1.8rem] border border-[#e3edf1] bg-white/86 p-6 shadow-[0_18px_40px_rgba(148,163,184,0.12)]">
							<h2 class="text-2xl font-bold tracking-[-0.03em] text-[#173843]">Accesso analytics riservato</h2>
							<p class="mt-3 max-w-2xl text-sm leading-6 text-[#5a707a]">
								Questa sezione e` disponibile solo per l'admin del progetto configurato lato canister.
								L'accesso non si attiva da questa pagina: va assegnato dal controller o da un principal admin tramite comando dedicato.
							</p>
						</section>
					{:else}
						<div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							<div class="rounded-[1.8rem] border border-white/90 bg-white/84 p-5 shadow-[0_18px_42px_rgba(148,163,184,0.14)]">
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Utenti registrati</p>
								<p class="mt-3 text-[3rem] font-extrabold tracking-[-0.07em] text-[#103844]">{summary?.totalRegisteredUsers ?? 0}</p>
								<p class="mt-2 text-sm text-[#5a707a]">Caller unici che hanno generato almeno un evento.</p>
							</div>

							<div class="rounded-[1.8rem] border border-white/90 bg-white/84 p-5 shadow-[0_18px_42px_rgba(148,163,184,0.14)]">
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Utenti attivi</p>
								<div class="mt-3 flex items-end gap-4">
									<div>
										<p class="text-[2.4rem] font-extrabold tracking-[-0.06em] text-[#103844]">{summary?.dau ?? 0}</p>
										<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">DAU</p>
									</div>
									<div>
										<p class="text-[2rem] font-extrabold tracking-[-0.06em] text-[#173843]">{summary?.wau ?? 0}</p>
										<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">WAU</p>
									</div>
									<div>
										<p class="text-[2rem] font-extrabold tracking-[-0.06em] text-[#173843]">{summary?.mau ?? 0}</p>
										<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">MAU</p>
									</div>
								</div>
								<p class="mt-2 text-sm text-[#5a707a]">Giornalieri, settimanali e mensili sugli ultimi eventi registrati.</p>
							</div>

							<div class="rounded-[1.8rem] border border-white/90 bg-white/84 p-5 shadow-[0_18px_42px_rgba(148,163,184,0.14)]">
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Eventi prodotto</p>
								<div class="mt-4 grid gap-3 sm:grid-cols-3">
									<div class="rounded-[1.2rem] bg-[#f7fafb] px-3 py-3">
										<p class="text-[1.65rem] font-extrabold tracking-[-0.05em] text-[#103844]">{summary?.totalDocumentsUploaded ?? 0}</p>
										<p class="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Upload</p>
									</div>
									<div class="rounded-[1.2rem] bg-[#f7fafb] px-3 py-3">
										<p class="text-[1.65rem] font-extrabold tracking-[-0.05em] text-[#103844]">{summary?.totalDocumentsArchived ?? 0}</p>
										<p class="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Archiviati</p>
									</div>
									<div class="rounded-[1.2rem] bg-[#f7fafb] px-3 py-3">
										<p class="text-[1.65rem] font-extrabold tracking-[-0.05em] text-[#103844]">{summary?.totalNotesCreated ?? 0}</p>
										<p class="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Note</p>
									</div>
								</div>
								<p class="mt-3 text-sm text-[#5a707a]">I tre segnali minimi per capire se il prodotto viene davvero usato.</p>
							</div>
						</div>

						{#if notificationAccess?.canPublish}
							<section class="mt-6 rounded-[1.8rem] border border-white/90 bg-white/84 p-5 shadow-[0_18px_42px_rgba(148,163,184,0.14)]">
								<div class="flex items-center justify-between gap-3">
									<div>
										<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Broadcast</p>
										<h2 class="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Invia notifica agli iscritti</h2>
									</div>
									<span class="rounded-full bg-[#eef7f9] px-3 py-1 text-xs font-semibold text-[#0f5d6c]">
										Campanella utente
									</span>
								</div>

								<p class="mt-3 max-w-3xl text-sm leading-6 text-[#5a707a]">
									Il messaggio appare nella campanella di tutti gli iscritti. Il pallino rosso sparisce quando l’utente apre il pannello, e la notifica letta si nasconde da sola dopo 24 ore.
								</p>

								<div class="mt-5 grid gap-4">
									<label class="grid gap-2">
										<span class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Titolo</span>
										<input
											class="rounded-[1rem] border border-[#dbe5ea] bg-white px-4 py-3 text-sm text-[#173843] outline-none transition focus:border-[#0f5d6c] focus:ring-2 focus:ring-[#d8eef2]"
											type="text"
											maxlength="120"
											bind:value={notificationTitle}
											placeholder="Es. Nuova funzione disponibile"
										/>
									</label>

									<label class="grid gap-2">
										<span class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Messaggio</span>
										<textarea
											class="min-h-[120px] rounded-[1rem] border border-[#dbe5ea] bg-white px-4 py-3 text-sm leading-6 text-[#173843] outline-none transition focus:border-[#0f5d6c] focus:ring-2 focus:ring-[#d8eef2]"
											bind:value={notificationBody}
											maxlength="1200"
											placeholder="Scrivi il messaggio che vuoi inviare agli iscritti."
										></textarea>
									</label>

									<div class="flex items-center justify-between gap-4">
										<p class="text-xs leading-5 text-[#6a8792]">
											Le notifiche sono broadcast e non richiedono azioni manuali dell’utente per sparire dopo la lettura.
										</p>
										<button
											class="rounded-full bg-[#0f5d6c] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,93,108,0.18)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
											type="button"
											onclick={handlePublishNotification}
											disabled={notificationPending}
										>
											{notificationPending ? 'Invio in corso...' : 'Invia notifica'}
										</button>
									</div>

									{#if notificationFeedback}
										<p class="rounded-[1rem] border border-[#d9ece2] bg-[#f3fbf6] px-4 py-3 text-sm text-[#1f7a45]">
											{notificationFeedback}
										</p>
									{/if}

									{#if notificationError}
										<p class="rounded-[1rem] border border-[#f0d1d1] bg-[#fff6f6] px-4 py-3 text-sm text-[#8f4040]">
											{notificationError}
										</p>
									{/if}
								</div>
							</section>
						{/if}

						<div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
							<section class="rounded-[1.8rem] border border-white/90 bg-white/84 p-5 shadow-[0_18px_42px_rgba(148,163,184,0.14)]">
								<div class="flex items-center justify-between gap-3">
									<div>
										<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Ultimi 30 giorni</p>
										<h2 class="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Storico eventi</h2>
									</div>
									<p class="rounded-full bg-[#eef7f9] px-3 py-1 text-xs font-semibold text-[#0f5d6c]">
										{last30Days.length} giorni
									</p>
								</div>

								{#if last30Days.length}
									<div class="mt-5 overflow-x-auto rounded-[1.5rem] border border-[#e5edf1] bg-white/90">
										<table class="min-w-full border-separate border-spacing-0 text-left">
											<thead class="bg-[#fbfcfd]">
												<tr class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">
													<th class="px-4 py-4">Giorno</th>
													<th class="px-4 py-4 text-right">Attivi</th>
													<th class="px-4 py-4 text-right">Login</th>
													<th class="px-4 py-4 text-right">Upload</th>
													<th class="px-4 py-4 text-right">Archiviati</th>
													<th class="px-4 py-4 text-right">Note</th>
													<th class="px-4 py-4 text-right">Totale</th>
												</tr>
											</thead>
											<tbody>
												{#each last30Days as day}
													<tr class="text-sm text-[#173843]">
														<td class="border-t border-[#edf2f5] px-4 py-4 font-semibold">{formatDay(day.dayKey)}</td>
														<td class="border-t border-[#edf2f5] px-4 py-4 text-right">{day.uniqueActiveUsers}</td>
														<td class="border-t border-[#edf2f5] px-4 py-4 text-right">{day.logins}</td>
														<td class="border-t border-[#edf2f5] px-4 py-4 text-right">{day.documentsUploaded}</td>
														<td class="border-t border-[#edf2f5] px-4 py-4 text-right">{day.documentsArchived}</td>
														<td class="border-t border-[#edf2f5] px-4 py-4 text-right">{day.notesCreated}</td>
														<td class="border-t border-[#edf2f5] px-4 py-4 text-right font-semibold text-[#0f5d6c]">{totalDailyEvents(day)}</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{:else}
									<div class="mt-5 rounded-[1.5rem] border border-[#e5edf1] bg-white/90 p-5">
										<h3 class="text-lg font-bold tracking-[-0.03em] text-[#173843]">Nessun dato ancora registrato</h3>
										<p class="mt-2 text-sm leading-6 text-[#5a707a]">
											Usa l'app: login, upload, archiviazione e note inizieranno a popolare questa tabella in automatico.
										</p>
									</div>
								{/if}
							</section>

							<aside class="rounded-[1.8rem] border border-white/90 bg-white/84 p-5 shadow-[0_18px_42px_rgba(148,163,184,0.14)]">
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Snapshot</p>
								<h2 class="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Ultimo giorno</h2>

								{#if latestDay}
									<div class="mt-5 grid gap-3">
										<div class="rounded-[1.3rem] bg-[#f7fafb] px-4 py-4">
											<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Data</p>
											<p class="mt-2 text-lg font-bold text-[#173843]">{formatDay(latestDay.dayKey)}</p>
										</div>
										<div class="rounded-[1.3rem] bg-[#f7fafb] px-4 py-4">
											<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Utenti attivi</p>
											<p class="mt-2 text-[2rem] font-extrabold tracking-[-0.05em] text-[#103844]">{latestDay.uniqueActiveUsers}</p>
										</div>
										<div class="rounded-[1.3rem] bg-[#f7fafb] px-4 py-4">
											<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Eventi totali</p>
											<p class="mt-2 text-[2rem] font-extrabold tracking-[-0.05em] text-[#103844]">{totalDailyEvents(latestDay)}</p>
										</div>
									</div>
								{:else}
									<div class="mt-5 rounded-[1.3rem] bg-[#f7fafb] px-4 py-4">
										<p class="text-sm leading-6 text-[#5a707a]">
											Appena arriva il primo evento, qui vedrai un riepilogo rapido dell'ultimo giorno registrato.
										</p>
									</div>
								{/if}
							</aside>
						</div>
					{/if}
				</div>
			</main>
		</div>
	</div>
</div>
