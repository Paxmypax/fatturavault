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
				<a class="flex items-center gap-3 rounded-2xl bg-[#0f5d6c] px-4 py-3 text-left text-lg font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.18)]" href="/impostazioni">
					Impostazioni
				</a>
				<button class="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-medium text-[#29414a] transition-colors hover:bg-white/70" type="button">
					Supporto
				</button>
				<button class="mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-medium text-[#8f4040] transition-colors hover:bg-[#fff1f1]" type="button" onclick={logout}>
					Esci
				</button>
			</div>
		</aside>

		<div class="flex min-h-screen flex-1 flex-col">
			<header class="relative z-30 border-b border-[#dbe5ea] bg-white/62 px-5 py-4 backdrop-blur sm:px-8">
				<div class="flex items-center justify-end gap-4">
					<button aria-label="Notifiche" class="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/80 text-[#29414a] shadow-[0_10px_25px_rgba(148,163,184,0.1)] transition-transform hover:-translate-y-0.5" type="button">
						<svg aria-hidden="true" class="h-6 w-6" fill="none" viewBox="0 0 24 24">
							<path d="M6.8 16.3H17.2L16 14.5V10a4 4 0 1 0-8 0v4.5l-1.2 1.8ZM10.1 18.6a2.1 2.1 0 0 0 3.8 0" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
						</svg>
					</button>

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
				</div>
			</main>
		</div>
	</div>
</div>
