<script lang="ts">
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import type { Category } from '$lib/types';
	import {
		downloadVaultDocument,
		removeVaultDocument,
		type VaultDocument,
		vaultAssetOperationState
	} from '$lib/vault';

	interface Props {
		category: Category;
		documents: VaultDocument[];
	}

	let { category, documents }: Props = $props();

	const invoiceCategories = ['Fattura', 'Ricevuta', 'Fiscale'];
	const warrantyCategories = ['Garanzia'];

	let pendingDeleteId = $state<string | null>(null);
	let isInvoiceCategory = $derived(invoiceCategories.includes(category.name));
	let isWarrantyCategory = $derived(warrantyCategories.includes(category.name));

	function formatDate(iso: string | undefined) {
		if (!iso) return '-';
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '-';
		return new Intl.DateTimeFormat('it-IT', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		}).format(date);
	}

	function formatAmount(value: number | undefined) {
		if (value == null) return '-';
		return `EUR ${value.toFixed(2)}`;
	}

	function getWarrantyStatus(document: VaultDocument): { label: string; color: string } {
		if (!document.expiryDate) return { label: 'N/D', color: '#6B7280' };

		const now = new Date();
		const expiry = new Date(document.expiryDate);
		const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

		if (diffDays < 0) return { label: 'Scaduta', color: '#EF4444' };
		if (diffDays <= 60) return { label: `${diffDays}gg`, color: '#F59E0B' };
		return { label: 'Attiva', color: '#10B981' };
	}

	function handleDownload(id: string) {
		downloadVaultDocument(id);
	}

	function handleDelete(id: string) {
		pendingDeleteId = id;
	}

	function isDownloading(documentId: string) {
		return $vaultAssetOperationState.downloadingDocumentIds.includes(documentId);
	}

	function confirmDelete() {
		if (!pendingDeleteId) return;
		removeVaultDocument(pendingDeleteId);
		pendingDeleteId = null;
	}
</script>

{#if documents.length === 0}
	<div class="rounded-[1.5rem] border border-[#e3edf1] bg-white/85 p-6 text-center">
		<p class="text-base font-semibold text-[#173843]">Nessun documento in questa categoria</p>
		<p class="mt-1 text-sm text-[#5a707a]">Archivia documenti dall'inbox per vederli qui.</p>
	</div>
{:else}
	<div class="space-y-2">
		<div class="flex items-center justify-between rounded-[1.2rem] bg-[#f6fafb] px-4 py-3">
			<div>
				<p class="text-sm font-semibold uppercase tracking-[0.14em] text-[#6a8792]">
					<span class="inline-flex items-center gap-2">
						<span class="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#365661]" style={`background-color: ${category.color}1f`}>
							<CategoryIcon icon={category.icon} className="h-3.5 w-3.5" />
						</span>
						{category.name}
					</span>
				</p>
			</div>
			<span class="rounded-full bg-[#dff1f3] px-3 py-1 text-sm font-semibold text-[#0f5d6c]">
				{documents.length} doc
			</span>
		</div>

		{#if isInvoiceCategory}
			<div class="overflow-x-auto rounded-[1.2rem] border border-[#e3edf1] bg-white">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-[#e3edf1] bg-[#f8fbfc]">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Titolo</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Fornitore</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Data</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Importo</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Azioni</th>
						</tr>
					</thead>
					<tbody>
						{#each documents as document}
							<tr class={`border-b transition-colors hover:bg-[#f8fbfc] ${document.paymentStatus === 'due' ? 'border-[#f2c1c1] bg-[#fff8f8]' : 'border-[#f0f5f7]'}`}>
								<td class="px-4 py-3 font-medium text-[#173843]">
									<div class="flex items-center gap-2">
										{#if document.previewDataUrl}
											<img src={document.previewDataUrl} alt="" class="h-8 w-8 rounded-lg object-cover" />
										{/if}
										<span class="max-w-[160px] truncate">{document.title}</span>
									</div>
								</td>
								<td class="px-4 py-3 text-[#58707a]">{document.merchantName || document.invoiceData?.supplier || '-'}</td>
								<td class="px-4 py-3 [font-family:'DM_Mono',monospace] text-[#58707a]">{formatDate(document.documentDate)}</td>
								<td class="px-4 py-3 text-right font-semibold [font-family:'DM_Mono',monospace] text-[#173843]">
									{formatAmount(document.amount ?? document.invoiceData?.totalAmount)}
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex items-center justify-end gap-2">
										{#if document.paymentStatus === 'due'}
											<span class="rounded-lg bg-[#fff1f1] px-3 py-1 text-xs font-semibold text-[#b42318]">Da pagare</span>
										{/if}
										<a href={`/documento?id=${encodeURIComponent(document.id)}`} class="rounded-lg border border-[#d6e2e7] px-3 py-1 text-xs font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]">Apri</a>
										<button type="button" class="rounded-lg border border-[#d6e2e7] px-3 py-1 text-xs font-semibold text-[#0f5d6c] transition-colors hover:bg-[#dff1f3] disabled:cursor-wait disabled:opacity-70" onclick={() => handleDownload(document.id)} disabled={isDownloading(document.id)}>{isDownloading(document.id) ? 'Scarico...' : 'Scarica'}</button>
										<button type="button" class="rounded-lg border border-[#f1cccc] bg-[#fff3f3] px-3 py-1 text-xs font-semibold text-[#a23939] transition-colors hover:bg-[#ffe7e7]" onclick={() => handleDelete(document.id)}>Elimina</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if isWarrantyCategory}
			<div class="overflow-x-auto rounded-[1.2rem] border border-[#e3edf1] bg-white">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-[#e3edf1] bg-[#f8fbfc]">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Prodotto</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Negozio</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Acquisto</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Scadenza</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Stato</th>
							<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Azioni</th>
						</tr>
					</thead>
					<tbody>
						{#each documents as document}
							{@const warrantyStatus = getWarrantyStatus(document)}
							<tr class={`border-b transition-colors hover:bg-[#f8fbfc] ${document.paymentStatus === 'due' ? 'border-[#f2c1c1] bg-[#fff8f8]' : 'border-[#f0f5f7]'}`}>
								<td class="px-4 py-3 font-medium text-[#173843]">{document.warrantyData?.product || document.title}</td>
								<td class="px-4 py-3 text-[#58707a]">{document.warrantyData?.store || document.merchantName || '-'}</td>
								<td class="px-4 py-3 [font-family:'DM_Mono',monospace] text-[#58707a]">{formatDate(document.warrantyData?.purchaseDate || document.documentDate)}</td>
								<td class="px-4 py-3 [font-family:'DM_Mono',monospace] text-[#58707a]">{formatDate(document.expiryDate)}</td>
								<td class="px-4 py-3">
									<span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold" style="background-color: {warrantyStatus.color}20; color: {warrantyStatus.color}">
										{warrantyStatus.label}
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex items-center justify-end gap-2">
										{#if document.paymentStatus === 'due'}
											<span class="rounded-lg bg-[#fff1f1] px-3 py-1 text-xs font-semibold text-[#b42318]">Da pagare</span>
										{/if}
										<a href={`/documento?id=${encodeURIComponent(document.id)}`} class="rounded-lg border border-[#d6e2e7] px-3 py-1 text-xs font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]">Apri</a>
										<button type="button" class="rounded-lg border border-[#d6e2e7] px-3 py-1 text-xs font-semibold text-[#0f5d6c] transition-colors hover:bg-[#dff1f3] disabled:cursor-wait disabled:opacity-70" onclick={() => handleDownload(document.id)} disabled={isDownloading(document.id)}>{isDownloading(document.id) ? 'Scarico...' : 'Scarica'}</button>
										<button type="button" class="rounded-lg border border-[#f1cccc] bg-[#fff3f3] px-3 py-1 text-xs font-semibold text-[#a23939] transition-colors hover:bg-[#ffe7e7]" onclick={() => handleDelete(document.id)}>Elimina</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="grid gap-2">
				{#each documents as document}
					<div class={`flex items-center gap-3 rounded-[1.2rem] border px-4 py-3 shadow-[0_4px_12px_rgba(148,163,184,0.06)] ${document.paymentStatus === 'due' ? 'border-[#dc2626] bg-[#fff8f8]' : 'border-[#e8eff2] bg-white'}`}>
						{#if document.previewDataUrl}
							<img src={document.previewDataUrl} alt="" class="h-10 w-10 shrink-0 rounded-xl object-cover" />
						{:else}
							<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dff1f3] text-[#0f5d6c]">
								<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
									<path stroke-linecap="round" stroke-linejoin="round" d="M7 4.8h6.5L19 10v8.2A2 2 0 0 1 17 20H7a2 2 0 0 1-2-1.8V6.8A2 2 0 0 1 7 4.8ZM13.5 4.9V10H19" />
								</svg>
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold text-[#173843]">{document.title}</p>
							<div class="mt-0.5 flex flex-wrap gap-1.5 text-xs text-[#58707a]">
								{#if document.documentDate}
									<span class="[font-family:'DM_Mono',monospace]">{formatDate(document.documentDate)}</span>
								{/if}
								{#if document.amount != null}
									<span class="font-semibold [font-family:'DM_Mono',monospace]">EUR {document.amount.toFixed(2)}</span>
								{/if}
								{#each document.tags as tag}
									<span class="rounded-full bg-[#dff1f3] px-2 py-0.5 text-[#0f5d6c]">{tag}</span>
								{/each}
							</div>
						</div>
						<div class="flex items-center gap-2">
							{#if document.paymentStatus === 'due'}
								<span class="rounded-lg bg-[#fff1f1] px-3 py-1.5 text-xs font-semibold text-[#b42318]">Da pagare</span>
							{/if}
							<a href={`/documento?id=${encodeURIComponent(document.id)}`} class="rounded-lg border border-[#d6e2e7] px-3 py-1.5 text-xs font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]">Apri</a>
							<button type="button" class="rounded-lg border border-[#d6e2e7] px-3 py-1.5 text-xs font-semibold text-[#0f5d6c] transition-colors hover:bg-[#dff1f3] disabled:cursor-wait disabled:opacity-70" onclick={() => handleDownload(document.id)} disabled={isDownloading(document.id)}>{isDownloading(document.id) ? 'Scarico...' : 'Scarica'}</button>
							<button type="button" class="rounded-lg border border-[#f1cccc] bg-[#fff3f3] px-3 py-1.5 text-xs font-semibold text-[#a23939] transition-colors hover:bg-[#ffe7e7]" onclick={() => handleDelete(document.id)}>Elimina</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

{#if pendingDeleteId}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-[#0e2330]/35 px-4 backdrop-blur-[2px]">
		<div class="w-full max-w-md rounded-[1.6rem] border border-[#e8eff2] bg-white p-5 shadow-[0_25px_70px_rgba(15,35,48,0.22)]">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Conferma</p>
			<h2 class="mt-2 text-xl font-bold tracking-[-0.03em] text-[#173843]">Elimina documento</h2>
			<p class="mt-3 text-sm leading-6 text-[#5a707a]">Vuoi davvero eliminare questo file dalla categoria?</p>
			<div class="mt-5 flex justify-end gap-3">
				<button type="button" class="rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" onclick={() => (pendingDeleteId = null)}>
					Annulla
				</button>
				<button type="button" class="rounded-full border border-[#f1cccc] bg-[#fff3f3] px-4 py-2 text-sm font-semibold text-[#a23939] transition-colors hover:bg-[#ffe7e7]" onclick={confirmDelete}>
					Elimina
				</button>
			</div>
		</div>
	</div>
{/if}
