<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		authState,
		initAuth,
		logout,
		resetLocalInternetIdentitySession,
		saveDisplayName,
		saveSecurityState
	} from '$lib/auth';
	import { analyticsAccessState, initAnalyticsAccess } from '$lib/stores/analyticsAccess';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import {
		DEFAULT_OPENAI_MODEL,
		OPENAI_MODEL_OPTIONS,
		clearLocalLlmConfig,
		getLocalLlmConfig,
		saveLocalLlmConfig
	} from '$lib/llm/config';
	import { onMount } from 'svelte';

	onMount(async () => {
		await initAuth();

		if (!$authState.authenticated) {
			await goto('/');
		}

		void initAnalyticsAccess();
	});

	let displayNameInput = $state('');
	let showDisplayNameEditor = $state(false);
	let ackRecoveryPhrase = $state(false);
	let ackBackupDevice = $state(false);
	let ackRiskUnderstood = $state(false);
	let isSaving = $state(false);
	let llmApiKey = $state('');
	let llmModel = $state(DEFAULT_OPENAI_MODEL);
	let llmEnabled = $state(false);
	let llmSaved = $state(false);

	$effect(() => {
		if ($authState.displayName && !$authState.pending) {
			displayNameInput = $authState.displayName;
		}
	});

	$effect(() => {
		if (!$authState.security) return;
		ackRecoveryPhrase = $authState.security.ackRecoveryPhrase;
		ackBackupDevice = $authState.security.ackBackupDevice;
		ackRiskUnderstood = $authState.security.ackRiskUnderstood;
	});

	onMount(() => {
		const llmConfig = getLocalLlmConfig();
		if (!llmConfig) {
			return;
		}

		llmApiKey = llmConfig.apiKey;
		llmModel = llmConfig.model || DEFAULT_OPENAI_MODEL;
		llmEnabled = llmConfig.enabled;
		llmSaved = true;
	});

	async function handleDisplayNameSave() {
		if (!displayNameInput.trim()) return;
		await saveDisplayName(displayNameInput);
		showDisplayNameEditor = false;
	}

	async function handleSecuritySave() {
		isSaving = true;
		await saveSecurityState({
			ackRecoveryPhrase,
			ackBackupDevice,
			ackRiskUnderstood
		});
		isSaving = false;
	}

	function handleLlmSave() {
		if (!llmApiKey.trim()) {
			return;
		}

		saveLocalLlmConfig({
			apiKey: llmApiKey,
			model: llmModel,
			enabled: llmEnabled
		});
		llmSaved = true;
	}

	function handleLlmReset() {
		clearLocalLlmConfig();
		llmApiKey = '';
		llmModel = DEFAULT_OPENAI_MODEL;
		llmEnabled = false;
		llmSaved = false;
	}

	function openInternetIdentity() {
		const identityUrl = import.meta.env.VITE_II_URL || 'https://id.ai';
		window.open(identityUrl, '_blank', 'noopener,noreferrer');
	}

	function formatReviewDate(iso: string | null | undefined) {
		if (!iso) return 'Mai';
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return 'Mai';
		return new Intl.DateTimeFormat('it-IT', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}
</script>

<svelte:head>
	<title>Impostazioni | Fattura Vault</title>
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
				<a class="flex items-center gap-3 rounded-2xl bg-[#0f5d6c] px-4 py-3 text-left text-lg font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.18)]" href="/impostazioni">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24">
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
								{$authState.displayName ?? 'Profilo'}
							</p>
						</button>

						{#if showDisplayNameEditor}
							<div class="absolute right-0 z-20 mt-3 w-[20rem] rounded-[1.4rem] border border-[#dce9ed] bg-white p-4 shadow-[0_24px_60px_rgba(148,163,184,0.18)]">
								<p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#6a8792]">Profilo</p>
								<h2 class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#103844]">Modifica nome</h2>
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
				<div class="mx-auto max-w-5xl">
					<h1 class="text-[2.4rem] font-extrabold tracking-[-0.05em] text-[#0f5666] sm:text-[3.4rem]">IMPOSTAZIONI</h1>
					<p class="mt-3 max-w-3xl text-sm leading-6 text-[#5a707a]">
						Gestisci il livello di protezione del tuo vault e rivedi le conferme di sicurezza legate a Internet Identity.
					</p>

					<section class="mt-6 rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
							<div>
								<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Sicurezza</p>
								<h2 class="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Stato protezione account</h2>
							</div>
							<span class={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${ackRecoveryPhrase && ackRiskUnderstood ? 'bg-[#eef8fa] text-[#0f5d6c]' : 'bg-[#fff1f1] text-[#b42318]'}`}>
								{ackRecoveryPhrase && ackRiskUnderstood ? 'Protezione minima attiva' : 'Azione richiesta'}
							</span>
						</div>

						<div class="mt-6 grid gap-4 md:grid-cols-2">
							<div class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Recovery phrase</p>
								<p class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#173843]">{ackRecoveryPhrase ? 'Confermata' : 'Da confermare'}</p>
								<p class="mt-2 text-sm leading-6 text-[#5a707a]">È il punto più importante: senza recovery, perdere l'accesso a Internet Identity significa perdere anche i file.</p>
							</div>
							<div class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Dispositivo di backup</p>
								<p class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#173843]">{ackBackupDevice ? 'Confermato' : 'Da confermare'}</p>
								<p class="mt-2 text-sm leading-6 text-[#5a707a]">Ti consigliamo di non tenere il vault legato a un solo dispositivo di accesso.</p>
							</div>
							<div class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Rischio compreso</p>
								<p class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#173843]">{ackRiskUnderstood ? 'Confermato' : 'Da confermare'}</p>
								<p class="mt-2 text-sm leading-6 text-[#5a707a]">Fattura Vault non può recuperare i documenti per conto tuo.</p>
							</div>
							<div class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Ultima revisione</p>
								<p class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#173843]">{formatReviewDate($authState.security?.completedAt)}</p>
								<p class="mt-2 text-sm leading-6 text-[#5a707a]">Puoi rivedere e aggiornare queste conferme in qualsiasi momento.</p>
							</div>
						</div>

						<div class="mt-6 rounded-[1.6rem] border border-[#dce7eb] bg-white p-5 shadow-[0_16px_36px_rgba(148,163,184,0.08)]">
							<p class="text-sm font-semibold text-[#173843]">Checklist sicurezza</p>
							<div class="mt-4 grid gap-3">
								<label class="flex items-start gap-3 rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4">
									<input class="mt-1 h-4 w-4 accent-[#0f5d6c]" type="checkbox" bind:checked={ackRecoveryPhrase} />
									<span class="text-sm leading-6 text-[#173843]">Ho salvato la mia recovery phrase</span>
								</label>
								<label class="flex items-start gap-3 rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4">
									<input class="mt-1 h-4 w-4 accent-[#0f5d6c]" type="checkbox" bind:checked={ackBackupDevice} />
									<span class="text-sm leading-6 text-[#173843]">Ho aggiunto o aggiungerò un dispositivo di backup</span>
								</label>
								<label class="flex items-start gap-3 rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4">
									<input class="mt-1 h-4 w-4 accent-[#0f5d6c]" type="checkbox" bind:checked={ackRiskUnderstood} />
									<span class="text-sm leading-6 text-[#173843]">Ho capito che Fattura Vault non può recuperare i miei file</span>
								</label>
							</div>

							<div class="mt-5 flex flex-wrap gap-3">
								<button class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#0f5d6c] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.22)] transition-transform hover:-translate-y-0.5" type="button" onclick={handleSecuritySave}>
									{isSaving ? 'Salvataggio...' : 'Salva sicurezza'}
								</button>
								<button class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5" type="button" onclick={openInternetIdentity}>
									Apri Internet Identity
								</button>
								<a class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5" href="/sicurezza">
									Rivedi onboarding
								</a>
								<button
									class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#ead3a8] bg-[#fff9ef] px-5 text-sm font-semibold text-[#7c5a19] transition-transform hover:-translate-y-0.5"
									type="button"
									onclick={resetLocalInternetIdentitySession}
								>
									Resetta sessione di questo dominio
								</button>
							</div>
						</div>
					</section>

					<section class="mt-6 rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
							<div>
								<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">LLM outcall</p>
								<h2 class="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Prefill documenti con API personale</h2>
							</div>
							<span class={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${llmSaved && llmEnabled ? 'bg-[#eef8fa] text-[#0f5d6c]' : 'bg-[#f3f6f8] text-[#566e77]'}`}>
								{llmSaved && llmEnabled ? 'Attiva in questo browser' : 'Non configurata'}
							</span>
						</div>

						<div class="mt-6 rounded-[1.6rem] border border-[#dce7eb] bg-white p-5 shadow-[0_16px_36px_rgba(148,163,184,0.08)]">
							<p class="text-sm leading-6 text-[#5a707a]">
								Questo blocco serve al prefill dei documenti in Inbox. La chiave API resta salvata solo in questo browser.
							</p>

							<div class="mt-5 grid gap-4 md:grid-cols-2">
								<label class="grid gap-2 text-sm font-medium text-[#173843]">
									<span>Chiave API OpenAI</span>
									<input
										class="min-h-12 rounded-2xl border border-[#d6e2e7] bg-white px-4 text-base font-medium text-[#173843] outline-none ring-0 placeholder:text-[#8aa0aa] focus:border-[#0f5d6c]"
										type="password"
										bind:value={llmApiKey}
										placeholder="sk-..."
									/>
								</label>

								<label class="grid gap-2 text-sm font-medium text-[#173843]">
									<span>Modello</span>
									<select
										class="min-h-12 rounded-2xl border border-[#d6e2e7] bg-white px-4 text-base font-medium text-[#173843] outline-none ring-0 focus:border-[#0f5d6c]"
										bind:value={llmModel}
									>
										{#each OPENAI_MODEL_OPTIONS as option}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</label>
							</div>

							<label class="mt-4 flex items-start gap-3 rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4">
								<input class="mt-1 h-4 w-4 accent-[#0f5d6c]" type="checkbox" bind:checked={llmEnabled} />
								<span class="text-sm leading-6 text-[#173843]">
									Attiva il prefill AI dei documenti in Inbox
								</span>
							</label>

							<div class="mt-5 flex flex-wrap gap-3">
								<button
									class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#0f5d6c] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.22)] transition-transform hover:-translate-y-0.5"
									type="button"
									onclick={handleLlmSave}
								>
									Salva configurazione LLM
								</button>
								<button
									class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5"
									type="button"
									onclick={handleLlmReset}
								>
									Rimuovi configurazione
								</button>
							</div>
						</div>
					</section>

					<section class="mt-6 rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
							<div>
								<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">LLM on-chain ICP</p>
								<h2 class="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#103844]">AI on-chain per chat e riepiloghi del vault</h2>
							</div>
							<span class="inline-flex rounded-full bg-[#eef8fa] px-4 py-2 text-sm font-semibold text-[#0f5d6c]">
								Servizio attivo
							</span>
						</div>

						<div class="mt-6 rounded-[1.6rem] border border-[#dce7eb] bg-white p-5 shadow-[0_16px_36px_rgba(148,163,184,0.08)]">
							<p class="text-sm leading-6 text-[#5a707a]">
								Questa funzione non c'entra con l'API personale usata per il prefill dei documenti in Inbox. Il prefill continua a passare dalla tua chiave privata OpenAI, mentre l'LLM on-chain gira direttamente su Internet Computer ed è dedicato alle funzioni testuali del vault.
							</p>

							<div class="mt-5 grid gap-4 md:grid-cols-2">
								<div class="rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4">
									<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Modello attuale</p>
									<p class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#173843]">Llama 3.1 8B</p>
									<p class="mt-2 text-sm leading-6 text-[#5a707a]">
										Il servizio on-chain usa oggi il modello <span class="font-semibold text-[#173843]">llama3.1:8b</span>.
									</p>
								</div>
								<div class="rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4">
									<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Costo per l'utente</p>
									<p class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#173843]">Gratuito</p>
									<p class="mt-2 text-sm leading-6 text-[#5a707a]">
										È un servizio AI on-chain del prodotto e al momento non richiede una chiave API personale.
									</p>
								</div>
							</div>

							<div class="mt-5 rounded-[1.3rem] border border-[#d8e8ed] bg-[#eef8fa] p-4 text-sm leading-6 text-[#22505d]">
								<p class="font-semibold text-[#103844]">Differenza importante</p>
								<p class="mt-2">
									<span class="font-semibold text-[#173843]">LLM outcall con API personale:</span> serve per leggere file, PDF e immagini in Inbox e provare a precompilare il form documento.
								</p>
								<p class="mt-2">
									<span class="font-semibold text-[#173843]">LLM on-chain ICP:</span> lavora solo su testo, numeri, date e dati già strutturati nel vault, quindi è perfetto per chat, riepiloghi e analisi leggere.
								</p>
							</div>

							<div class="mt-4 grid gap-3 md:grid-cols-2">
								<div class="rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4 text-sm leading-6 text-[#173843]">
									<p class="font-semibold">Chat AI sul vault</p>
									<p class="mt-1 text-[#5a707a]">Domande su spese, fatture, scadenze e riepiloghi usando solo testo e numeri già salvati.</p>
								</div>
								<div class="rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4 text-sm leading-6 text-[#173843]">
									<p class="font-semibold">Suggerimenti intelligenti</p>
									<p class="mt-1 text-[#5a707a]">Avvisi su documenti in scadenza, fatture da pagare e riepiloghi periodici generati dai dati del vault.</p>
								</div>
								<div class="rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4 text-sm leading-6 text-[#173843]">
									<p class="font-semibold">Auto-tagging</p>
									<p class="mt-1 text-[#5a707a]">Tag suggeriti dopo l'archiviazione usando titolo, categoria e storico dei tag dell'utente.</p>
								</div>
								<div class="rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4 text-sm leading-6 text-[#173843]">
									<p class="font-semibold">Ricerca semantica</p>
									<p class="mt-1 text-[#5a707a]">Ricerche più intelligenti sui documenti già catalogati, senza usare PDF o immagini raw.</p>
								</div>
							</div>
						</div>
					</section>
				</div>
			</main>
		</div>
	</div>
</div>

