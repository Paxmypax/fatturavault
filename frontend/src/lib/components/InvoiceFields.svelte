<script lang="ts">
	import type { InvoiceData, LineItem } from '$lib/types';

	interface Props {
		data: InvoiceData;
		onchange: (data: InvoiceData) => void;
	}

	let { data = $bindable({ invoiceType: 'ricevuta', lineItems: [] }), onchange }: Props = $props();

	const vatRates = ['4', '10', '22'];
	const fieldId = `invoice-${Math.random().toString(36).slice(2, 8)}`;
	let vatRateValue = $state('');

	$effect(() => {
		vatRateValue = data.vatRate != null ? String(data.vatRate) : '';
	});

	function handleInput() {
		if (data.netAmount != null && data.vatRate != null) {
			data.vatAmount = Math.round(data.netAmount * (data.vatRate / 100) * 100) / 100;
			data.totalAmount = Math.round((data.netAmount + data.vatAmount) * 100) / 100;
		}
		onchange({ ...data });
	}

	function addLineItem() {
		data.lineItems = [...data.lineItems, { description: '', amount: 0, vatRate: 22 }];
		handleInput();
	}

	function removeLineItem(index: number) {
		data.lineItems = data.lineItems.filter((_, currentIndex) => currentIndex !== index);
		handleInput();
	}

	function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
		const updated = [...data.lineItems];
		updated[index] = { ...updated[index], [field]: value };
		data.lineItems = updated;
		handleInput();
	}

	function parseNumericInput(value: string) {
		return value.trim() ? Number(value) : undefined;
	}

	function handleVatRateChange(value: string) {
		vatRateValue = value;
		data.vatRate = value ? Number(value) : undefined;
		handleInput();
	}
</script>

<div class="rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4">
	<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Dati fattura</p>

	<div class="mt-3 flex flex-wrap gap-4">
		<label class="flex cursor-pointer items-center gap-2" for={`${fieldId}-type-receipt`}>
			<input
				id={`${fieldId}-type-receipt`}
				type="radio"
				name={`${fieldId}-invoiceType`}
				class="accent-[#0f5d6c]"
				checked={data.invoiceType === 'ricevuta'}
				onchange={() => {
					data.invoiceType = 'ricevuta';
					handleInput();
				}}
			/>
			<span class="text-sm font-medium text-[#173843]">Ricevuta</span>
		</label>
		<label class="flex cursor-pointer items-center gap-2" for={`${fieldId}-type-issued`}>
			<input
				id={`${fieldId}-type-issued`}
				type="radio"
				name={`${fieldId}-invoiceType`}
				class="accent-[#0f5d6c]"
				checked={data.invoiceType === 'emessa'}
				onchange={() => {
					data.invoiceType = 'emessa';
					handleInput();
				}}
			/>
			<span class="text-sm font-medium text-[#173843]">Emessa</span>
		</label>
	</div>

	<div class="mt-3 grid gap-3 sm:grid-cols-2">
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-number`}>N. Fattura</label>
			<input
				id={`${fieldId}-number`}
				type="text"
				class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c] [font-family:'DM_Mono',monospace]"
				placeholder="Es. FV-2026-001"
				bind:value={data.invoiceNumber}
				oninput={handleInput}
			/>
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-supplier`}>Fornitore</label>
			<input
				id={`${fieldId}-supplier`}
				type="text"
				class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]"
				placeholder="Es. Aruba S.p.A."
				bind:value={data.supplier}
				oninput={handleInput}
			/>
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-vat-number`}>P.IVA</label>
			<input
				id={`${fieldId}-vat-number`}
				type="text"
				class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c] [font-family:'DM_Mono',monospace]"
				placeholder="Es. IT12345678901"
				bind:value={data.vatNumber}
				oninput={handleInput}
			/>
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-net-amount`}>Imponibile</label>
			<div class="relative">
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6a8792]">EUR</span>
				<input
					id={`${fieldId}-net-amount`}
					type="number"
					step="0.01"
					class="w-full rounded-2xl border border-[#d6e2e7] bg-white py-2.5 pl-12 pr-3 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c] [font-family:'DM_Mono',monospace]"
					placeholder="0.00"
					value={data.netAmount ?? ''}
					oninput={(event) => {
						data.netAmount = parseNumericInput((event.target as HTMLInputElement).value);
						handleInput();
					}}
				/>
			</div>
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-vat-rate`}>Aliquota IVA</label>
			<select
				id={`${fieldId}-vat-rate`}
				class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c] [font-family:'DM_Mono',monospace]"
				bind:value={vatRateValue}
				onchange={(event) => handleVatRateChange((event.target as HTMLSelectElement).value)}
			>
				<option value="">Seleziona...</option>
				{#each vatRates as rate}
					<option value={rate}>{rate}%</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-vat-amount`}>IVA</label>
			<div class="relative">
				<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6a8792]">EUR</span>
				<input
					id={`${fieldId}-vat-amount`}
					type="text"
					readonly
					class="w-full rounded-2xl border border-[#d6e2e7] bg-[#f4f8fa] py-2.5 pl-12 pr-3 text-sm font-medium text-[#173843] [font-family:'DM_Mono',monospace]"
					value={data.vatAmount != null ? data.vatAmount.toFixed(2) : ''}
				/>
			</div>
		</div>
	</div>

	{#if data.totalAmount != null}
		<div class="mt-3 rounded-2xl bg-[#dff1f3] px-4 py-3 text-right">
			<span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f5d6c]">Totale: </span>
			<span class="text-lg font-bold text-[#0f5d6c] [font-family:'DM_Mono',monospace]">EUR {data.totalAmount.toFixed(2)}</span>
		</div>
	{/if}

	<div class="mt-4">
		<p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Voci fattura</p>

		{#if data.lineItems.length > 0}
			<div class="mt-2 grid gap-2">
				{#each data.lineItems as item, index}
					<div class="grid gap-2 rounded-xl border border-[#e3edf1] bg-white p-2 sm:grid-cols-[minmax(0,1fr)_110px_88px_32px] sm:items-center">
						<input
							type="text"
							class="min-w-0 w-full rounded-lg border border-[#d6e2e7] px-2 py-1.5 text-sm text-[#173843] outline-none focus:border-[#0f5d6c]"
							placeholder="Descrizione"
							value={item.description}
							oninput={(event) => updateLineItem(index, 'description', (event.target as HTMLInputElement).value)}
						/>
						<div class="relative w-full">
							<span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[#6a8792]">EUR</span>
							<input
								type="number"
								step="0.01"
								class="w-full rounded-lg border border-[#d6e2e7] py-1.5 pl-10 pr-1.5 text-sm text-[#173843] outline-none focus:border-[#0f5d6c] [font-family:'DM_Mono',monospace]"
								placeholder="0"
								value={item.amount || ''}
								oninput={(event) => updateLineItem(index, 'amount', Number((event.target as HTMLInputElement).value))}
							/>
						</div>
						<select
							class="w-full rounded-lg border border-[#d6e2e7] px-2 py-1.5 text-xs text-[#173843] outline-none [font-family:'DM_Mono',monospace]"
							value={item.vatRate.toString()}
							onchange={(event) => updateLineItem(index, 'vatRate', Number((event.target as HTMLSelectElement).value))}
						>
							{#each vatRates as rate}
								<option value={rate}>{rate}%</option>
							{/each}
						</select>
						<button
							type="button"
							class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#a23939] transition-colors hover:bg-[#fff3f3]"
							aria-label={`Rimuovi la voce ${index + 1}`}
							onclick={() => removeLineItem(index)}
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<button
			type="button"
			class="mt-2 rounded-xl border border-dashed border-[#b8cdd4] px-3 py-2 text-xs font-semibold text-[#0f5d6c] transition-colors hover:bg-[#f0f8fa]"
			onclick={addLineItem}
		>
			+ Aggiungi voce
		</button>
	</div>
</div>
