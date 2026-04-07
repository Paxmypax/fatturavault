<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		authState,
		initAuth,
		isSecurityOnboardingComplete,
		logout,
		saveDisplayName
	} from '$lib/auth';
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';
	import CategoryDropdown from '$lib/components/CategoryDropdown.svelte';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import { analyticsAccessState, initAnalyticsAccess } from '$lib/stores/analyticsAccess';
	import { categoriesState, getCategoryByName, initCategories } from '$lib/stores/categories';
	import {
		downloadVaultDocument,
		initVault,
		removeVaultDocument,
		setVaultDocumentCategory,
		vaultAssetOperationState,
		vaultState
	} from '$lib/vault';
	import { onMount } from 'svelte';

	type ViewMode = 'table' | 'grid';

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
		initCategories();
		void initAnalyticsAccess();
	});

	let displayNameInput = $state('');
	let showDisplayNameEditor = $state(false);
	let searchQuery = $state('');
	let selectedCategory = $state('');
	let selectedTag = $state('all');
	let selectedPayment = $state<'all' | 'due' | 'paid'>('all');
	let selectedDate = $state('');
	let viewMode = $state<ViewMode>('table');
	let selectedIds = $state<string[]>([]);
	let bulkCategory = $state('');
	let showBulkDeleteConfirm = $state(false);
	let pendingDeleteDocumentId = $state<string | null>(null);

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

	async function handleDisplayNameSave() {
		if (!displayNameInput.trim()) {
			return;
		}

		await saveDisplayName(displayNameInput);
		showDisplayNameEditor = false;
	}

	const processedDocuments = $derived(
		$vaultState.documents
			.filter((document) => document.status === 'processed')
			.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
	);

	const availableTags = $derived(
		[...new Set(processedDocuments.flatMap((document) => document.tags).filter(Boolean))].sort((a, b) =>
			a.localeCompare(b, 'it')
		)
	);

	function matchesSearch(document: (typeof processedDocuments)[number]) {
		if (!searchQuery.trim()) {
			return true;
		}

		const haystack = [
			document.title,
			document.name,
			document.merchantName,
			document.notes,
			document.categoryName,
			...document.tags
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();

		return haystack.includes(searchQuery.trim().toLowerCase());
	}

	function matchesDate(document: (typeof processedDocuments)[number]) {
		if (!selectedDate) {
			return true;
		}

		return document.createdAt.slice(0, 10) === selectedDate;
	}

	const filteredDocuments = $derived(
		processedDocuments.filter((document) => {
			if (selectedCategory && document.categoryName !== selectedCategory) {
				return false;
			}

			if (selectedTag !== 'all' && !document.tags.includes(selectedTag)) {
				return false;
			}

			if (selectedPayment === 'due' && document.paymentStatus !== 'due') {
				return false;
			}

			if (selectedPayment === 'paid' && document.paymentStatus !== 'paid') {
				return false;
			}

			return matchesSearch(document) && matchesDate(document);
		})
	);

	$effect(() => {
		const visibleIds = new Set(filteredDocuments.map((document) => document.id));
		const nextSelectedIds = selectedIds.filter((id) => visibleIds.has(id));
		const changed =
			nextSelectedIds.length !== selectedIds.length ||
			nextSelectedIds.some((id, index) => id !== selectedIds[index]);

		if (changed) {
			selectedIds = nextSelectedIds;
		}
	});

	const selectedDocuments = $derived(
		filteredDocuments.filter((document) => selectedIds.includes(document.id))
	);

	const allVisibleSelected = $derived(
		filteredDocuments.length > 0 && filteredDocuments.every((document) => selectedIds.includes(document.id))
	);

	function toggleSelection(id: string) {
		selectedIds = selectedIds.includes(id)
			? selectedIds.filter((selectedId) => selectedId !== id)
			: [...selectedIds, id];
	}

	function toggleSelectAll() {
		selectedIds = allVisibleSelected ? [] : filteredDocuments.map((document) => document.id);
	}

	function clearSelection() {
		selectedIds = [];
		bulkCategory = '';
		showBulkDeleteConfirm = false;
	}

	function formatDate(iso: string) {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) {
			return '-';
		}

		return new Intl.DateTimeFormat('it-IT', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		}).format(date);
	}

	function formatCurrency(value?: number) {
		if (typeof value !== 'number' || Number.isNaN(value)) {
			return '-';
		}

		return new Intl.NumberFormat('it-IT', {
			style: 'currency',
			currency: 'EUR',
			maximumFractionDigits: 2
		}).format(value);
	}

	function totalForDocument(document: (typeof processedDocuments)[number]) {
		return document.invoiceData?.totalAmount ?? document.amount;
	}

	function primaryTag(document: (typeof processedDocuments)[number]) {
		return document.tags[0] ?? '-';
	}

	function handleBulkDelete() {
		for (const id of selectedIds) {
			removeVaultDocument(id);
		}
		clearSelection();
	}

	function handleBulkExport() {
		if (!selectedDocuments.length) {
			return;
		}

		const blob = new Blob([JSON.stringify(selectedDocuments, null, 2)], {
			type: 'application/json'
		});
		const url = URL.createObjectURL(blob);
		const link = window.document.createElement('a');
		link.href = url;
		link.download = 'fattura-vault-export.json';
		link.click();
		URL.revokeObjectURL(url);
	}

	function handleBulkDownload() {
		for (const document of selectedDocuments) {
			downloadVaultDocument(document.id);
		}
	}

	function isDownloading(documentId: string) {
		return $vaultAssetOperationState.downloadingDocumentIds.includes(documentId);
	}

	function syncStateLabel(document: (typeof processedDocuments)[number]) {
		return document.remoteSyncState === 'pending' ? 'Salvataggio in corso' : 'Salvato';
	}

	function syncStateClasses(document: (typeof processedDocuments)[number]) {
		return document.remoteSyncState === 'pending'
			? 'bg-[#fff4d7] text-[#9a6c00]'
			: 'bg-[#e9f8ef] text-[#1f7a45]';
	}

	function applyBulkCategory() {
		if (!bulkCategory) {
			return;
		}

		for (const document of selectedDocuments) {
			setVaultDocumentCategory(document.id, bulkCategory);
		}

		clearSelection();
	}

	function confirmBulkDelete() {
		showBulkDeleteConfirm = true;
	}

	function closeBulkDeleteConfirm() {
		showBulkDeleteConfirm = false;
	}

	function requestSingleDelete(documentId: string) {
		pendingDeleteDocumentId = documentId;
	}

	function closeSingleDeleteConfirm() {
		pendingDeleteDocumentId = null;
	}

	function confirmSingleDelete() {
		if (!pendingDeleteDocumentId) {
			return;
		}

		removeVaultDocument(pendingDeleteDocumentId);
		pendingDeleteDocumentId = null;
	}
</script>

<svelte:head>
	<title>Vault | Fattura Vault</title>
</svelte:head>

<div class="min-h-screen bg-[#f7fafc] text-[#12303b] [font-family:'Inter',system-ui,sans-serif]">
	<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.96),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.18),transparent_24%)]"></div>

	<div class="relative flex min-h-screen flex-col lg:flex-row">
		<aside class="relative z-30 flex w-full shrink-0 flex-col border-b border-[#dbe5ea] bg-white/72 px-5 py-5 shadow-[0_18px_50px_rgba(148,163,184,0.08)] backdrop-blur lg:w-[278px] lg:border-r lg:border-b-0 lg:px-4 lg:py-4">
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
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl bg-[#0f5d6c] px-4 py-4 text-left text-lg font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.18)]" href="/vault">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24">
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

		<div class="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
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
								<p class="mt-2 text-sm leading-6 text-[#58707a]">Scegli il nome da mostrare nel tuo vault.</p>

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

			<main class="relative z-10 min-w-0 flex-1 overflow-x-hidden px-5 py-6 sm:px-8 lg:px-10">
				<div class="mx-auto min-w-0 max-w-[1280px]">
					<h1 class="text-[2.4rem] font-extrabold tracking-[-0.05em] text-[#0f5666] sm:text-[3.4rem]">IL TUO VAULT</h1>
					<p class="mt-3 max-w-4xl text-sm leading-6 text-[#5a707a]">
						Qui trovi tutti i documenti già archiviati, filtrabili per categoria, tag e data, con vista tabella o schede in base al modo in cui preferisci lavorare.
					</p>

					{#if selectedIds.length}
						<section class="relative z-40 mt-6 rounded-[1.6rem] border-2 border-[#7ec8d3] bg-[linear-gradient(135deg,rgba(239,250,252,0.98),rgba(255,255,255,0.97))] px-5 py-4 shadow-[0_20px_50px_rgba(15,93,108,0.18)] ring-1 ring-[#d8eef1] backdrop-blur">
							<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
								<div>
									<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f5d6c]">Azioni bulk</p>
									<p class="mt-1 text-lg font-bold tracking-[-0.03em] text-[#173843]">
										{selectedIds.length} {selectedIds.length === 1 ? 'documento selezionato' : 'documenti selezionati'}
									</p>
									<p class="mt-1 text-sm font-medium text-[#5b717b]">
										Applica azioni rapide ai documenti che hai selezionato.
									</p>
								</div>

								<div class="flex flex-wrap items-center gap-3">
									<div class="min-w-[220px]">
										<CategoryDropdown
											categories={$categoriesState}
											selected={bulkCategory || null}
											label="Cambia categoria"
											on:select={(event) => (bulkCategory = event.detail.value ?? '')}
										/>
									</div>
									<button class="rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" type="button" onclick={applyBulkCategory}>Applica</button>
									<button class="rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" type="button" onclick={handleBulkExport}>Esporta</button>
									<button class="rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" type="button" onclick={handleBulkDownload}>Scarica</button>
									<button class="rounded-full border border-[#f1cccc] bg-[#fff3f3] px-4 py-2 text-sm font-semibold text-[#a23939] transition-colors hover:bg-[#ffe7e7]" type="button" onclick={confirmBulkDelete}>Elimina</button>
									<button class="rounded-full px-4 py-2 text-sm font-semibold text-[#58707a] transition-colors hover:bg-[#f6fafb]" type="button" onclick={clearSelection}>Deseleziona</button>
								</div>
							</div>
						</section>
					{/if}

					{#if showBulkDeleteConfirm}
						<div class="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(15,23,42,0.28)] px-4">
							<div class="w-full max-w-[420px] rounded-[1.8rem] border border-[#e4edf1] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#8aa0aa]">Conferma eliminazione</p>
								<h2 class="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#173843]">Eliminare i documenti selezionati?</h2>
								<p class="mt-3 text-sm leading-6 text-[#5b717b]">
					Stai per eliminare {selectedIds.length} {selectedIds.length === 1 ? 'documento' : 'documenti'} dal vault. Questa azione non si può annullare.
								</p>

								<div class="mt-6 flex flex-wrap justify-end gap-3">
									<button
										class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d9e4e8] bg-white px-5 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5"
										type="button"
										onclick={closeBulkDeleteConfirm}
									>
										Annulla
									</button>
									<button
										class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#b94d4d] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(185,77,77,0.22)] transition-transform hover:-translate-y-0.5"
										type="button"
										onclick={handleBulkDelete}
									>
										Elimina
									</button>
								</div>
							</div>
						</div>
					{/if}

					{#if pendingDeleteDocumentId}
						<div class="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(15,23,42,0.28)] px-4">
							<div class="w-full max-w-[420px] rounded-[1.8rem] border border-[#e4edf1] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
								<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#8aa0aa]">Conferma eliminazione</p>
								<h2 class="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#173843]">Eliminare questo documento?</h2>
								<p class="mt-3 text-sm leading-6 text-[#5b717b]">
									Stai per eliminare un documento dal vault. Questa azione non si può annullare.
								</p>

								<div class="mt-6 flex flex-wrap justify-end gap-3">
									<button
										class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d9e4e8] bg-white px-5 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5"
										type="button"
										onclick={closeSingleDeleteConfirm}
									>
										Annulla
									</button>
									<button
										class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#b94d4d] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(185,77,77,0.22)] transition-transform hover:-translate-y-0.5"
										type="button"
										onclick={confirmSingleDelete}
									>
										Elimina
									</button>
								</div>
							</div>
						</div>
					{/if}

					<section class="relative z-10 mt-6 rounded-[2rem] border border-white/85 bg-white/78 p-5 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-6">
						<div class="flex flex-wrap items-center gap-3">
							<input
								class="min-h-[54px] min-w-[240px] flex-1 rounded-[1.25rem] border border-[#d7e2e7] bg-white px-5 text-sm font-medium text-[#173843] outline-none placeholder:text-[#8ca0aa] focus:border-[#0f5d6c]"
								type="search"
								bind:value={searchQuery}
								placeholder="Cerca documenti, esercenti o tag..."
							/>

							<div class="min-w-[220px]">
								<CategoryDropdown
									categories={$categoriesState}
									selected={selectedCategory || null}
									label="Tutte le categorie"
									on:select={(event) => (selectedCategory = event.detail.value ?? '')}
								/>
							</div>

							<select class="min-h-[54px] min-w-[180px] rounded-[1.25rem] border border-[#d7e2e7] bg-white px-4 text-sm font-medium text-[#173843] outline-none" bind:value={selectedTag}>
								<option value="all">Tutti i tag</option>
								{#each availableTags as tag}
									<option value={tag}>{tag}</option>
								{/each}
							</select>

							<select class="min-h-[54px] min-w-[180px] rounded-[1.25rem] border border-[#d7e2e7] bg-white px-4 text-sm font-medium text-[#173843] outline-none" bind:value={selectedPayment}>
								<option value="all">Tutti i pagamenti</option>
								<option value="due">Solo da pagare</option>
								<option value="paid">Solo pagati</option>
							</select>

							<div class="relative">
								<input
									class="min-h-[54px] min-w-[180px] rounded-[1.25rem] border border-[#d7e2e7] bg-white py-3 pl-11 pr-4 text-sm font-medium text-[#173843] outline-none"
									type="date"
									bind:value={selectedDate}
								/>
								<svg aria-hidden="true" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6a8792]" fill="none" viewBox="0 0 24 24">
									<path d="M7.2 4.6v2.2m9.6-2.2v2.2M5.8 8.4h12.4M7 19h10a2 2 0 0 0 2-2V8.6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2V17a2 2 0 0 0 2 2Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
								</svg>
							</div>

							<div class="inline-flex min-h-[54px] rounded-[1.25rem] border border-[#d7e2e7] bg-white p-1">
								<button
									aria-label="Vista tabella"
									class={`inline-flex min-w-[54px] items-center justify-center rounded-[1rem] transition-colors ${viewMode === 'table' ? 'bg-[#0f5d6c] text-white shadow-[0_10px_20px_rgba(15,93,108,0.2)]' : 'text-[#5a707a]'}`}
									type="button"
									onclick={() => (viewMode = 'table')}
								>
									<svg aria-hidden="true" class="h-5 w-5" fill="none" viewBox="0 0 24 24">
										<path d="M4 7.5h16M4 12h16M4 16.5h16" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
									</svg>
								</button>
								<button
									aria-label="Vista griglia"
									class={`inline-flex min-w-[54px] items-center justify-center rounded-[1rem] transition-colors ${viewMode === 'grid' ? 'bg-[#0f5d6c] text-white shadow-[0_10px_20px_rgba(15,93,108,0.2)]' : 'text-[#5a707a]'}`}
									type="button"
									onclick={() => (viewMode = 'grid')}
								>
									<svg aria-hidden="true" class="h-5 w-5" fill="none" viewBox="0 0 24 24">
										<rect x="4.5" y="4.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.7" />
										<rect x="13.5" y="4.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.7" />
										<rect x="4.5" y="13.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.7" />
										<rect x="13.5" y="13.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.7" />
									</svg>
								</button>
							</div>
						</div>

						{#if filteredDocuments.length}
							{#if viewMode === 'table'}
								<div class="mt-6 overflow-x-auto rounded-[1.7rem] border border-[#e3edf1] bg-white/88">
									<table class="min-w-full border-separate border-spacing-0 text-left">
										<thead class="bg-[#fbfcfd]">
											<tr class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">
												<th class="w-14 px-4 py-4">
													<input class="h-4 w-4 accent-[#0f5d6c]" type="checkbox" checked={allVisibleSelected} onchange={toggleSelectAll} />
												</th>
												<th class="px-4 py-4">Nome</th>
												<th class="px-4 py-4">Esercente</th>
												<th class="px-4 py-4">Caricata il</th>
												<th class="px-4 py-4">Tag</th>
												<th class="px-4 py-4">Categoria</th>
												<th class="px-4 py-4 text-center">File</th>
												<th class="px-4 py-4 text-right">Totale</th>
												<th class="px-4 py-4 text-right">Azioni</th>
											</tr>
										</thead>
										<tbody>
											{#each filteredDocuments as document}
												{@const category = getCategoryByName(document.categoryName, $categoriesState)}
												{@const isSelected = selectedIds.includes(document.id)}
												<tr class={`text-sm text-[#173843] transition-colors ${isSelected ? 'bg-[rgba(15,93,108,0.07)]' : document.paymentStatus === 'due' ? 'bg-[#fff8f8]' : 'bg-transparent'}`}>
													<td class="border-t border-[#edf2f5] px-4 py-4 align-top">
														<input class="mt-1 h-4 w-4 accent-[#0f5d6c]" type="checkbox" checked={selectedIds.includes(document.id)} onchange={() => toggleSelection(document.id)} />
													</td>
													<td class={`border-t px-4 py-4 align-top ${isSelected ? 'border-[#bcdfe5]' : document.paymentStatus === 'due' ? 'border-[#f2c1c1]' : 'border-[#edf2f5]'}`}>
														<div class="max-w-[18rem]">
															<p class="font-semibold tracking-[-0.02em] text-[#173843]">{document.title || document.name}</p>
															<p class="mt-1 text-xs font-medium text-[#6a8792]">{document.name}</p>
														</div>
													</td>
													<td class={`border-t px-4 py-4 align-top ${isSelected ? 'border-[#bcdfe5]' : document.paymentStatus === 'due' ? 'border-[#f2c1c1]' : 'border-[#edf2f5]'}`}>{document.merchantName || '-'}</td>
													<td class={`border-t px-4 py-4 align-top ${isSelected ? 'border-[#bcdfe5]' : document.paymentStatus === 'due' ? 'border-[#f2c1c1]' : 'border-[#edf2f5]'}`}>{formatDate(document.createdAt)}</td>
													<td class={`border-t px-4 py-4 align-top ${isSelected ? 'border-[#bcdfe5]' : document.paymentStatus === 'due' ? 'border-[#f2c1c1]' : 'border-[#edf2f5]'}`}>
														{#if primaryTag(document) !== '-'}
															<span class="inline-flex rounded-full bg-[#f4f8fa] px-3 py-1 text-xs font-semibold text-[#5b717b]">{primaryTag(document)}</span>
														{:else}
															<span class="text-[#8ca0aa]">-</span>
														{/if}
													</td>
													<td class={`border-t px-4 py-4 align-top ${isSelected ? 'border-[#bcdfe5]' : document.paymentStatus === 'due' ? 'border-[#f2c1c1]' : 'border-[#edf2f5]'}`}>
														{#if category}
															<CategoryBadge {category} />
														{:else}
															<span class="text-[#8ca0aa]">-</span>
														{/if}
													</td>
													<td class={`border-t px-4 py-4 text-center align-top ${isSelected ? 'border-[#bcdfe5]' : document.paymentStatus === 'due' ? 'border-[#f2c1c1]' : 'border-[#edf2f5]'}`}>1</td>
													<td class={`border-t px-4 py-4 text-right font-semibold text-[#b05555] align-top ${isSelected ? 'border-[#bcdfe5]' : document.paymentStatus === 'due' ? 'border-[#f2c1c1]' : 'border-[#edf2f5]'}`}>{formatCurrency(totalForDocument(document))}</td>
													<td class={`border-t px-4 py-4 align-top ${isSelected ? 'border-[#bcdfe5]' : document.paymentStatus === 'due' ? 'border-[#f2c1c1]' : 'border-[#edf2f5]'}`}>
														<div class="flex justify-end gap-2">
															<span class={`inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold ${syncStateClasses(document)}`}>
																{syncStateLabel(document)}
															</span>
															{#if document.paymentStatus === 'due'}
																<span class="inline-flex items-center justify-center rounded-full bg-[#fff1f1] px-3 py-2 text-xs font-semibold text-[#b42318]">
																	Da pagare
																</span>
															{/if}
															<a class="inline-flex items-center justify-center rounded-full border border-[#d9e4e8] px-3 py-2 text-xs font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" href={`/documento?id=${encodeURIComponent(document.id)}`}>Apri</a>
															<button class="inline-flex items-center justify-center rounded-full border border-[#d9e4e8] px-3 py-2 text-xs font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb] disabled:cursor-wait disabled:opacity-70" type="button" onclick={() => downloadVaultDocument(document.id)} disabled={isDownloading(document.id)}>{isDownloading(document.id) ? 'Scarico...' : 'Scarica'}</button>
															<button class="inline-flex items-center justify-center rounded-full border border-[#f1cccc] bg-[#fff3f3] px-3 py-2 text-xs font-semibold text-[#a23939] transition-colors hover:bg-[#ffe7e7]" type="button" onclick={() => requestSingleDelete(document.id)}>Elimina</button>
														</div>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{:else}
								<div class="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
									{#each filteredDocuments as document}
										{@const category = getCategoryByName(document.categoryName, $categoriesState)}
										{@const isSelected = selectedIds.includes(document.id)}
										<div class={`rounded-[1.7rem] p-5 shadow-[0_12px_28px_rgba(148,163,184,0.08)] transition-all ${isSelected ? 'border-2 border-[#7ec8d3] bg-[linear-gradient(135deg,rgba(239,250,252,0.98),rgba(255,255,255,0.97))] ring-1 ring-[#d8eef1] shadow-[0_18px_40px_rgba(15,93,108,0.16)]' : document.paymentStatus === 'due' ? 'border border-[#dc2626] bg-[#fff8f8]' : 'border border-[#e3edf1] bg-white/88'}`}>
											<div class="flex items-start justify-between gap-3">
												<label class="inline-flex items-center gap-3">
													<input class="h-4 w-4 accent-[#0f5d6c]" type="checkbox" checked={selectedIds.includes(document.id)} onchange={() => toggleSelection(document.id)} />
													<span class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Seleziona</span>
												</label>
												{#if category}
													<CategoryBadge {category} />
												{/if}
											</div>

											<div class="mt-4 min-w-0">
												<h2 class="break-all text-xl font-bold tracking-[-0.03em] text-[#173843] sm:break-normal sm:truncate">{document.title || document.name}</h2>
												<p class="mt-1 text-sm text-[#5a707a]">{document.merchantName || 'Esercente non indicato'}</p>
											</div>

											<div class="mt-5 grid gap-3 rounded-[1.4rem] bg-[#f8fbfc] p-4 text-sm text-[#4e6670] sm:grid-cols-2">
												<div>
													<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Caricata il</p>
													<p class="mt-1 font-semibold text-[#173843]">{formatDate(document.createdAt)}</p>
												</div>
												<div>
													<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Totale</p>
													<p class="mt-1 font-semibold text-[#173843]">{formatCurrency(totalForDocument(document))}</p>
												</div>
												<div>
													<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Tag</p>
													<p class="mt-1 font-semibold text-[#173843]">{primaryTag(document)}</p>
												</div>
												<div>
													<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">File</p>
													<p class="mt-1 font-semibold text-[#173843]">1 allegato</p>
												</div>
											</div>

											<div class="mt-5 flex flex-wrap gap-2">
												<span class={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ${syncStateClasses(document)}`}>
													{syncStateLabel(document)}
												</span>
												{#if document.paymentStatus === 'due'}
													<span class="inline-flex items-center justify-center rounded-full bg-[#fff1f1] px-4 py-2 text-sm font-semibold text-[#b42318]">
														Da pagare
													</span>
												{/if}
												<a class="inline-flex items-center justify-center rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" href={`/documento?id=${encodeURIComponent(document.id)}`}>Apri</a>
												<button class="inline-flex items-center justify-center rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb] disabled:cursor-wait disabled:opacity-70" type="button" onclick={() => downloadVaultDocument(document.id)} disabled={isDownloading(document.id)}>{isDownloading(document.id) ? 'Scarico...' : 'Scarica'}</button>
												<button class="inline-flex items-center justify-center rounded-full border border-[#f1cccc] bg-[#fff3f3] px-4 py-2 text-sm font-semibold text-[#a23939] transition-colors hover:bg-[#ffe7e7]" type="button" onclick={() => requestSingleDelete(document.id)}>Elimina</button>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						{:else}
							<div class="mt-6 rounded-[1.7rem] border border-[#e3edf1] bg-white/88 p-6">
								<h2 class="text-2xl font-bold tracking-[-0.03em] text-[#173843]">Nessun documento corrisponde ai filtri</h2>
								<p class="mt-3 max-w-2xl text-sm leading-6 text-[#5a707a]">
									Prova a cambiare ricerca, categoria, tag o data. Appena inizierai ad archiviare documenti, qui avrai una vista completa in tabella o a schede.
								</p>
							</div>
						{/if}
					</section>
				</div>
			</main>
		</div>
	</div>
</div>
