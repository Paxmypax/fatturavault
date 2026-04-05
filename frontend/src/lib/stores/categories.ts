import { browser } from '$app/environment';
import { get, derived, writable } from 'svelte/store';
import { authState } from '$lib/auth';
import {
	addRemoteCategory,
	deleteRemoteCategory,
	fetchRemoteCategories,
	isVaultBackendConfigured,
	updateRemoteCategory
} from '$lib/ic/vaultBackend';
import { replaceVaultCategory, vaultState } from '$lib/vault';
import type { Category, CategoryDefinition } from '$lib/types';

type CategoryConfigState = {
	customCategories: CategoryDefinition[];
	defaultOverrides: Record<string, Pick<CategoryDefinition, 'color' | 'icon'>>;
};

const LEGACY_ICON_MAP: Record<string, string> = {
	'ðŸ§¾': 'invoice',
	'ðŸ›¡ï¸': 'shield',
	'ðŸ“„': 'contract',
	'ðŸªª': 'id-card',
	'ðŸ¥': 'health',
	'ðŸ ': 'home',
	'ðŸš—': 'car',
	'ðŸŽ“': 'graduation',
	'ðŸ’¼': 'briefcase',
	'ðŸ’°': 'coins',
	'ðŸ”’': 'lock',
	'ðŸ”„': 'refresh',
	'ðŸ›ï¸': 'government',
	'ðŸ“Ž': 'paperclip',
	'ðŸ’»': 'laptop',
	'ðŸ½ï¸': 'meal',
	'ðŸ§³': 'tools',
	'ðŸ§°': 'tools',
	'ðŸ“¦': 'package',
	'ðŸ§ ': 'spark'
};

const CATEGORIES_STORAGE_KEY = 'fatturavault-categories';

const DEFAULT_CATEGORIES: CategoryDefinition[] = [
	{ id: 'invoice', name: 'Fattura', color: '#3B82F6', icon: 'invoice', is_default: true },
	{ id: 'warranty', name: 'Garanzia', color: '#10B981', icon: 'shield', is_default: true },
	{ id: 'receipt', name: 'Ricevuta', color: '#8B5CF6', icon: 'receipt', is_default: true },
	{ id: 'contract', name: 'Contratto', color: '#F59E0B', icon: 'contract', is_default: true },
	{ id: 'identity', name: 'Identità', color: '#EF4444', icon: 'id-card', is_default: true },
	{ id: 'health', name: 'Salute', color: '#EC4899', icon: 'health', is_default: true },
	{ id: 'home', name: 'Casa', color: '#14B8A6', icon: 'home', is_default: true },
	{ id: 'car', name: 'Auto', color: '#F97316', icon: 'car', is_default: true },
	{ id: 'education', name: 'Formazione', color: '#A855F7', icon: 'graduation', is_default: true },
	{ id: 'work', name: 'Lavoro', color: '#6366F1', icon: 'briefcase', is_default: true },
	{ id: 'finance', name: 'Finanza', color: '#059669', icon: 'coins', is_default: true },
	{ id: 'insurance', name: 'Assicurazione', color: '#1D4ED8', icon: 'lock', is_default: true },
	{ id: 'subscription', name: 'Abbonamento', color: '#06B6D4', icon: 'refresh', is_default: true },
	{ id: 'tax', name: 'Fiscale', color: '#DC2626', icon: 'government', is_default: true },
	{ id: 'other', name: 'Altro', color: '#6B7280', icon: 'paperclip', is_default: true }
];

const categoryConfigStore = writable<CategoryConfigState>({
	customCategories: [],
	defaultOverrides: {}
});

let categoriesInitialized = false;
let categoriesInitPromise: Promise<void> | null = null;
let authSubscriptionStarted = false;

function writeCategoryConfig(state: CategoryConfigState) {
	if (!browser) {
		return;
	}

	localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(state));
}

function normalizeName(name: string) {
	return name.trim().toLowerCase();
}

function buildLocalCategoryId(name: string) {
	return `local-${normalizeName(name).replace(/[^a-z0-9]+/g, '-')}`;
}

function normalizeIcon(icon: string | undefined) {
	if (!icon) {
		return 'paperclip';
	}

	return LEGACY_ICON_MAP[icon] ?? icon;
}

function readCategoryConfig(): CategoryConfigState {
	if (!browser) {
		return {
			customCategories: [],
			defaultOverrides: {}
		};
	}

	const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
	if (!raw) {
		return {
			customCategories: [],
			defaultOverrides: {}
		};
	}

	try {
		const parsed = JSON.parse(raw);
		return {
			customCategories: Array.isArray(parsed?.customCategories)
				? parsed.customCategories.map((category: CategoryDefinition) => ({
						...category,
						id: category.id ?? buildLocalCategoryId(category.name),
						icon: normalizeIcon(category.icon)
					}))
				: [],
			defaultOverrides:
				parsed?.defaultOverrides && typeof parsed.defaultOverrides === 'object'
					? Object.fromEntries(
							Object.entries(parsed.defaultOverrides).map(([name, value]) => [
								name,
								{
									...(value as Pick<CategoryDefinition, 'color' | 'icon'>),
									icon: normalizeIcon((value as Pick<CategoryDefinition, 'color' | 'icon'>).icon)
								}
							])
						)
					: {}
		};
	} catch {
		return {
			customCategories: [],
			defaultOverrides: {}
		};
	}
}

function buildAllCategories(
	config: CategoryConfigState,
	documents: { categoryName?: string; status?: string }[]
): Category[] {
	const processedDocuments = documents.filter((document) => document.status === 'processed');
	const docCounts = processedDocuments.reduce<Record<string, number>>((acc, document) => {
		const key = document.categoryName || 'Altro';
		acc[key] = (acc[key] ?? 0) + 1;
		return acc;
	}, {});

	const defaults = DEFAULT_CATEGORIES.map((category) => {
		const override = config.defaultOverrides[category.name];
		return {
			...category,
			color: override?.color ?? category.color,
			icon: override?.icon ?? category.icon,
			doc_count: docCounts[category.name] ?? 0
		};
	});

	const customs = config.customCategories.map((category) => ({
		...category,
		doc_count: docCounts[category.name] ?? 0
	}));

	return [...defaults, ...customs];
}

function snapshotConfig() {
	return readCategoryConfig();
}

function upsertConfig(nextState: CategoryConfigState) {
	writeCategoryConfig(nextState);
	categoryConfigStore.set(nextState);
}

function getAuthReadyForRemote() {
	const snapshot = get(authState);
	return snapshot.authenticated && Boolean(snapshot.principal) && isVaultBackendConfigured();
}

function createConfigFromRemoteCategories(categories: Category[]): CategoryConfigState {
	const defaultOverrides: Record<string, Pick<CategoryDefinition, 'color' | 'icon'>> = {};
	const customCategories: CategoryDefinition[] = [];

	for (const category of categories) {
		if (category.is_default) {
			const baseCategory = DEFAULT_CATEGORIES.find((item) => item.name === category.name);
			if (!baseCategory) {
				continue;
			}

			if (baseCategory.color !== category.color || baseCategory.icon !== category.icon) {
				defaultOverrides[category.name] = {
					color: category.color,
					icon: category.icon
				};
			}
			continue;
		}

		customCategories.push({
			id: category.id ?? buildLocalCategoryId(category.name),
			name: category.name,
			color: category.color,
			icon: category.icon,
			is_default: false
		});
	}

	return {
		customCategories,
		defaultOverrides
	};
}

async function syncRemoteCategories() {
	if (!getAuthReadyForRemote()) {
		return;
	}

	try {
		const remoteCategories = await fetchRemoteCategories();
		if (!remoteCategories) {
			return;
		}

		const nextState = createConfigFromRemoteCategories(remoteCategories);
		upsertConfig(nextState);
	} catch (error) {
		console.warn('Impossibile sincronizzare le categorie dal backend ICP.', error);
	}
}

export async function refreshCategoriesFromRemote() {
	await syncRemoteCategories();
}

function resolveCategoryReference(state: CategoryConfigState, reference: string) {
	const defaultCategory =
		DEFAULT_CATEGORIES.find((category) => category.id === reference) ??
		DEFAULT_CATEGORIES.find((category) => category.name === reference);

	if (defaultCategory) {
		return defaultCategory;
	}

	return (
		state.customCategories.find((category) => category.id === reference) ??
		state.customCategories.find((category) => category.name === reference) ??
		null
	);
}

export const categoriesState = derived([categoryConfigStore, vaultState], ([$config, $vault]) =>
	buildAllCategories($config, $vault.documents)
);

export function initCategories() {
	if (!browser) {
		return Promise.resolve();
	}

	if (!authSubscriptionStarted) {
		authState.subscribe((state) => {
			if (state.authenticated && isVaultBackendConfigured()) {
				void syncRemoteCategories();
			}
		});
		authSubscriptionStarted = true;
	}

	if (categoriesInitialized) {
		return categoriesInitPromise ?? Promise.resolve();
	}

	categoryConfigStore.set(readCategoryConfig());
	categoriesInitialized = true;
	categoriesInitPromise = syncRemoteCategories().finally(() => {
		categoriesInitPromise = null;
	});
	return categoriesInitPromise;
}

export async function addCustomCategory(name: string, color: string, icon: string) {
	const nextName = name.trim();
	if (!nextName) {
		return { ok: false, error: 'Inserisci un nome categoria.' };
	}

	const state = snapshotConfig();
	const allNames = [
		...DEFAULT_CATEGORIES.map((category) => normalizeName(category.name)),
		...state.customCategories.map((category) => normalizeName(category.name))
	];

	if (allNames.includes(normalizeName(nextName))) {
		return { ok: false, error: 'Esiste già una categoria con questo nome.' };
	}

	let nextCategory: CategoryDefinition = {
		id: buildLocalCategoryId(nextName),
		name: nextName,
		color,
		icon,
		is_default: false
	};

	if (getAuthReadyForRemote()) {
		try {
			const remoteCategory = await addRemoteCategory(nextName, color, icon);
			if (remoteCategory) {
				nextCategory = {
					id: remoteCategory.id ?? buildLocalCategoryId(remoteCategory.name),
					name: remoteCategory.name,
					color: remoteCategory.color,
					icon: remoteCategory.icon,
					is_default: false
				};
			}
		} catch (error) {
			return {
				ok: false,
				error:
					error instanceof Error
						? error.message
						: 'Non siamo riusciti a salvare la categoria sul backend ICP.'
			};
		}
	}

	upsertConfig({
		...state,
		customCategories: [...state.customCategories, nextCategory]
	});

	return { ok: true };
}

export async function updateCategory(
	categoryReference: string,
	newName: string,
	color: string,
	icon: string
) {
	const state = snapshotConfig();
	const targetCategory = resolveCategoryReference(state, categoryReference);
	const trimmedOld = targetCategory?.name?.trim() ?? categoryReference.trim();
	const trimmedNew = newName.trim();

	if (!trimmedOld || !trimmedNew) {
		return { ok: false, error: 'Il nome categoria non può essere vuoto.' };
	}

	if (!targetCategory) {
		return { ok: false, error: 'Categoria non trovata.' };
	}

	if (trimmedOld !== trimmedNew) {
		const names = buildAllCategories(state, []).map((category) => normalizeName(category.name));
		const currentMatchesTarget = normalizeName(trimmedOld) === normalizeName(trimmedNew);
		if (!currentMatchesTarget && names.includes(normalizeName(trimmedNew))) {
			return { ok: false, error: 'Esiste già una categoria con questo nome.' };
		}
	}

	if (getAuthReadyForRemote()) {
		try {
			await updateRemoteCategory(
				targetCategory.id ?? buildLocalCategoryId(trimmedOld),
				trimmedNew,
				color,
				icon
			);
		} catch (error) {
			return {
				ok: false,
				error:
					error instanceof Error
						? error.message
						: 'Non siamo riusciti ad aggiornare la categoria sul backend ICP.'
			};
		}
	}

	if (targetCategory.is_default) {
		upsertConfig({
			...state,
			defaultOverrides: {
				...state.defaultOverrides,
				[trimmedOld]: { color, icon }
			}
		});
		return { ok: true };
	}

	const nextCustomCategories = state.customCategories.map((category) =>
		(category.id && category.id === targetCategory.id) || category.name === trimmedOld
			? {
					...category,
					name: trimmedNew,
					color,
					icon
				}
			: category
	);

	upsertConfig({
		...state,
		customCategories: nextCustomCategories
	});

	if (trimmedOld !== trimmedNew) {
		replaceVaultCategory(trimmedOld, trimmedNew);
	}

	return { ok: true };
}

export async function deleteCustomCategory(reference: string) {
	const state = snapshotConfig();
	const targetCategory = resolveCategoryReference(state, reference);
	const trimmedName = targetCategory?.name?.trim() ?? reference.trim();

	if (!targetCategory || targetCategory.is_default) {
		return { ok: false, error: 'Questa categoria non si può eliminare.' };
	}

	if (getAuthReadyForRemote()) {
		try {
			await deleteRemoteCategory(targetCategory.id ?? buildLocalCategoryId(trimmedName));
		} catch (error) {
			return {
				ok: false,
				error:
					error instanceof Error
						? error.message
						: 'Non siamo riusciti a eliminare la categoria dal backend ICP.'
			};
		}
	}

	upsertConfig({
		...state,
		customCategories: state.customCategories.filter(
			(category) => category.id !== targetCategory.id && category.name !== trimmedName
		)
	});

	replaceVaultCategory(trimmedName, 'Altro');
	return { ok: true };
}

export function getCategoryByName(name: string | null | undefined, categories: Category[]) {
	if (!name) {
		return categories.find((category) => category.name === 'Altro') ?? null;
	}

	return (
		categories.find((category) => normalizeName(category.name) === normalizeName(name)) ??
		categories.find((category) => category.name === 'Altro') ??
		null
	);
}

export const categoryPalette = [
	'#3B82F6',
	'#10B981',
	'#8B5CF6',
	'#F59E0B',
	'#EF4444',
	'#EC4899',
	'#14B8A6',
	'#F97316',
	'#A855F7',
	'#6366F1',
	'#059669',
	'#1D4ED8',
	'#06B6D4',
	'#DC2626',
	'#6B7280',
	'#C084FC'
];

export const categoryIconChoices = [
	{ value: 'invoice', label: 'Fattura' },
	{ value: 'shield', label: 'Garanzia' },
	{ value: 'receipt', label: 'Ricevuta' },
	{ value: 'contract', label: 'Contratto' },
	{ value: 'id-card', label: 'Identita' },
	{ value: 'health', label: 'Salute' },
	{ value: 'home', label: 'Casa' },
	{ value: 'car', label: 'Auto' },
	{ value: 'graduation', label: 'Formazione' },
	{ value: 'briefcase', label: 'Lavoro' },
	{ value: 'coins', label: 'Finanza' },
	{ value: 'lock', label: 'Assicurazione' },
	{ value: 'refresh', label: 'Abbonamento' },
	{ value: 'government', label: 'Fiscale' },
	{ value: 'paperclip', label: 'Altro' },
	{ value: 'laptop', label: 'Digitale' },
	{ value: 'meal', label: 'Spese' },
	{ value: 'tools', label: 'Strumenti' },
	{ value: 'package', label: 'Prodotto' },
	{ value: 'spark', label: 'Extra' }
];
