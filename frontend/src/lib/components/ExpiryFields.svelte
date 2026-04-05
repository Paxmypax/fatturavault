<script lang="ts">
	interface Props {
		hasExpiry: boolean;
		expiryDate?: string;
		expiryType?: string;
		expiryDuration?: string;
		onchange: (data: { hasExpiry: boolean; expiryDate?: string; expiryType?: string; expiryDuration?: string }) => void;
	}

	let { hasExpiry = $bindable(false), expiryDate = $bindable(''), expiryType = $bindable(''), expiryDuration = $bindable(''), onchange }: Props = $props();

	const expiryTypes = ['Garanzia', 'Assicurazione', 'Abbonamento', 'Contratto', 'Altro'];
	const durationOptions = ['6 mesi', '12 mesi', '18 mesi', '24 mesi', '36 mesi', '48 mesi', '60 mesi'];
	const fieldId = `expiry-${Math.random().toString(36).slice(2, 8)}`;

	function handleToggle() {
		hasExpiry = !hasExpiry;
		onchange({ hasExpiry, expiryDate: hasExpiry ? expiryDate : undefined, expiryType: hasExpiry ? expiryType : undefined, expiryDuration: hasExpiry ? expiryDuration : undefined });
	}

	function handleInput() {
		onchange({ hasExpiry, expiryDate, expiryType, expiryDuration });
	}
</script>

<div class="rounded-[1.2rem] border border-[#e3edf1] bg-[#f8fbfc] p-4">
	<label class="flex cursor-pointer items-center gap-3">
		<input id={`${fieldId}-enabled`} type="checkbox" class="h-5 w-5 rounded accent-[#0f5d6c]" checked={hasExpiry} onchange={handleToggle} />
		<span class="text-sm font-semibold uppercase tracking-[0.14em] text-[#6a8792]">Ha una scadenza</span>
	</label>

	{#if hasExpiry}
		<div class="mt-4 grid gap-3">
			<div>
				<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-type`}>Tipo</label>
				<select id={`${fieldId}-type`} class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]" bind:value={expiryType} onchange={handleInput}>
					<option value="">Seleziona...</option>
					{#each expiryTypes as t}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-date`}>Scadenza</label>
				<input id={`${fieldId}-date`} type="date" class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]" bind:value={expiryDate} oninput={handleInput} />
			</div>
			<div>
				<label class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#6a8792]" for={`${fieldId}-duration`}>Durata</label>
				<select id={`${fieldId}-duration`} class="w-full rounded-2xl border border-[#d6e2e7] bg-white px-3 py-2.5 text-sm font-medium text-[#173843] outline-none focus:border-[#0f5d6c]" bind:value={expiryDuration} onchange={handleInput}>
					<option value="">Seleziona...</option>
					{#each durationOptions as d}
						<option value={d}>{d}</option>
					{/each}
				</select>
			</div>
		</div>
	{/if}
</div>
