<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		authState,
		initAuth,
		isSecurityOnboardingComplete,
		logout,
		saveDisplayName
	} from '$lib/auth';
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import CategoryDocumentList from '$lib/components/CategoryDocumentList.svelte';
	import CategoryManager from '$lib/components/CategoryManager.svelte';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import { analyticsAccessState, initAnalyticsAccess } from '$lib/stores/analyticsAccess';
	import { initCategories, categoriesState } from '$lib/stores/categories';
	import { initVault, vaultState } from '$lib/vault';
	import { onMount } from 'svelte';
	import type { Category } from '$lib/types';

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

		const params = new URLSearchParams(window.location.search);
		const requestedCategory = params.get('category');
		if (requestedCategory) {
			const matchedCategory =
				$categoriesState.find((category) => category.name === requestedCategory) ?? null;
			if (matchedCategory) {
				selectedCategory = matchedCategory;
				hasAutoSelectedCategory = true;
			}
		}
	});

	let displayNameInput = $state('');
	let showDisplayNameEditor = $state(false);
	let selectedCategory = $state<Category | null>(null);
	let hasAutoSelectedCategory = $state(false);

	function principalLabel(principal: string | null) {
		if (!principal) return 'Sessione attiva';
		if (principal.length <= 18) return principal;
		return `${principal.slice(0, 10)}...${principal.slice(-6)}`;
	}

	$effect(() => {
		if ($authState.displayName && !$authState.pending) {
			displayNameInput = $authState.displayName;
		}
	});

	$effect(() => {
		if (selectedCategory || hasAutoSelectedCategory) {
			return;
		}

		const firstCategoryWithDocuments =
			$categoriesState.find((category) => docsForCategory(category).length > 0) ?? null;
		if (firstCategoryWithDocuments) {
			selectedCategory = firstCategoryWithDocuments;
			hasAutoSelectedCategory = true;
		}
	});

	async function handleDisplayNameSave() {
		if (!displayNameInput.trim()) return;
		await saveDisplayName(displayNameInput);
		showDisplayNameEditor = false;
	}

	let processedDocs = $derived(
		$vaultState.documents.filter(
			(d) => d.status === 'processed' && d.remoteSyncState === 'confirmed'
		)
	);

	function docsForCategory(cat: Category) {
		return processedDocs.filter((d) => d.categoryName === cat.name);
	}
</script>

<svelte:head>
	<title>Categorie | Fattura Vault</title>
</svelte:head>

<div class="min-h-screen bg-[#f5f5f0] text-[#12303b] [font-family:'DM Sans',system-ui,sans-serif]">
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
				<a class="mt-3 flex w-full items-center gap-3 rounded-2xl bg-[#0f5d6c] px-4 py-4 text-left text-lg font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.18)]" href="/categorie">
					<svg aria-hidden="true" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24">
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
				<div class="flex items-center justify-end gap-4">
					<NotificationBell />

					<div class="relative">
						<button
							class="flex items-center gap-3 rounded-full border border-white/80 bg-white/82 px-4 py-3 shadow-[0_10px_25px_rgba(148,163,184,0.1)] transition-transform hover:-translate-y-0.5"
							type="button"
							onclick={() => (showDisplayNameEditor = !showDisplayNameEditor)}
						>
							<p class="max-w-[12rem] truncate text-base font-semibold text-[#183843]">
								{$authState.displayName ?? principalLabel($authState.principal)}
							</p>
							<svg aria-hidden="true" class="h-4 w-4 text-[#58707a]" fill="none" viewBox="0 0 24 24">
								<path
									d="m6 9 6 6 6-6"
									stroke="currentColor"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.8"
								/>
							</svg>
						</button>

						{#if showDisplayNameEditor}
							<div class="absolute right-0 z-20 mt-3 w-[20rem] rounded-[1.4rem] border border-[#dce9ed] bg-white p-4 shadow-[0_24px_60px_rgba(148,163,184,0.18)]">
								<p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#6a8792]">Profilo</p>
								<h2 class="mt-2 text-lg font-bold tracking-[-0.03em] text-[#103844]">Modifica nome</h2>
								<p class="mt-2 text-sm leading-6 text-[#58707a]">
									Scegli il nome da mostrare nella dashboard.
								</p>

								<input
									class="mt-4 min-h-12 w-full rounded-2xl border border-[#d6e2e7] bg-white px-4 text-base font-medium text-[#173843] outline-none ring-0 placeholder:text-[#8aa0aa] focus:border-[#0f5d6c]"
									type="text"
									bind:value={displayNameInput}
									placeholder="Es. Mario Rossi"
								/>

								<div class="mt-4 flex gap-3">
									<button
										class="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#0f5d6c] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,93,108,0.22)] transition-transform hover:-translate-y-0.5"
										type="button"
										onclick={handleDisplayNameSave}
									>
										Salva
									</button>
									<button
										class="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#d7e1e8] bg-white px-5 text-sm font-semibold text-[#173843] transition-transform hover:-translate-y-0.5"
										type="button"
										onclick={() => (showDisplayNameEditor = false)}
									>
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
					<h1 class="text-[2.4rem] font-extrabold tracking-[-0.05em] text-[#0f5666] sm:text-[3.4rem]">LE TUE CATEGORIE</h1>
					<p class="mt-3 max-w-3xl text-sm leading-6 text-[#5a707a]">
						Organizza il vault con badge colorati. Clicca su una categoria per vedere i documenti archiviati.
					</p>

					<!-- lista categorie cliccabili -->
					<div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each $categoriesState as category}
							{@const count = docsForCategory(category).length}
							<button
								type="button"
								class="flex items-center gap-3 rounded-[1.5rem] border border-[#e8eff2] bg-white px-4 py-3 text-left shadow-[0_4px_12px_rgba(148,163,184,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(148,163,184,0.12)] {selectedCategory?.name === category.name ? 'ring-2 ring-[#0f5d6c] border-[#0f5d6c]' : ''}"
								onclick={() => (selectedCategory = selectedCategory?.name === category.name ? null : category)}
							>
								<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#365661]" style="background-color: {category.color}20">
									<CategoryIcon icon={category.icon} className="h-5 w-5" />
								</span>
								<div class="min-w-0 flex-1">
									<p class="text-sm font-semibold text-[#173843]">{category.name}</p>
									<p class="text-xs text-[#58707a]">{count} {count === 1 ? 'documento' : 'documenti'}</p>
								</div>
							</button>
						{/each}
					</div>

					<!-- documenti della categoria selezionata -->
					{#if selectedCategory}
						<div class="mt-6">
							<div class="mb-3 flex items-center justify-between">
								<h2 class="flex items-center gap-2 text-xl font-bold text-[#103844]">
									<span class="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#365661]" style="background-color: {selectedCategory.color}20">
										<CategoryIcon icon={selectedCategory.icon} className="h-4 w-4" />
									</span>
									{selectedCategory.name}
								</h2>
								<button type="button" class="text-sm font-semibold text-[#0f5d6c] hover:underline" onclick={() => (selectedCategory = null)}>Chiudi</button>
							</div>
							<CategoryDocumentList category={selectedCategory} documents={docsForCategory(selectedCategory)} />
						</div>
					{/if}

					<!-- gestione categorie -->
					<div class="mt-8">
						<h2 class="text-xl font-bold tracking-[-0.03em] text-[#103844]">Gestione categorie</h2>
						<div class="mt-4">
							<CategoryManager />
						</div>
					</div>
				</div>
			</main>
		</div>
	</div>
</div>
