<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import CategorySelect from '$lib/components/CategorySelect.svelte';
	import ExpiryFields from '$lib/components/ExpiryFields.svelte';
	import InvoiceFields from '$lib/components/InvoiceFields.svelte';
	import WarrantyFields from '$lib/components/WarrantyFields.svelte';
	import {
		archiveInboxDocumentAndSync,
		removeInboxDocumentAndSync,
		type InboxDocument
	} from '$lib/inbox';
	import type { Category, InvoiceData, WarrantyData } from '$lib/types';
	import {
		forceSyncVaultDocument,
		getVaultDocumentById,
		removeVaultDocument,
		updateVaultDocument,
		waitForVaultDocumentPreparation,
		type VaultDocument
	} from '$lib/vault';

	interface Props {
		document: VaultDocument | InboxDocument;
		categories: Category[];
	}

	let { document, categories }: Props = $props();

	function isInboxDocument(value: VaultDocument | InboxDocument): value is InboxDocument {
		return 'sourceScope' in value && value.sourceScope === 'inbox';
	}

	function hasAiPrefill(value: VaultDocument | InboxDocument) {
		if (!isInboxDocument(value) || !value.extractedPayloadJson) {
			return false;
		}

		try {
			const parsed = JSON.parse(value.extractedPayloadJson) as { provider?: string };
			return parsed?.provider === 'openai';
		} catch {
			return false;
		}
	}

	function getAnalysisDetails(value: VaultDocument | InboxDocument) {
		if (!isInboxDocument(value) || !value.extractedPayloadJson) {
			return null;
		}

		try {
			const parsed = JSON.parse(value.extractedPayloadJson) as {
				provider?: string;
				model?: string;
				inputKind?: string;
			};

			if (!parsed?.provider) {
				return null;
			}

			const sourceLabel =
				parsed.inputKind === 'image'
					? 'immagine'
					: parsed.inputKind === 'image+text'
						? 'immagine con testo'
						: parsed.inputKind === 'pdf'
							? 'PDF'
							: parsed.inputKind === 'pdf+text'
								? 'PDF con testo'
								: parsed.inputKind === 'text'
									? 'testo documento'
									: 'file';

			return {
				provider: parsed.provider,
				model: parsed.model,
				sourceLabel
			};
		} catch {
			return null;
		}
	}

	const formId = `document-form-${Math.random().toString(36).slice(2, 8)}`;
	const invoiceCategories = ['Fattura', 'Ricevuta', 'Fiscale'];
	const warrantyCategories = ['Garanzia'];
	const expirySuggestedCategories = ['Auto', 'Assicurazione', 'Abbonamento', 'Garanzia', 'Contratto'];

	let lastLoadedDocumentId = '';
	let title = $state('');
	let categoryName = $state('Altro');
	let documentDate = $state('');
	let merchantName = $state('');
	let amount = $state('');
	let paymentStatus = $state<'due' | 'paid'>('paid');
	let notes = $state('');
	let tags = $state<string[]>([]);
	let tagInput = $state('');
	let hasExpiry = $state(false);
	let expiryDate = $state('');
	let expiryType = $state('');
	let expiryDuration = $state('');
	let invoiceData = $state<InvoiceData>({ invoiceType: 'ricevuta', lineItems: [] });
	let warrantyData = $state<WarrantyData>({});
	let isEditing = $state(false);
	let isSaving = $state(false);
	let showDeleteConfirm = $state(false);
	let saveError = $state('');
	let saveProgressMessage = $state('');

	function loadFormFromDocument(source: VaultDocument | InboxDocument) {
		title = source.title || source.name;
		categoryName = source.categoryName || 'Altro';
		documentDate = source.documentDate ?? '';
		merchantName = source.merchantName ?? '';
		amount = source.amount != null ? String(source.amount) : '';
		paymentStatus = source.paymentStatus ?? 'paid';
		notes = source.notes ?? '';
		tags = [...(source.tags ?? [])];
		tagInput = '';
		hasExpiry = source.hasExpiry ?? false;
		expiryDate = source.expiryDate ?? '';
		expiryType = source.expiryType ?? '';
		expiryDuration = source.expiryDuration ?? '';
		invoiceData = source.invoiceData
			? { ...source.invoiceData, lineItems: [...source.invoiceData.lineItems] }
			: { invoiceType: 'ricevuta', lineItems: [] };
		warrantyData = source.warrantyData ? { ...source.warrantyData } : {};
		isEditing = isInboxDocument(source) || source.status === 'inbox';
		isSaving = false;
		showDeleteConfirm = false;
		saveError = '';
		saveProgressMessage = '';
	}

	$effect(() => {
		if (document.id === lastLoadedDocumentId) return;
		lastLoadedDocumentId = document.id;
		loadFormFromDocument(document);
	});

	let showInvoiceFields = $derived(invoiceCategories.includes(categoryName));
	let showWarrantyFields = $derived(warrantyCategories.includes(categoryName));
	let hasInvoiceDetails = $derived(!!document.invoiceData);
	let hasWarrantyDetails = $derived(!!document.warrantyData);
	let showExpirySuggestion = $derived(expirySuggestedCategories.includes(categoryName) && !hasExpiry);
	let analysisDetails = $derived(getAnalysisDetails(document));
	let selectedCategory = $derived(
		categories.find((category) => category.name === categoryName) ??
			categories.find((category) => category.name === 'Altro') ??
			null
	);

	function addTag() {
		const tag = tagInput.trim().toLowerCase();
		if (tag && !tags.includes(tag)) {
			tags = [...tags, tag];
		}
		tagInput = '';
	}

	function getTagsForSave() {
		const pendingTag = tagInput.trim().toLowerCase();
		if (!pendingTag) {
			return [...tags];
		}

		return tags.includes(pendingTag) ? [...tags] : [...tags, pendingTag];
	}

	function removeTag(tag: string) {
		tags = tags.filter((currentTag) => currentTag !== tag);
	}

	function handleTagKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addTag();
		}
	}

	function handleTagSubmit(event: SubmitEvent) {
		event.preventDefault();
		addTag();
	}

	function parseAmount(value: string | number | null | undefined) {
		if (value == null) return undefined;
		if (typeof value === 'number') {
			return Number.isFinite(value) ? value : undefined;
		}

		const trimmed = value.trim();
		if (!trimmed) return undefined;
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : undefined;
	}

	function formatCurrency(value: number | undefined) {
		if (value == null) return '-';
		return `EUR ${value.toFixed(2)}`;
	}

	function formatValue(value: string | number | undefined | null) {
		if (value == null || value === '') return '-';
		return String(value);
	}

	function getPlainInvoiceData(): InvoiceData {
		return {
			...invoiceData,
			lineItems: invoiceData.lineItems.map((lineItem) => ({ ...lineItem }))
		};
	}

	function getPlainWarrantyData(): WarrantyData {
		return {
			...warrantyData
		};
	}

	function handleExpiryChange(data: {
		hasExpiry: boolean;
		expiryDate?: string;
		expiryType?: string;
		expiryDuration?: string;
	}) {
		hasExpiry = data.hasExpiry;
		expiryDate = data.expiryDate ?? '';
		expiryType = data.expiryType ?? '';
		expiryDuration = data.expiryDuration ?? '';
	}

	function handleInvoiceChange(data: InvoiceData) {
		invoiceData = {
			...data,
			lineItems: [...data.lineItems]
		};
	}

	function handleWarrantyChange(data: WarrantyData) {
		warrantyData = {
			...data
		};
	}

	async function handleSave() {
		if (!title.trim()) return;

		isSaving = true;
		saveError = '';
		saveProgressMessage = isInboxDocument(document)
			? 'Preparo il file'
			: 'Aggiorno il documento';

		try {
			const updates: Partial<VaultDocument> = {
				title: title.trim(),
				categoryName,
				status: 'processed',
				documentDate: documentDate || undefined,
				merchantName: merchantName.trim() || undefined,
				amount: parseAmount(amount),
				paymentStatus,
				notes: notes.trim() || undefined,
				tags: getTagsForSave(),
				hasExpiry,
				expiryDate: hasExpiry ? expiryDate || undefined : undefined,
				expiryType: hasExpiry ? expiryType || undefined : undefined,
				expiryDuration: hasExpiry ? expiryDuration || undefined : undefined,
				invoiceData: showInvoiceFields ? getPlainInvoiceData() : undefined,
				warrantyData: showWarrantyFields ? getPlainWarrantyData() : undefined
			};

			if (isInboxDocument(document)) {
				await archiveInboxDocumentAndSync(document.id, updates, {
					onProgress: (message) => {
						saveProgressMessage = message;
					}
				});
				isEditing = false;
				saveProgressMessage = '';
				await goto('/inbox');
				return;
			} else {
				saveProgressMessage = 'Aggiorno il documento';
				await waitForVaultDocumentPreparation(document.id);
				updateVaultDocument(document.id, updates);
				saveProgressMessage = 'Sincronizzo il vault';
				await forceSyncVaultDocument(document.id);
			}
			isEditing = false;
			saveProgressMessage = '';

			const target = `/categorie?category=${encodeURIComponent(categoryName)}`;
			await goto(target);
		} catch (error) {
			console.error('Salvataggio documento fallito', error);
			saveError =
				error instanceof Error
					? error.message
					: 'Non siamo riusciti a salvare il documento. Riprova.';
		} finally {
			isSaving = false;
		}
	}

	function handleEdit() {
		isEditing = true;
	}

	async function handleDelete() {
		if (isInboxDocument(document)) {
			await removeInboxDocumentAndSync(document.id);
		} else {
			removeVaultDocument(document.id);
		}
		await goto('/inbox');
	}
</script>

<div class="flex flex-col gap-4">
	<div class="rounded-[1.5rem] border border-[#e3edf1] bg-white/85 p-4">
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Cataloga documento</p>

		{#if isEditing}
			<div class="mt-3 flex flex-col gap-3">
				{#if hasAiPrefill(document)}
					<div class="rounded-[1.2rem] border border-[#dce7eb] bg-[#f8fbfc] px-4 py-3 text-sm leading-6 text-[#45626c]">
						Alcuni campi sono già stati precompilati dall'AI. Controllali e correggili prima di archiviare.
					</div>
				{/if}

				{#if analysisDetails}
					<div class={`rounded-[1.2rem] border px-4 py-3 text-sm leading-6 ${analysisDetails.provider === 'openai' ? 'border-[#cde7ec] bg-[#eef8fa] text-[#245766]' : 'border-[#dce7eb] bg-[#f8fbfc] text-[#45626c]'}`}>
						<p class="font-semibold">
							{analysisDetails.provider === 'openai' ? 'Analisi OpenAI attiva' : 'Analisi locale attiva'}
						</p>
						<p class="mt-1">
							Fonte letta: {analysisDetails.sourceLabel}
							{#if analysisDetails.provider === 'openai' && analysisDetails.model}
								• modello {analysisDetails.model}
							{/if}
						</p>
					</div>
				{/if}

				<div>
					<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${formId}-title`}>Titolo</label>
					<input id={`${formId}-title`} type="text" class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-semibold text-[#173843] outline-none focus:border-[#0f5d6c]" placeholder="Es. Scontrino Conad 15/03" bind:value={title} />
				</div>

				<div>
					<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${formId}-category`}>Categoria</label>
					<div id={`${formId}-category`}>
						<CategorySelect {categories} bind:selected={categoryName} />
					</div>
				</div>

				<div>
					<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${formId}-document-date`}>Data documento</label>
					<input id={`${formId}-document-date`} type="date" class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c] [font-family:'DM_Mono',monospace]" bind:value={documentDate} />
				</div>

				<div>
					<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${formId}-merchant`}>
						{invoiceCategories.includes(categoryName) ? 'Fornitore' : 'Nome esercente'}
					</label>
					<input id={`${formId}-merchant`} type="text" class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]" placeholder={invoiceCategories.includes(categoryName) ? 'Es. Aruba S.p.A.' : 'Es. Conad City'} bind:value={merchantName} />
				</div>

				<div>
					<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${formId}-amount`}>Importo</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6a8792]">EUR</span>
						<input id={`${formId}-amount`} type="number" step="0.01" class="w-full rounded-2xl border border-[#d6e2e7] bg-white py-2.5 pl-12 pr-3 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c] [font-family:'DM_Mono',monospace]" placeholder="0.00" bind:value={amount} />
					</div>
				</div>

				<div>
					<p class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Pagamento</p>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							class={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
								paymentStatus === 'due'
									? 'border-[#dc2626] bg-[#fff1f1] text-[#b42318]'
									: 'border-[#d6e2e7] bg-white text-[#5a707a] hover:bg-[#f6fafb]'
							}`}
							onclick={() => (paymentStatus = 'due')}
						>
							Da pagare
						</button>
						<button
							type="button"
							class={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
								paymentStatus === 'paid'
									? 'border-[#0f5d6c] bg-[#eef8fa] text-[#0f5d6c]'
									: 'border-[#d6e2e7] bg-white text-[#5a707a] hover:bg-[#f6fafb]'
							}`}
							onclick={() => (paymentStatus = 'paid')}
						>
							Pagata
						</button>
					</div>
				</div>

				<div>
					<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${formId}-tags`}>Tag</label>
					<div class="flex flex-wrap gap-1.5">
						{#each tags as tag}
							<span class="inline-flex items-center gap-1 rounded-full bg-[#dff1f3] px-2.5 py-1 text-xs font-semibold text-[#0f5d6c]">
								{tag}
								<button type="button" class="text-[#0f5d6c] hover:text-[#a23939]" aria-label={`Rimuovi il tag ${tag}`} onclick={() => removeTag(tag)}>x</button>
							</span>
						{/each}
					</div>
					<form class="mt-1.5 flex gap-2" onsubmit={handleTagSubmit}>
						<input
							id={`${formId}-tags`}
							type="text"
							class="min-w-0 flex-1 rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2 text-sm text-[#173843] outline-none focus:border-[#0f5d6c]"
							placeholder="Aggiungi tag e premi Invio"
							enterkeyhint="done"
							autocapitalize="none"
							bind:value={tagInput}
							onkeydown={handleTagKeydown}
						/>
						<button
							type="submit"
							class="shrink-0 rounded-2xl border border-[#d7e1e8] bg-white px-3 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]"
						>
							Aggiungi
						</button>
					</form>
				</div>

				<div>
					<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${formId}-notes`}>Note</label>
					<textarea id={`${formId}-notes`} class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm text-[#173843] outline-none focus:border-[#0f5d6c]" rows="2" placeholder="Note opzionali..." bind:value={notes}></textarea>
				</div>
			</div>
		{:else}
			<div class="mt-3 space-y-4">
				<div class="grid gap-2">
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Titolo</span>
						<span class="text-sm font-semibold text-[#173843]">{document.title}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Categoria</span>
						<span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white" style={`background-color:${selectedCategory?.color ?? '#6B7280'}`}>
							<span class="inline-flex items-center justify-center">
								<CategoryIcon icon={selectedCategory?.icon ?? 'paperclip'} className="h-3.5 w-3.5" />
							</span>
							{categoryName}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Data</span>
						<span class="text-sm font-medium text-[#173843] [font-family:'DM_Mono',monospace]">{formatValue(document.documentDate)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">
							{invoiceCategories.includes(categoryName) ? 'Fornitore' : 'Esercente'}
						</span>
						<span class="text-sm font-medium text-[#173843]">{formatValue(document.merchantName)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Importo</span>
						<span class="text-sm font-bold text-[#173843] [font-family:'DM_Mono',monospace]">{formatCurrency(document.amount)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Pagamento</span>
						<span
							class={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
								(document.paymentStatus ?? 'paid') === 'due'
									? 'bg-[#fff1f1] text-[#b42318]'
									: 'bg-[#eef8fa] text-[#0f5d6c]'
							}`}
						>
							{(document.paymentStatus ?? 'paid') === 'due' ? 'Da pagare' : 'Pagata'}
						</span>
					</div>
				</div>

				{#if document.tags?.length}
					<div>
						<p class="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Tag</p>
						<div class="flex flex-wrap gap-1.5">
							{#each document.tags as tag}
								<span class="rounded-full bg-[#dff1f3] px-2.5 py-0.5 text-xs font-semibold text-[#0f5d6c]">{tag}</span>
							{/each}
						</div>
					</div>
				{/if}

				{#if document.notes}
					<div>
						<p class="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Note</p>
						<p class="text-sm leading-6 text-[#173843]">{document.notes}</p>
					</div>
				{/if}

				{#if document.hasExpiry}
					<div class="rounded-[1.2rem] border border-[#e8eff2] bg-[#f8fbfc] p-4">
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Scadenza</p>
						<div class="mt-3 grid gap-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Tipo</span>
								<span class="text-sm font-medium text-[#173843]">{formatValue(document.expiryType)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Scadenza</span>
								<span class="text-sm font-medium text-[#173843] [font-family:'DM_Mono',monospace]">{formatValue(document.expiryDate)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Durata</span>
								<span class="text-sm font-medium text-[#173843]">{formatValue(document.expiryDuration)}</span>
							</div>
						</div>
					</div>
				{/if}

				{#if hasWarrantyDetails}
					<div class="rounded-[1.2rem] border border-[#e8eff2] bg-[#f8fbfc] p-4">
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Dettagli garanzia</p>
						<div class="mt-3 grid gap-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Prodotto</span>
								<span class="text-sm font-medium text-[#173843]">{formatValue(document.warrantyData?.product)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Marca</span>
								<span class="text-sm font-medium text-[#173843]">{formatValue(document.warrantyData?.brand)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Negozio</span>
								<span class="text-sm font-medium text-[#173843]">{formatValue(document.warrantyData?.store)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Acquisto</span>
								<span class="text-sm font-medium text-[#173843] [font-family:'DM_Mono',monospace]">{formatValue(document.warrantyData?.purchaseDate)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Durata garanzia</span>
								<span class="text-sm font-medium text-[#173843]">
									{document.warrantyData?.durationMonths ? `${document.warrantyData.durationMonths} mesi` : '-'}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Seriale</span>
								<span class="text-sm font-medium text-[#173843]">{formatValue(document.warrantyData?.serialNumber)}</span>
							</div>
						</div>
					</div>
				{/if}

				{#if hasInvoiceDetails}
					<div class="rounded-[1.2rem] border border-[#e8eff2] bg-[#f8fbfc] p-4">
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Dettagli fattura</p>
						<div class="mt-3 grid gap-2">
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Tipo</span>
								<span class="text-sm font-medium text-[#173843]">{formatValue(document.invoiceData?.invoiceType)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">N. Fattura</span>
								<span class="text-sm font-medium text-[#173843]">{formatValue(document.invoiceData?.invoiceNumber)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">P.IVA</span>
								<span class="text-sm font-medium text-[#173843]">{formatValue(document.invoiceData?.vatNumber)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Imponibile</span>
								<span class="text-sm font-medium text-[#173843] [font-family:'DM_Mono',monospace]">{formatCurrency(document.invoiceData?.netAmount)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">IVA</span>
								<span class="text-sm font-medium text-[#173843] [font-family:'DM_Mono',monospace]">{formatCurrency(document.invoiceData?.vatAmount)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Totale</span>
								<span class="text-sm font-medium text-[#173843] [font-family:'DM_Mono',monospace]">{formatCurrency(document.invoiceData?.totalAmount)}</span>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if isEditing}
		{#if showExpirySuggestion}
			<div class="rounded-[1.2rem] border border-[#fff4d7] bg-[#fffdf5] p-3 text-sm text-[#9a6c00]">
				Suggerimento: per la categoria <strong>{categoryName}</strong> potresti aggiungere una data di scadenza.
				<button type="button" class="ml-2 font-semibold underline" onclick={() => (hasExpiry = true)}>Aggiungi scadenza</button>
			</div>
		{/if}

		<ExpiryFields bind:hasExpiry bind:expiryDate bind:expiryType bind:expiryDuration onchange={handleExpiryChange} />

		{#if showInvoiceFields}
			<InvoiceFields bind:data={invoiceData} onchange={handleInvoiceChange} />
		{/if}

		{#if showWarrantyFields}
			<WarrantyFields bind:data={warrantyData} onchange={handleWarrantyChange} />
		{/if}
	{/if}

	<div class="flex gap-3">
		{#if isEditing}
			<button type="button" class="flex-1 rounded-2xl bg-[#c8a96e] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_40px_rgba(200,169,110,0.3)] transition-transform hover:-translate-y-0.5 disabled:opacity-50" onclick={handleSave} disabled={!title.trim() || isSaving}>
				{isSaving ? 'Sto archiviando...' : 'Salva e archivia'}
			</button>
		{:else}
			<button type="button" class="flex-1 rounded-2xl border border-[#d6e2e7] bg-white px-5 py-3 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" onclick={handleEdit}>
				Modifica
			</button>
		{/if}

		<button type="button" class="rounded-2xl border border-[#f1cccc] bg-[#fff3f3] px-4 py-3 text-sm font-semibold text-[#a23939] transition-colors hover:bg-[#ffe7e7]" onclick={() => (showDeleteConfirm = true)}>
			Elimina
		</button>
	</div>

	{#if isSaving && saveProgressMessage}
		<div class="rounded-[1.2rem] border border-[#d9e7ec] bg-[#f7fbfc] p-4">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Archiviazione</p>
			<p class="mt-1 text-sm font-medium text-[#31515b]">{saveProgressMessage}...</p>
		</div>
	{/if}

	{#if saveError}
		<div class="rounded-[1.2rem] border border-[#f1cccc] bg-[#fff5f5] p-4">
			<p class="text-sm font-semibold text-[#a23939]">Salvataggio non riuscito</p>
			<p class="mt-1 text-sm leading-6 text-[#8f4040]">{saveError}</p>
		</div>
	{/if}

	{#if showDeleteConfirm}
		<div class="rounded-[1.2rem] border border-[#f1cccc] bg-[#fff5f5] p-4">
			<p class="text-sm font-semibold text-[#a23939]">Vuoi davvero eliminare questo documento?</p>
			<div class="mt-3 flex gap-2">
				<button type="button" class="rounded-xl bg-[#a23939] px-4 py-2 text-sm font-semibold text-white" onclick={handleDelete}>Si, elimina</button>
				<button type="button" class="rounded-xl border border-[#d7e1e8] bg-white px-4 py-2 text-sm font-semibold text-[#173843]" onclick={() => (showDeleteConfirm = false)}>Annulla</button>
			</div>
		</div>
	{/if}
</div>
