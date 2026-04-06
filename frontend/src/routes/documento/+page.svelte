<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		authState,
		initAuth,
		isSecurityOnboardingComplete,
		logout,
		saveDisplayName
	} from '$lib/auth';
	import AiStatusBadge from '$lib/components/AiStatusBadge.svelte';
	import DocumentForm from '$lib/components/DocumentForm.svelte';
	import { analyticsAccessState, initAnalyticsAccess } from '$lib/stores/analyticsAccess';
	import { categoriesState, initCategories } from '$lib/stores/categories';
	import {
		ensureInboxDocumentAssets,
		getInboxDocumentById,
		initInbox,
		inboxAssetOperationState,
		inboxState
	} from '$lib/inbox';
	import {
		ensureVaultDocumentAssets,
		getVaultDocumentById,
		initVault,
		vaultAssetOperationState,
		vaultState,
		type VaultDocument
	} from '$lib/vault';
	import { onMount } from 'svelte';

	let displayNameInput = $state('');
	let showDisplayNameEditor = $state(false);
	let documentId = $state<string | null>(null);

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

		initVault();
		initInbox();
		initCategories();
		void initAnalyticsAccess();

		const params = new URLSearchParams(window.location.search);
		documentId = params.get('id');
		if (documentId) {
			void ensureVaultDocumentAssets(documentId, { includeOriginal: false, operation: 'preview' });
			void ensureInboxDocumentAssets(documentId, { includeOriginal: false, operation: 'preview' });
		}
	});

	$effect(() => {
		if ($authState.displayName && !$authState.pending) {
			displayNameInput = $authState.displayName;
		}
	});

	function principalLabel(principal: string | null) {
		if (!principal) return 'Sessione attiva';
		if (principal.length <= 18) return principal;
		return `${principal.slice(0, 10)}...${principal.slice(-6)}`;
	}

	async function handleDisplayNameSave() {
		if (!displayNameInput.trim()) return;
		await saveDisplayName(displayNameInput);
		showDisplayNameEditor = false;
	}

	function formatSize(bytes: number) {
		if (!bytes) return '0 KB';
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function isPdfDocument(value: { type?: string; name?: string } | null) {
		if (!value) return false;
		return (
			value.type?.toLowerCase().includes('pdf') === true ||
			value.name?.toLowerCase().endsWith('.pdf') === true
		);
	}

	let documentData = $derived(
		documentId
			? $vaultState.documents.find((document) => document.id === documentId) ??
				getVaultDocumentById(documentId) ??
				$inboxState.documents.find((document) => document.id === documentId) ??
				getInboxDocumentById(documentId)
			: null
	);

	$effect(() => {
		if (!documentData || !documentId) return;

		if (
			!documentData.previewDataUrl &&
			('previewBlobId' in documentData || 'originalBlobId' in documentData || 'sourceBlobId' in documentData)
		) {
			void ensureVaultDocumentAssets(documentId, { includeOriginal: false, operation: 'preview' });
			void ensureInboxDocumentAssets(documentId, { includeOriginal: false, operation: 'preview' });
		}
	});

	let isPreviewLoading = $derived(
		documentId
			? $vaultAssetOperationState.previewingDocumentIds.includes(documentId) ||
				$inboxAssetOperationState.previewingDocumentIds.includes(documentId)
			: false
	);
</script>

<svelte:head>
	<title>Documento | Fattura Vault</title>
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
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl bg-[#0f5d6c] px-4 py-4 text-left text-lg font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.18)]" href="/inbox">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24">
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
					Esci
				</button>
			</div>
		</aside>

		<div class="flex min-h-screen flex-1 flex-col">
			<header class="relative z-30 border-b border-[#dbe5ea] bg-white/62 px-5 py-4 backdrop-blur sm:px-8">
				<div class="flex items-center justify-between gap-4">
					<a class="inline-flex items-center gap-2 text-sm font-semibold text-[#173843] transition-colors hover:text-[#0f5d6c]" href="/inbox">
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
						Torna all'inbox
					</a>
					<div class="flex items-center gap-3">
						{#if documentData}
							<AiStatusBadge
								status={
									documentData.status === 'processed' ? 'processed' : 'inbox'
								}
							/>
						{/if}
						<button class="flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2.5 text-sm font-semibold text-[#183843]" type="button" onclick={() => (showDisplayNameEditor = !showDisplayNameEditor)}>
							{$authState.displayName ?? principalLabel($authState.principal)}
						</button>
					</div>
				</div>
			</header>

			<main class="flex-1 px-5 py-6 sm:px-8 lg:px-10">
				<div class="mx-auto max-w-[1200px]">
					{#if documentData}
						<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
							<section class="rounded-[2rem] border border-white/85 bg-white/76 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur">
								<div class="mb-4 flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dff1f3] text-[#0f5d6c]">
										<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
											<path stroke-linecap="round" stroke-linejoin="round" d="M7 4.8h6.5L19 10v8.2A2 2 0 0 1 17 20H7a2 2 0 0 1-2-1.8V6.8A2 2 0 0 1 7 4.8ZM13.5 4.9V10H19" />
										</svg>
									</div>
									<div class="min-w-0">
										<p class="truncate text-lg font-bold tracking-[-0.02em] text-[#173843]">{documentData.name}</p>
										<div class="flex gap-3 text-xs font-medium text-[#58707a]">
											<span>{formatSize(documentData.size)}</span>
											<span>{documentData.type || 'FILE'}</span>
										</div>
									</div>
								</div>

								<div class="rounded-[1.5rem] border border-[#e3edf1] bg-[#f8fbfc] p-4">
									{#if documentData.previewDataUrl}
										<div class="overflow-hidden rounded-[1.2rem] border border-[#dbe7eb] bg-white">
											{#if isPdfDocument(documentData)}
												<iframe
													title={documentData.name}
													src={documentData.previewDataUrl}
													class="h-[70vh] min-h-[520px] w-full bg-white"
												></iframe>
											{:else}
												<img alt={documentData.name} class="max-h-[500px] w-full object-contain" src={documentData.previewDataUrl} />
											{/if}
										</div>
									{:else}
										<div class="flex flex-col items-center justify-center py-16 text-center">
											<div class="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#dff1f3] text-[#0f5d6c]">
												<svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
													<path stroke-linecap="round" stroke-linejoin="round" d="M7 4.8h6.5L19 10v8.2A2 2 0 0 1 17 20H7a2 2 0 0 1-2-1.8V6.8A2 2 0 0 1 7 4.8ZM13.5 4.9V10H19M8.5 12.2h7M8.5 15.2h5" />
												</svg>
											</div>
											<p class="mt-4 text-base font-semibold text-[#173843]">
												{isPreviewLoading ? 'Caricamento anteprima...' : 'Anteprima non disponibile'}
											</p>
											<p class="mt-1 text-sm text-[#5a707a]">
												{#if isPreviewLoading}
													Stiamo recuperando e decifrando il file. Potrebbe volerci qualche secondo.
												{:else}
													L'anteprima è disponibile per immagini e PDF.
												{/if}
											</p>
										</div>
									{/if}
								</div>
							</section>

							<DocumentForm document={documentData} categories={$categoriesState} />
						</div>
					{:else}
						<section class="mt-6 rounded-[2rem] border border-white/85 bg-white/76 p-6 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur">
							<div class="rounded-[1.7rem] border border-[#e3edf1] bg-white/88 p-6">
								<h2 class="text-2xl font-bold tracking-[-0.03em] text-[#173843]">Documento non disponibile</h2>
								<p class="mt-3 text-sm leading-6 text-[#5a707a]">
									Il file che stai cercando non è stato trovato. Torna all'inbox.
								</p>
								<a class="mt-4 inline-flex items-center justify-center rounded-2xl bg-[#0f5d6c] px-5 py-2.5 text-sm font-semibold text-white" href="/inbox">Torna all'inbox</a>
							</div>
						</section>
					{/if}
				</div>
			</main>
		</div>
	</div>
</div>


