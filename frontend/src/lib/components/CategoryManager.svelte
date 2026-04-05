<script lang="ts">
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import {
		addCustomCategory,
		categoriesState,
		categoryIconChoices,
		categoryPalette,
		deleteCustomCategory,
		updateCategory
	} from '$lib/stores/categories';
	import type { Category } from '$lib/types';

	let newName = $state('');
	let newColor = $state(categoryPalette[0]);
	let newIcon = $state(categoryIconChoices[0].value);
	let editTarget = $state<string | null>(null);
	let editName = $state('');
	let editColor = $state(categoryPalette[0]);
	let editIcon = $state(categoryIconChoices[0].value);
	let errorMessage = $state('');

	const defaultCategories = $derived($categoriesState.filter((category) => category.is_default));
	const customCategories = $derived($categoriesState.filter((category) => !category.is_default));

	function beginEdit(category: Category) {
		editTarget = category.id ?? category.name;
		editName = category.name;
		editColor = category.color;
		editIcon = category.icon;
		errorMessage = '';
	}

	async function saveEdit() {
		if (!editTarget) return;

		const result = await updateCategory(editTarget, editName, editColor, editIcon);
		if (!result.ok) {
			errorMessage = result.error ?? 'Non siamo riusciti a salvare la categoria.';
			return;
		}

		editTarget = null;
		errorMessage = '';
	}

	async function handleAddCategory() {
		const result = await addCustomCategory(newName, newColor, newIcon);
		if (!result.ok) {
			errorMessage = result.error ?? 'Non siamo riusciti a salvare la categoria.';
			return;
		}

		newName = '';
		newColor = categoryPalette[0];
		newIcon = categoryIconChoices[0].value;
		errorMessage = '';
	}

	async function handleDelete(category: Category) {
		if (!confirm(`Hai ${category.doc_count} documenti in questa categoria. Verranno spostati in "Altro". Confermi?`)) {
			return;
		}

		const result = await deleteCustomCategory(category.id ?? category.name);
		if (!result.ok) {
			errorMessage = result.error ?? 'Non siamo riusciti a eliminare la categoria.';
		}
	}
</script>

<section class="rounded-[2rem] border border-white/85 bg-white/76 p-5 shadow-[0_20px_50px_rgba(148,163,184,0.14)] backdrop-blur sm:p-6">
	<div>
		<p class="text-sm font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Categorie</p>
		<h2 class="mt-2 text-[2rem] font-bold tracking-[-0.04em] text-[#103844]">
			Organizza il vault con badge e colori
		</h2>
	</div>

	<div class="mt-6 grid gap-6">
		<div class="rounded-[1.6rem] border border-[#e3edf1] bg-white/88 p-5">
			<p class="text-sm font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Predefinite</p>
			<p class="mt-2 text-base text-[#5a707a]">
				Queste categorie non si eliminano, ma puoi personalizzare colore e icona.
			</p>

			<div class="mt-4 grid gap-4">
				{#each defaultCategories as category}
					<div class="rounded-[1.4rem] border border-[#e3edf1] bg-[#fbfdfd] px-4 py-4">
						<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<div class="flex items-center gap-4">
								<div class="inline-flex h-11 w-11 items-center justify-center rounded-full text-white" style={`background-color: ${category.color};`}>
									<CategoryIcon icon={category.icon} className="h-5 w-5" />
								</div>
								<div>
									<div class="flex flex-wrap items-center gap-2">
										<p class="text-lg font-semibold text-[#173843]">{category.name}</p>
										<span class="rounded-full bg-[#eef4f7] px-2 py-1 text-xs font-semibold text-[#58707a]">
											Bloccata
										</span>
										<span class="rounded-full bg-[#f6fafb] px-2 py-1 text-xs font-semibold text-[#58707a]">
											{category.doc_count} documenti
										</span>
									</div>
									<p class="mt-1 text-sm text-[#5a707a]">{category.color}</p>
								</div>
							</div>

							<button class="rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" type="button" onclick={() => beginEdit(category)}>
								Modifica
							</button>
						</div>

						{#if editTarget === category.name}
							<div class="mt-4 grid gap-3 rounded-[1.2rem] border border-[#e8eff2] bg-white p-4">
								<input class="min-h-11 rounded-xl border border-[#d9e4e8] px-3 text-sm text-[#173843] outline-none focus:border-[#0f5d6c]" type="text" bind:value={editName} disabled />

								<div>
									<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Colore</p>
									<div class="mt-2 flex flex-wrap gap-2">
										{#each categoryPalette as color}
											<button class={`h-7 w-7 rounded-full border-2 ${editColor === color ? 'border-[#173843]' : 'border-white'}`} type="button" aria-label={`Seleziona il colore ${color}`} style={`background-color: ${color};`} onclick={() => (editColor = color)}></button>
										{/each}
									</div>
								</div>

								<div>
									<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Icona</p>
									<div class="mt-2 flex flex-wrap gap-2">
										{#each categoryIconChoices as choice}
											<button class={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${editIcon === choice.value ? 'border-[#0f5d6c] bg-[#eef7f8] text-[#0f5d6c]' : 'border-[#d9e4e8] bg-white text-[#365661]'}`} type="button" aria-label={`Seleziona l'icona ${choice.label}`} onclick={() => (editIcon = choice.value)}>
												<CategoryIcon icon={choice.value} className="h-4.5 w-4.5" />
											</button>
										{/each}
									</div>
								</div>

								<div class="flex gap-2">
									<button class="rounded-full bg-[#0f5d6c] px-4 py-2 text-sm font-semibold text-white" type="button" onclick={saveEdit}>Salva</button>
									<button class="rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843]" type="button" onclick={() => (editTarget = null)}>Annulla</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="rounded-[1.6rem] border border-[#e3edf1] bg-white/88 p-5">
			<p class="text-sm font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Le tue categorie</p>
			<p class="mt-2 text-base text-[#5a707a]">
				Aggiungi categorie personali e usale come filtro nella lista documenti.
			</p>

			<div class="mt-4 grid gap-4">
				{#if customCategories.length}
					{#each customCategories as category}
						<div class="rounded-[1.4rem] border border-[#e3edf1] bg-[#fbfdfd] px-4 py-4">
							<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
								<div class="flex items-center gap-4">
									<div class="inline-flex h-11 w-11 items-center justify-center rounded-full text-white" style={`background-color: ${category.color};`}>
										<CategoryIcon icon={category.icon} className="h-5 w-5" />
									</div>
									<div>
										<div class="flex flex-wrap items-center gap-2">
											<p class="text-lg font-semibold text-[#173843]">{category.name}</p>
											<span class="rounded-full bg-[#f6fafb] px-2 py-1 text-xs font-semibold text-[#58707a]">
												{category.doc_count} documenti
											</span>
										</div>
										<p class="mt-1 text-sm text-[#5a707a]">{category.color}</p>
									</div>
								</div>

								<div class="flex flex-wrap items-center gap-2">
									<button class="rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843] transition-colors hover:bg-[#f6fafb]" type="button" onclick={() => beginEdit(category)}>Modifica</button>
									<button class="rounded-full border border-[#f1cccc] bg-[#fff3f3] px-4 py-2 text-sm font-semibold text-[#a23939] transition-colors hover:bg-[#ffe7e7]" type="button" onclick={() => handleDelete(category)}>Elimina</button>
								</div>
							</div>

							{#if editTarget === category.name}
								<div class="mt-4 grid gap-3 rounded-[1.2rem] border border-[#e8eff2] bg-white p-4">
									<input class="min-h-11 rounded-xl border border-[#d9e4e8] px-3 text-sm text-[#173843] outline-none focus:border-[#0f5d6c]" type="text" bind:value={editName} />

									<div>
										<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Colore</p>
										<div class="mt-2 flex flex-wrap gap-2">
											{#each categoryPalette as color}
												<button class={`h-7 w-7 rounded-full border-2 ${editColor === color ? 'border-[#173843]' : 'border-white'}`} type="button" aria-label={`Seleziona il colore ${color}`} style={`background-color: ${color};`} onclick={() => (editColor = color)}></button>
											{/each}
										</div>
									</div>

									<div>
										<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Icona</p>
										<div class="mt-2 flex flex-wrap gap-2">
											{#each categoryIconChoices as choice}
												<button class={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${editIcon === choice.value ? 'border-[#0f5d6c] bg-[#eef7f8] text-[#0f5d6c]' : 'border-[#d9e4e8] bg-white text-[#365661]'}`} type="button" aria-label={`Seleziona l'icona ${choice.label}`} onclick={() => (editIcon = choice.value)}>
													<CategoryIcon icon={choice.value} className="h-4.5 w-4.5" />
												</button>
											{/each}
										</div>
									</div>

									<div class="flex gap-2">
										<button class="rounded-full bg-[#0f5d6c] px-4 py-2 text-sm font-semibold text-white" type="button" onclick={saveEdit}>Salva</button>
										<button class="rounded-full border border-[#d9e4e8] px-4 py-2 text-sm font-semibold text-[#173843]" type="button" onclick={() => (editTarget = null)}>Annulla</button>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				{:else}
					<div class="rounded-[1.4rem] border border-dashed border-[#d5e3e8] bg-[#fbfdfd] px-4 py-5 text-sm leading-6 text-[#5a707a]">
						Non hai ancora categorie personalizzate. Creane una nuova qui sotto e usala subito nei documenti.
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="mt-6 rounded-[1.5rem] border border-[#e3edf1] bg-white/88 p-5">
		<p class="text-sm font-semibold uppercase tracking-[0.18em] text-[#6a8792]">Aggiungi categoria</p>

		<div class="mt-4 grid gap-3">
			<input class="min-h-11 rounded-xl border border-[#d9e4e8] px-3 text-sm text-[#173843] outline-none focus:border-[#0f5d6c]" type="text" bind:value={newName} placeholder="Es. Spese Software" />

			<div>
				<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Colore</p>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each categoryPalette as color}
						<button class={`h-7 w-7 rounded-full border-2 ${newColor === color ? 'border-[#173843]' : 'border-white'}`} type="button" aria-label={`Seleziona il colore ${color}`} style={`background-color: ${color};`} onclick={() => (newColor = color)}></button>
					{/each}
				</div>
			</div>

			<div>
				<p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a8792]">Icona</p>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each categoryIconChoices as choice}
						<button class={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${newIcon === choice.value ? 'border-[#0f5d6c] bg-[#eef7f8] text-[#0f5d6c]' : 'border-[#d9e4e8] bg-white text-[#365661]'}`} type="button" aria-label={`Seleziona l'icona ${choice.label}`} onclick={() => (newIcon = choice.value)}>
							<CategoryIcon icon={choice.value} className="h-4.5 w-4.5" />
						</button>
					{/each}
				</div>
			</div>

			{#if errorMessage}
				<p class="text-sm font-medium text-[#a23939]">{errorMessage}</p>
			{/if}

			<button class="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0f5d6c] px-4 text-sm font-semibold text-white" type="button" onclick={handleAddCategory}>
				Salva categoria
			</button>
		</div>
	</div>
</section>
