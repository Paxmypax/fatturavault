<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		authState,
		initAuth,
		resetLocalInternetIdentitySession,
		saveSecurityState,
		type SecurityState
	} from '$lib/auth';
	import { onMount } from 'svelte';

	let ackRecoveryPhrase = $state(false);
	let ackBackupDevice = $state(false);
	let ackRiskUnderstood = $state(false);
	let isSaving = $state(false);

	onMount(async () => {
		await initAuth();

		if (!$authState.authenticated) {
			await goto('/');
			return;
		}

		loadSecurityState($authState.security);
	});

	$effect(() => {
		loadSecurityState($authState.security);
	});

	function loadSecurityState(security: SecurityState | null) {
		if (!security) {
			return;
		}

		ackRecoveryPhrase = security.ackRecoveryPhrase;
		ackBackupDevice = security.ackBackupDevice;
		ackRiskUnderstood = security.ackRiskUnderstood;
	}

	function canContinue() {
		return ackRecoveryPhrase && ackRiskUnderstood;
	}

	async function handleSave() {
		if (!canContinue()) {
			return;
		}

		isSaving = true;
		await saveSecurityState({
			ackRecoveryPhrase,
			ackBackupDevice,
			ackRiskUnderstood
		});
		isSaving = false;
		await goto('/dashboard');
	}

	function openInternetIdentity() {
		const identityUrl = import.meta.env.VITE_II_URL || 'https://id.ai';
		window.open(identityUrl, '_blank', 'noopener,noreferrer');
	}
</script>

<svelte:head>
	<title>Sicurezza | Fattura Vault</title>
</svelte:head>

<div class="min-h-screen bg-[#f7fafc] text-[#12303b] [font-family:'Inter',system-ui,sans-serif]">
	<div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.96),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.18),transparent_24%)]"></div>

	<div class="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8 sm:px-8 lg:px-10">
		<div class="flex items-center gap-3">
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

		<div class="mt-10 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
			<section class="rounded-[2rem] border border-white/85 bg-white/78 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
				<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Onboarding sicurezza</p>
				<h1 class="mt-3 text-[2.4rem] font-extrabold tracking-[-0.05em] text-[#0f5666] sm:text-[3rem]">
					Proteggi il tuo vault
				</h1>
				<p class="mt-4 text-base leading-8 text-[#324952]">
					I tuoi documenti saranno accessibili solo tramite Internet Identity. Se perdi
					accesso e non hai recovery, non potremo recuperarli per te.
				</p>

				<div class="mt-8 grid gap-4">
					<div class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">1. Recovery</p>
						<p class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#173843]">Salva la recovery phrase</p>
						<p class="mt-2 text-sm leading-6 text-[#5a707a]">
							Se perdi i dispositivi di accesso, la recovery phrase è l’ultimo modo per
							rientrare nel tuo vault.
						</p>
					</div>

					<div class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">2. Backup</p>
						<p class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#173843]">Aggiungi un dispositivo di riserva</p>
						<p class="mt-2 text-sm leading-6 text-[#5a707a]">
							Telefono, computer o chiavetta hardware: ti consigliamo di non lasciare il
							tuo accesso appeso a un solo dispositivo.
						</p>
					</div>

					<div class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-5">
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">3. Responsabilità</p>
						<p class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#173843]">Nessun recupero amministrativo</p>
						<p class="mt-2 text-sm leading-6 text-[#5a707a]">
							Fattura Vault non può recuperare i tuoi file per conto tuo. La protezione è
							più forte proprio perché non abbiamo accesso ai contenuti.
						</p>
					</div>
				</div>
			</section>

			<section class="rounded-[2rem] border border-white/85 bg-white/82 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-8">
				<p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#6a8792]">Checklist</p>
				<h2 class="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#103844]">Prima di entrare nell’app</h2>
				<p class="mt-3 text-sm leading-6 text-[#5a707a]">
					Queste conferme servono a evitare che tu perda accesso ai documenti per una
					disattenzione iniziale.
				</p>

				<div class="mt-6 grid gap-3">
					<label class="flex items-start gap-3 rounded-[1.4rem] border border-[#e3edf1] bg-white p-4">
						<input class="mt-1 h-4 w-4 accent-[#0f5d6c]" type="checkbox" bind:checked={ackRecoveryPhrase} />
						<span>
							<span class="block text-sm font-semibold text-[#173843]">Ho salvato la mia recovery phrase</span>
							<span class="mt-1 block text-sm leading-6 text-[#5a707a]">Obbligatorio. Senza recovery potresti perdere accesso definitivo ai file.</span>
						</span>
					</label>

					<label class="flex items-start gap-3 rounded-[1.4rem] border border-[#e3edf1] bg-white p-4">
						<input class="mt-1 h-4 w-4 accent-[#0f5d6c]" type="checkbox" bind:checked={ackBackupDevice} />
						<span>
							<span class="block text-sm font-semibold text-[#173843]">Ho aggiunto o aggiungerò un dispositivo di backup</span>
							<span class="mt-1 block text-sm leading-6 text-[#5a707a]">Consigliato. Ti ricorderemo comunque questo passaggio anche in dashboard.</span>
						</span>
					</label>

					<label class="flex items-start gap-3 rounded-[1.4rem] border border-[#e3edf1] bg-white p-4">
						<input class="mt-1 h-4 w-4 accent-[#0f5d6c]" type="checkbox" bind:checked={ackRiskUnderstood} />
						<span>
							<span class="block text-sm font-semibold text-[#173843]">Ho capito che Fattura Vault non può recuperare i miei file</span>
							<span class="mt-1 block text-sm leading-6 text-[#5a707a]">Obbligatorio. Il recupero dipende dai metodi di sicurezza configurati in Internet Identity.</span>
						</span>
					</label>
				</div>

				<div class="mt-6 rounded-[1.5rem] border border-[#dce7eb] bg-[#f8fbfc] p-5">
					<p class="text-sm font-semibold text-[#173843]">Gestisci i dispositivi in Internet Identity</p>
					<p class="mt-2 text-sm leading-6 text-[#5a707a]">
						Apri Internet Identity per controllare i tuoi dispositivi di accesso e la recovery phrase.
					</p>
					<button
						class="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5"
						type="button"
						onclick={openInternetIdentity}
					>
						Apri Internet Identity
					</button>
					<div class="mt-4 rounded-[1.2rem] border border-[#f1dfb8] bg-[#fff9ee] p-4">
						<p class="text-sm font-semibold text-[#8a6220]">Hai usato prima il link `icp0.io`?</p>
						<p class="mt-2 text-sm leading-6 text-[#7a6541]">
							Se su `fatturavault.com` vedi un vault nuovo, resetta solo la sessione di questo dominio e rientra.
							Non tocca gli altri siti del browser.
						</p>
						<button
							class="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#e8d3a6] bg-white px-5 text-sm font-semibold text-[#7c5a19] transition-transform hover:-translate-y-0.5"
							type="button"
							onclick={resetLocalInternetIdentitySession}
						>
							Resetta solo questo dominio
						</button>
					</div>
				</div>

				<div class="mt-6 flex flex-wrap gap-3">
					<button
						class="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#0f5d6c] px-6 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.22)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
						type="button"
						onclick={handleSave}
						disabled={!canContinue() || isSaving}
					>
						{isSaving ? 'Salvataggio...' : 'Completa sicurezza'}
					</button>
					<a
						class="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-6 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5"
						href="/dashboard"
					>
						Torna alla dashboard
					</a>
				</div>

				{#if !canContinue()}
					<p class="mt-3 text-sm leading-6 text-[#8f4040]">
						Per continuare devi confermare di aver salvato la recovery phrase e di aver compreso il rischio di perdita accesso.
					</p>
				{/if}
			</section>
		</div>
	</div>
</div>
