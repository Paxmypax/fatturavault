<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import { addCustomCategory, categoryIconChoices, categoryPalette } from '$lib/stores/categories';
	import type { Category } from '$lib/types';

	let {
		categories = [],
		selected = $bindable('Altro')
	}: {
		categories?: Category[];
		selected?: string;
	} = $props();

	const dispatch = createEventDispatcher<{ change: { value: string } }>();

	let open = $state(false);
	let showNewCategory = $state(false);
	let newName = $state('');
	let newColor = $state(categoryPalette[0]);
	let newIcon = $state(categoryIconChoices[0].value);
	let errorMessage = $state('');

	function chooseCategory(name: string) {
		selected = name;
		dispatch('change', { value: name });
		open = false;
	}

	async function handleAddCategory() {
		const result = await addCustomCategory(newName, newColor, newIcon);
		if (!result.ok) {
			errorMessage = result.error ?? 'Non siamo riusciti a salvare la categoria.';
			return;
		}

		errorMessage = '';
		showNewCategory = false;
		selected = newName.trim();
		chooseCategory(newName.trim());
		newName = '';
		newColor = categoryPalette[0];
		newIcon = categoryIconChoices[0].value;
	}
</script>

<div class="relative">
	<button
		class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d9e4e8] bg-white px-4 py-2 text-sm font-medium text-[#173843] shadow-sm transition-colors hover:bg-[#f9fbfc]"
		type="button"
		onclick={() => (open = !open)}
	>
		<span>{selected}</span>
		<svg aria-hidden="true" class="h-4 w-4 text-[#6a8792]" fill="none" viewBox="0 0 24 24">
			<path d="m6 9 6 6 6-6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" />
		</svg>
	</button>

	{#if open}
		<div class="absolute left-0 z-50 mt-2 min-w-[300px] rounded-2xl border border-[#d9e4e8] bg-white p-3 shadow-[0_22px_40px_rgba(15,23,42,0.12)]">
			<div class="grid gap-2">
				{#each categories as category}
					<button
						class={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${selected === category.name ? 'bg-[#f6fafb] text-[#0f5d6c]' : 'text-[#173843] hover:bg-[#f6fafb]'}`}
						type="button"
						onclick={() => chooseCategory(category.name)}
					>
						<span class="inline-block h-2.5 w-2.5 rounded-full" style={`background-color: ${category.color};`}></span>
						<span class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#365661]">
							<CategoryIcon icon={category.icon} className="h-3.5 w-3.5" />
						</span>
						<span>{category.name}</span>
					</button>
				{/each}
			</div>

			<div class="mt-3 border-t border-[#e8eff2] pt-3">
				<button
					class="text-sm font-semibold text-[#0f5d6c]"
					type="button"
					onclick={() => (showNewCategory = !showNewCategory)}
				>
					+ Nuova categoria
				</button>

				{#if showNewCategory}
					<div class="mt-3 grid gap-3">
						<input
							class="min-h-11 rounded-xl border border-[#d9e4e8] px-3 text-sm text-[#173843] outline-none focus:border-[#0f5d6c]"
							type="text"
							bind:value={newName}
							placeholder="Nome categoria"
						/>

						<div>
							<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Colore</p>
							<div class="mt-2 flex flex-wrap gap-2">
								{#each categoryPalette as color}
									<button
										class={`h-7 w-7 rounded-full border-2 ${newColor === color ? 'border-[#173843]' : 'border-white'}`}
										type="button"
										aria-label={`Seleziona il colore ${color}`}
										style={`background-color: ${color};`}
										onclick={() => (newColor = color)}
									></button>
								{/each}
							</div>
						</div>

						<div>
							<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Icona</p>
							<div class="mt-2 flex flex-wrap gap-2">
								{#each categoryIconChoices as choice}
									<button
										class={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${newIcon === choice.value ? 'border-[#0f5d6c] bg-[#eef7f8] text-[#0f5d6c]' : 'border-[#d9e4e8] bg-white text-[#365661]'}`}
										type="button"
										aria-label={`Seleziona l'icona ${choice.label}`}
										onclick={() => (newIcon = choice.value)}
									>
										<CategoryIcon icon={choice.value} className="h-4.5 w-4.5" />
									</button>
								{/each}
							</div>
						</div>

						{#if errorMessage}
							<p class="text-sm font-medium text-[#a23939]">{errorMessage}</p>
						{/if}

						<button
							class="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f5d6c] px-4 text-sm font-semibold text-white"
							type="button"
							onclick={handleAddCategory}
						>
							Salva categoria
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
