<script lang="ts">
	import type { WarrantyData } from '$lib/types';

	interface Props {
		data: WarrantyData;
		onchange: (data: WarrantyData) => void;
	}

	let { data = $bindable({}), onchange }: Props = $props();

	const durationOptions = ['6', '12', '18', '24', '36', '48', '60'];
	const fieldId = `warranty-${Math.random().toString(36).slice(2, 8)}`;
	let durationValue = $state('');

	$effect(() => {
		durationValue = data.durationMonths != null ? String(data.durationMonths) : '';
	});

	function handleInput() {
		onchange({ ...data });
	}

	function handleDurationChange(value: string) {
		durationValue = value;
		data.durationMonths = value ? Number(value) : undefined;
		handleInput();
	}
</script>

<div class="rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4">
	<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Dati garanzia</p>

	<div class="mt-3 grid gap-3 sm:grid-cols-2">
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-product`}>Prodotto</label>
			<input id={`${fieldId}-product`} type="text" class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]" placeholder="Es. MacBook Pro" bind:value={data.product} oninput={handleInput} />
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-brand`}>Marca</label>
			<input id={`${fieldId}-brand`} type="text" class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]" placeholder="Es. Apple" bind:value={data.brand} oninput={handleInput} />
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-store`}>Negozio</label>
			<input id={`${fieldId}-store`} type="text" class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]" placeholder="Es. Amazon, Unieuro" bind:value={data.store} oninput={handleInput} />
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-purchase-date`}>Data acquisto</label>
			<input id={`${fieldId}-purchase-date`} type="date" class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]" bind:value={data.purchaseDate} oninput={handleInput} />
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-duration`}>Durata garanzia</label>
			<select
				id={`${fieldId}-duration`}
				class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]"
				bind:value={durationValue}
				onchange={(e) => handleDurationChange((e.target as HTMLSelectElement).value)}
			>
				<option value="">Seleziona...</option>
				{#each durationOptions as d}
					<option value={d}>{d} mesi</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-serial-number`}>N. Seriale</label>
			<input id={`${fieldId}-serial-number`} type="text" class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]" placeholder="Opzionale" bind:value={data.serialNumber} oninput={handleInput} />
		</div>
	</div>
</div>
