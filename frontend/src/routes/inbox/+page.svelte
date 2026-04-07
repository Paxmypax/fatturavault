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
	import {
		addInboxDocuments,
		initInbox,
		inboxState,
		removeInboxDocumentAndSync,
		type InboxDocument
	} from '$lib/inbox';
	import { initVault } from '$lib/vault';
	import { analyticsAccessState, initAnalyticsAccess } from '$lib/stores/analyticsAccess';
	import {
		categoriesState,
		getCategoryByName,
		initCategories
	} from '$lib/stores/categories';
	import { onMount } from 'svelte';

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
	});

	let displayNameInput = $state('');
	let showDisplayNameEditor = $state(false);
	let isDragging = $state(false);
	let selectedCategory = $state<string | null>(null);
	let fileInput: HTMLInputElement | null = null;
	let pendingDeleteId = $state<string | null>(null);

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

	function openPicker() {
		if (!fileInput) {
			return;
		}

		const picker = fileInput as HTMLInputElement & { showPicker?: () => void };
		if (typeof picker.showPicker === 'function') {
			picker.showPicker();
			return;
		}

		fileInput.click();
	}

	async function handleSelection(fileList: FileList | null) {
		if (!fileList?.length) {
			return;
		}

		await addInboxDocuments(Array.from(fileList));
		if (fileInput) {
			fileInput.value = '';
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		await handleSelection(event.dataTransfer?.files ?? null);
	}

	function formatSize(bytes: number) {
		if (!bytes) {
			return '0 KB';
		}

		if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(1)} KB`;
		}

		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatUploadDate(iso: string) {
		const date = new Date(iso);
		return Number.isNaN(date.getTime())
			? '--'
			: new Intl.DateTimeFormat('it-IT', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric'
				}).format(date);
	}

	function typeLabel(document: InboxDocument) {
		const extension = document.name.split('.').pop()?.toUpperCase();
		if (extension) {
			return extension;
		}

		return document.type || 'FILE';
	}

	function statusLabel(document: InboxDocument) {
		if (document.status === 'processing') {
			return 'In caricamento';
		}

		if (document.status === 'ready_for_review') {
			return 'Pronto da gestire';
		}

		if (document.status === 'error') {
			return 'Caricamento non riuscito';
		}

		if (document.status === 'archived') {
			return 'Archiviato';
		}

		return 'In inbox';
	}

	function statusClasses(document: InboxDocument) {
		if (document.status === 'processing') {
			return 'bg-[#fff4d7] text-[#9a6c00]';
		}

		if (document.status === 'ready_for_review') {
			return 'bg-[#e9f8ef] text-[#1f7a45]';
		}

		if (document.status === 'error') {
			return 'bg-[#fff3f3] text-[#a23939]';
		}

		if (document.status === 'archived') {
			return 'bg-[#eef8fa] text-[#0f5d6c]';
		}

		return 'bg-[#f4f8fa] text-[#58707a]';
	}

	function canOpenDocument(document: InboxDocument) {
		return document.status === 'ready_for_review' || document.status === 'uploaded';
	}

	function dropzoneStyle(active: boolean) {
		return [
			`background-color: ${active ? '#dbecef' : 'rgba(215, 232, 236, 0.72)'}`,
			`outline: 3px dashed ${active ? '#0b4c58' : '#0f5d6c'}`,
			'outline-offset: -10px',
			'box-shadow: inset 0 0 0 1px rgba(15, 93, 108, 0.08)'
		].join('; ');
	}

	function handleDeleteDocument(id: string) {
		pendingDeleteId = id;
	}

	function confirmDeleteDocument() {
		if (!pendingDeleteId) {
			return;
		}

		void removeInboxDocumentAndSync(pendingDeleteId);
		pendingDeleteId = null;
	}

	let inboxDocs = $derived($inboxState.documents);
	let processingDocsCount = $derived(
		inboxDocs.filter((document) => document.status === 'processing').length
	);

	$effect(() => {
		if (typeof window === 'undefined' || processingDocsCount <= 0) {
			return;
		}

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	});

	function visibleDocuments(documents: InboxDocument[]) {
		if (!selectedCategory) {
			return documents;
		}

		return documents.filter((document) => document.categoryName === selectedCategory);
	}
</script>

<svelte:head>
	<title>Inbox | Fattura Vault</title>
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
				<div class="mx-auto max-w-[1080px]">
					<h1 class="text-[2.4rem] font-extrabold tracking-[-0.05em] text-[#0f5666] sm:text-[3.4rem]">LA TUA INBOX</h1>
					<p class="mt-3 max-w-3xl text-sm leading-6 text-[#5a707a]">
						Carica tutto qui dentro al volo, poi rivedi e sistema i documenti con calma quando hai tempo.
					</p>

					<div class="mt-6 grid gap-4 lg:grid-cols-2">
						<div class="rounded-[1.9rem] border border-white/90 bg-white/82 px-5 py-4 shadow-[0_18px_45px_rgba(148,163,184,0.14)] backdrop-blur">
							<div class="grid min-h-[124px] grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
								<div class="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-[1.3rem] bg-[#d7e8ec] text-[#1b5f6f]">
									<svg aria-hidden="true" class="h-11 w-11" fill="none" viewBox="0 0 24 24">
										<path d="M4.8 8.3A2.3 2.3 0 0 1 7.1 6h3.2l1.4 1.6H17a2.3 2.3 0 0 1 2.3 2.3v5.8A2.3 2.3 0 0 1 17 18H7.1a2.3 2.3 0 0 1-2.3-2.3V8.3Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7" />
										<path d="M14.1 5.4h4.2M14.1 10.4h4.2M14.7 5.9c0 1.1.95 1.55 1.6 2.1.66.56 1.6 1 1.6 2.1M17.9 5.9c0 1.1-.95 1.55-1.6 2.1-.66.56-1.6 1-1.6 2.1" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.25" />
									</svg>
								</div>
								<div class="flex min-h-[80px] flex-col justify-center">
									<p class="text-[1.1rem] font-medium leading-6 text-[#1f3037]">File in Attesa</p>
									<p class="mt-2 text-[3.15rem] leading-none font-extrabold tracking-[-0.07em] text-[#103844]">{inboxDocs.length}</p>
								</div>
							</div>
						</div>

						<div class="rounded-[1.9rem] border border-white/90 bg-white/82 px-5 py-4 shadow-[0_18px_45px_rgba(148,163,184,0.14)] backdrop-blur">
							<div class="grid min-h-[124px] grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
								<div class="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-[1.3rem] bg-[#d7e8ec] text-[#1b5f6f]">
									<svg aria-hidden="true" class="h-11 w-11" fill="none" viewBox="0 0 24 24">
										<path d="m9.7 3.8.5 1.8a6.7 6.7 0 0 1 3.6 0l.5-1.8 2.4.9-.5 1.8a6.9 6.9 0 0 1 2.6 2.6l1.8-.5.9 2.4-1.8.5a6.7 6.7 0 0 1 0 3.6l1.8.5-.9 2.4-1.8-.5a6.9 6.9 0 0 1-2.6 2.6l.5 1.8-2.4.9-.5-1.8a6.7 6.7 0 0 1-3.6 0l-.5 1.8-2.4-.9.5-1.8a6.9 6.9 0 0 1-2.6-2.6l-1.8.5-.9-2.4 1.8-.5a6.7 6.7 0 0 1 0-3.6l-1.8-.5.9-2.4 1.8.5a6.9 6.9 0 0 1 2.6-2.6l-.5-1.8 2.4-.9Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" />
										<circle cx="12" cy="12" r="2.8" stroke="currentColor" stroke-width="1.6" />
									</svg>
								</div>
								<div class="flex min-h-[80px] flex-col justify-center">
									<p class="text-[1.1rem] font-medium leading-6 text-[#1f3037]">Stato Elaborazione</p>
									<p class="mt-2 text-[3.15rem] leading-none font-extrabold tracking-[-0.07em] text-[#103844]">
										{processingDocsCount} in corso
									</p>
									<p class="mt-2 text-sm font-medium text-[#5a707a]">
										File pronti appena il caricamento nel canister inbox termina.
									</p>
								</div>
							</div>
						</div>
					</div>

					{#if processingDocsCount > 0}
						<div class="mt-4 rounded-[1.4rem] border border-[#fff1c7] bg-[#fffaf0] px-4 py-4 shadow-[0_10px_24px_rgba(210,164,68,0.08)]">
							<p class="text-sm font-semibold text-[#9a6c00]">
								Non ricaricare e non abbandonare questa pagina finché i file non risultano
								pronti da gestire.
							</p>
							<p class="mt-1 text-sm leading-6 text-[#8a6b1b]">
								Abbiamo ancora {processingDocsCount} file in caricamento nel canister inbox.
							</p>
						</div>
					{/if}

					<section class="mt-6 rounded-[2rem] border border-white/85 bg-white/76 p-5 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-6">
						<div
							role="button"
							tabindex="0"
							class="relative w-full cursor-pointer rounded-[1.6rem] px-6 py-8 text-center transition-colors"
							style={dropzoneStyle(isDragging)}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									openPicker();
								}
							}}
							ondragenter={(event) => {
								event.preventDefault();
								isDragging = true;
							}}
							ondragover={(event) => {
								event.preventDefault();
								isDragging = true;
							}}
							ondragleave={(event) => {
								event.preventDefault();
								isDragging = false;
							}}
							ondrop={handleDrop}
						>
							<input
								id="vault-file-input"
								bind:this={fileInput}
								class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
								type="file"
								multiple
								accept=".pdf,.doc,.docx,.xml,.jpg,.jpeg,.png,.csv"
								onchange={(event) => handleSelection((event.currentTarget as HTMLInputElement).files)}
							/>

							<div class="pointer-events-none flex min-h-[96px] items-center justify-center">
								<p class="text-center text-[1.2rem] font-extrabold tracking-[-0.04em] text-[#103844] lg:text-[1.35rem]">
									TRASCINA I FILE QUI O CLICCA PER CARICARE
								</p>
							</div>
						</div>
						<p class="mt-4 text-sm leading-6 text-[#5a707a]">
							Limiti attivi: massimo 5 MB per file. Le immagini più pesanti vengono compresse automaticamente prima dell'upload. Inbox temporanea fino a 500 MB, vault personale fino a 5 GB.
						</p>
					</section>

					<section class="mt-6 rounded-[2rem] border border-white/85 bg-white/76 p-5 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-6">
						<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
							<div>
								<h2 class="text-[2rem] font-bold tracking-[-0.04em] text-[#103844]">File Recenti in Inbox</h2>
								<p class="mt-2 text-sm leading-6 text-[#5a707a]">Filtra i documenti per categoria e tieni pulita la tua inbox fin dal primo caricamento.</p>
							</div>

							<div class="lg:pt-1">
								<CategoryDropdown
									categories={$categoriesState}
									selected={selectedCategory}
									on:select={(event) => (selectedCategory = event.detail.value)}
								/>
							</div>
						</div>

						{#if visibleDocuments(inboxDocs).length}
							<div class="mt-6 rounded-[1.7rem] border border-[#e3edf1] bg-white/85 p-3 sm:p-4">
								<div class="flex items-center justify-between rounded-[1.2rem] bg-[#f6fafb] px-4 py-3">
									<div>
										<p class="text-sm font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Panoramica</p>
										<p class="mt-1 text-base font-semibold text-[#173843]">Gli ultimi documenti entrati nella tua inbox</p>
									</div>
									<span class="inline-flex rounded-full bg-[#dff1f3] px-3 py-1 text-sm font-semibold text-[#0f5d6c]">
										{visibleDocuments(inboxDocs).length} file
									</span>
								</div>

								<div class="mt-3 grid gap-3">
									{#each visibleDocuments(inboxDocs).slice(0, 8) as document}
										<div class="rounded-[1.35rem] border border-[#e8eff2] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
											<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
												<div class="flex min-w-0 items-start gap-4">
													<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-[#dff1f3] text-[#0f5d6c]">
														<svg aria-hidden="true" class="h-6 w-6" fill="none" viewBox="0 0 24 24">
															<path d="M7 4.8h6.5L19 10v8.2A2 2 0 0 1 17 20H7a2 2 0 0 1-2-1.8V6.8A2 2 0 0 1 7 4.8Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7" />
															<path d="M13.5 4.9V10H19M8.5 12.2h7M8.5 15.2h5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
														</svg>
													</div>

													<div class="min-w-0">
														<p class="break-all text-lg font-semibold tracking-[-0.02em] text-[#173843] sm:break-normal sm:truncate">{document.name}</p>
														<div class="mt-2 flex flex-wrap gap-2 text-sm font-medium text-[#58707a]">
															<span class="rounded-full bg-[#f4f8fa] px-3 py-1">{typeLabel(document)}</span>
															<span class="rounded-full bg-[#f4f8fa] px-3 py-1">{formatSize(document.size)}</span>
															<span class="rounded-full bg-[#f4f8fa] px-3 py-1">{formatUploadDate(document.createdAt)}</span>
														</div>
								<div class="mt-3">
									{#if getCategoryByName(document.categoryName, $categoriesState)}
										<CategoryBadge category={getCategoryByName(document.categoryName, $categoriesState)!} />
									{/if}
								</div>
								{#if document.status === 'processing'}
									<p class="mt-3 text-sm font-medium text-[#9a6c00]">
										Sto preparando il file. Sarà disponibile tra poco.
									</p>
								{:else if document.status === 'error'}
									<p class="mt-3 text-sm font-medium text-[#a23939]">
										{document.errorMessage ?? 'Il caricamento non è andato a buon fine. Riprova.'}
									</p>
								{/if}
							</div>
						</div>

						<div class="flex items-center gap-3">
							<span class={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusClasses(document)}`}>{statusLabel(document)}</span>
							{#if canOpenDocument(document)}
								<a class="inline-flex items-center justify-center rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" href={`/documento?id=${encodeURIComponent(document.id)}`}>
									Apri
								</a>
							{:else}
								<span class="inline-flex items-center justify-center rounded-full border border-[#e3edf1] bg-[#f6fafb] px-4 py-2 text-sm font-semibold text-[#8aa0aa]">
									Attendi
								</span>
							{/if}
							<button class="inline-flex items-center justify-center rounded-full border border-[#f1cccc] bg-[#fff3f3] px-4 py-2 text-sm font-semibold text-[#a23939] transition-colors hover:bg-[#ffe7e7]" type="button" onclick={() => handleDeleteDocument(document.id)}>
								Elimina
							</button>
												</div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{:else}
							<div class="mt-6 rounded-[1.7rem] border border-[#e3edf1] bg-white/85 p-6">
								<h3 class="text-xl font-bold tracking-[-0.03em] text-[#173843]">
									{selectedCategory ? `Nessun file nella categoria ${selectedCategory}` : 'Nessun file recente in inbox'}
								</h3>
								<p class="mt-2 text-sm leading-6 text-[#5a707a]">
									{selectedCategory
										? 'Cambia filtro oppure assegna una categoria ai prossimi documenti che caricherai.'
										: 'Quando caricherai i primi documenti, li troverai qui pronti da gestire, verificare e organizzare.'}
								</p>
							</div>
						{/if}
					</section>
				</div>
			</main>
		</div>
	</div>

	{#if pendingDeleteId}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-[#0e2330]/35 px-4 backdrop-blur-[2px]">
			<div class="w-full max-w-md rounded-[1.6rem] border border-[#e8eff2] bg-white p-5 shadow-[0_25px_70px_rgba(15,35,48,0.22)]">
				<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Conferma</p>
				<h2 class="mt-2 text-xl font-bold tracking-[-0.03em] text-[#173843]">Elimina documento</h2>
				<p class="mt-3 text-sm leading-6 text-[#5a707a]">
					Vuoi davvero eliminare questo file dalla inbox?
				</p>
				<div class="mt-5 flex justify-end gap-3">
					<button type="button" class="rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" onclick={() => (pendingDeleteId = null)}>
						Annulla
					</button>
					<button type="button" class="rounded-full border border-[#f1cccc] bg-[#fff3f3] px-4 py-2 text-sm font-semibold text-[#a23939] transition-colors hover:bg-[#ffe7e7]" onclick={confirmDeleteDocument}>
						Elimina
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

