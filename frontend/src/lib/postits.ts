import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { authState } from '$lib/auth';
import {
	deleteRemotePostIt,
	fetchRemotePostIts,
	isVaultBackendConfigured,
	upsertRemotePostIt
} from '$lib/ic/vaultBackend';

export type PostItNote = {
	id: string;
	text: string;
	completed: boolean;
	color: string;
	createdAt: string;
	updatedAt?: string;
};

type PostItState = {
	notes: PostItNote[];
	ready: boolean;
};

const POSTITS_STORAGE_KEY = 'fatturavault-postits';
const POSTITS_DELETED_STORAGE_KEY = 'fatturavault-postits-deleted';
const POSTITS_PENDING_STORAGE_KEY = 'fatturavault-postits-pending';
const postitColors = ['#fff0a8', '#ffd7d7', '#d9f4ff', '#dff7d6', '#efe1ff'];

const postitStore = writable<PostItState>({
	notes: [],
	ready: false
});

let postitsInitialized = false;
let authSubscriptionStarted = false;
let lastPrincipal: string | null = null;

function currentPrincipal() {
	return get(authState).principal ?? null;
}

function storageKeyFor(principal: string | null) {
	return principal ? `${POSTITS_STORAGE_KEY}:${principal}` : POSTITS_STORAGE_KEY;
}

function deletedStorageKeyFor(principal: string | null) {
	return principal ? `${POSTITS_DELETED_STORAGE_KEY}:${principal}` : POSTITS_DELETED_STORAGE_KEY;
}

function pendingStorageKeyFor(principal: string | null) {
	return principal ? `${POSTITS_PENDING_STORAGE_KEY}:${principal}` : POSTITS_PENDING_STORAGE_KEY;
}

function normalizeNotes(rawValue: string | null): PostItNote[] {
	if (!rawValue) {
		return [];
	}

	try {
		const parsed = JSON.parse(rawValue);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.map((note: Record<string, unknown>) => ({
			id: (note.id as string) ?? crypto.randomUUID(),
			text: (note.text as string) ?? '',
			completed: Boolean(note.completed),
			color: (note.color as string) ?? postitColors[0],
			createdAt: (note.createdAt as string) ?? new Date().toISOString(),
			updatedAt: (note.updatedAt as string) ?? (note.createdAt as string) ?? new Date().toISOString()
		}));
	} catch {
		return [];
	}
}

function readNotes(principal: string | null = currentPrincipal()): PostItNote[] {
	if (!browser) {
		return [];
	}

	const scopedKey = storageKeyFor(principal);
	const scopedRaw = localStorage.getItem(scopedKey);
	if (scopedRaw !== null) {
		const scopedNotes = normalizeNotes(scopedRaw);
		return scopedNotes;
	}

	if (principal) {
		const legacyNotes = normalizeNotes(localStorage.getItem(POSTITS_STORAGE_KEY));
		if (legacyNotes.length) {
			localStorage.setItem(scopedKey, JSON.stringify(legacyNotes));
			localStorage.removeItem(POSTITS_STORAGE_KEY);
			return legacyNotes;
		}
	}

	return [];
}

function writeNotes(notes: PostItNote[], principal: string | null = currentPrincipal()) {
	if (!browser) {
		return;
	}

	localStorage.setItem(storageKeyFor(principal), JSON.stringify(notes));
}

function readDeletedIds(principal: string | null = currentPrincipal()) {
	if (!browser) {
		return new Set<string>();
	}

	const raw = localStorage.getItem(deletedStorageKeyFor(principal));
	if (!raw) {
		return new Set<string>();
	}

	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return new Set<string>();
		}

		return new Set(parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0));
	} catch {
		return new Set<string>();
	}
}

function writeDeletedIds(ids: Set<string>, principal: string | null = currentPrincipal()) {
	if (!browser) {
		return;
	}

	if (!ids.size) {
		localStorage.removeItem(deletedStorageKeyFor(principal));
		return;
	}

	localStorage.setItem(deletedStorageKeyFor(principal), JSON.stringify([...ids]));
}

function readPendingIds(principal: string | null = currentPrincipal()) {
	if (!browser) {
		return new Set<string>();
	}

	const raw = localStorage.getItem(pendingStorageKeyFor(principal));
	if (!raw) {
		return new Set<string>();
	}

	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return new Set<string>();
		}

		return new Set(parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0));
	} catch {
		return new Set<string>();
	}
}

function writePendingIds(ids: Set<string>, principal: string | null = currentPrincipal()) {
	if (!browser) {
		return;
	}

	if (!ids.size) {
		localStorage.removeItem(pendingStorageKeyFor(principal));
		return;
	}

	localStorage.setItem(pendingStorageKeyFor(principal), JSON.stringify([...ids]));
}

function syncPostItState(notes: PostItNote[], principal: string | null = currentPrincipal()) {
	writeNotes(notes, principal);
	postitStore.set({
		notes,
		ready: true
	});
}

function canSyncRemote() {
	const snapshot = get(authState);
	return snapshot.authenticated && Boolean(snapshot.principal) && isVaultBackendConfigured();
}

function mergeNotes(
	localNotes: PostItNote[],
	remoteNotes: PostItNote[],
	deletedIds: Set<string>,
	pendingIds: Set<string>
) {
	const merged = new Map<string, PostItNote>();

	for (const note of remoteNotes) {
		if (deletedIds.has(note.id)) {
			continue;
		}

		merged.set(note.id, note);
	}

	for (const note of localNotes) {
		if (deletedIds.has(note.id)) {
			continue;
		}

		const current = merged.get(note.id);
		if (!current) {
			if (!pendingIds.has(note.id)) {
				continue;
			}
			merged.set(note.id, note);
			continue;
		}

		const localUpdatedAt = new Date(note.updatedAt ?? note.createdAt).getTime();
		const remoteUpdatedAt = new Date(current.updatedAt ?? current.createdAt).getTime();
		if (Number.isNaN(remoteUpdatedAt) || localUpdatedAt >= remoteUpdatedAt) {
			merged.set(note.id, note);
		}
	}

	return [...merged.values()].sort((a, b) => {
		const aCompletedRank = a.completed ? 1 : 0;
		const bCompletedRank = b.completed ? 1 : 0;
		if (aCompletedRank !== bCompletedRank) {
			return aCompletedRank - bCompletedRank;
		}

		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});
}

async function flushPostItsToRemote(
	localNotes: PostItNote[],
	remoteNotes: PostItNote[],
	deletedIds: Set<string>,
	pendingIds: Set<string>
) {
	if (!canSyncRemote()) {
		return;
	}

	const remoteById = new Map(remoteNotes.map((note) => [note.id, note]));
	const nextDeletedIds = new Set(deletedIds);
	const nextPendingIds = new Set(pendingIds);

	for (const deletedId of deletedIds) {
		try {
			await deleteRemotePostIt(deletedId);
			remoteById.delete(deletedId);
			nextPendingIds.delete(deletedId);
		} catch (error) {
			console.warn('Impossibile eliminare il post-it dal backend ICP.', error);
		}
	}

	for (const note of localNotes) {
		const remoteNote = remoteById.get(note.id);
		const localUpdatedAt = new Date(note.updatedAt ?? note.createdAt).getTime();
		const remoteUpdatedAt = remoteNote
			? new Date(remoteNote.updatedAt ?? remoteNote.createdAt).getTime()
			: Number.NEGATIVE_INFINITY;

		if (!remoteNote || localUpdatedAt > remoteUpdatedAt) {
			try {
				const synced = await upsertRemotePostIt({
					id: note.id,
					text: note.text,
					completed: note.completed,
					color: note.color
				});
				if (synced) {
					remoteById.set(synced.id, synced);
					nextDeletedIds.delete(synced.id);
					nextPendingIds.delete(synced.id);
				}
			} catch (error) {
				console.warn('Impossibile riallineare il post-it col backend ICP.', error);
			}
		}
	}

	writeDeletedIds(nextDeletedIds);
	writePendingIds(nextPendingIds);
	const merged = mergeNotes(localNotes, [...remoteById.values()], nextDeletedIds, nextPendingIds);
	syncPostItState(merged);
}

async function syncRemotePostIts() {
	if (!canSyncRemote()) {
		return;
	}

	try {
		const principal = currentPrincipal();
		const localNotes = readNotes(principal);
		const deletedIds = readDeletedIds(principal);
		const pendingIds = readPendingIds(principal);
		const remotePostIts = await fetchRemotePostIts();
		if (!remotePostIts) {
			return;
		}

		const merged = mergeNotes(localNotes, remotePostIts, deletedIds, pendingIds);
		syncPostItState(merged, principal);
		await flushPostItsToRemote(merged, remotePostIts, deletedIds, pendingIds);
	} catch (error) {
		console.warn('Impossibile sincronizzare i post-it dal backend ICP.', error);
	}
}

export function initPostIts() {
	if (!browser) {
		return Promise.resolve();
	}

	if (!authSubscriptionStarted) {
		authState.subscribe((state) => {
			if (state.principal !== lastPrincipal) {
				lastPrincipal = state.principal;
				syncPostItState(readNotes(state.principal ?? null), state.principal ?? null);
			}

			if (state.authenticated && isVaultBackendConfigured()) {
				void syncRemotePostIts();
			}
		});
		authSubscriptionStarted = true;
	}

	if (postitsInitialized) {
		return Promise.resolve();
	}

	postitsInitialized = true;
	lastPrincipal = currentPrincipal();
	postitStore.set({
		notes: readNotes(lastPrincipal),
		ready: true
	});

	return syncRemotePostIts();
}

export function addPostIt(text: string) {
	const nextText = text.trim();
	if (!nextText) {
		return false;
	}

	const current = readNotes();
	const deletedIds = readDeletedIds();
	const note: PostItNote = {
		id: crypto.randomUUID(),
		text: nextText,
		completed: false,
		color: postitColors[current.length % postitColors.length],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};

	deletedIds.delete(note.id);
	const pendingIds = readPendingIds();
	pendingIds.add(note.id);
	writeDeletedIds(deletedIds);
	writePendingIds(pendingIds);
	syncPostItState([note, ...current]);

	if (canSyncRemote()) {
		void upsertRemotePostIt({
			id: note.id,
			text: note.text,
			completed: note.completed,
			color: note.color
		})
			.then((remotePostIt) => {
				if (!remotePostIt) {
					return;
				}

				const nextPendingIds = readPendingIds();
				nextPendingIds.delete(remotePostIt.id);
				writePendingIds(nextPendingIds);
				const next = readNotes().map((item) => (item.id === note.id ? remotePostIt : item));
				syncPostItState(next);
			})
			.catch((error) => {
				console.warn('Impossibile creare il post-it sul backend ICP.', error);
			});
	}

	return true;
}

export function togglePostIt(id: string) {
	const current = readNotes();
	const next = current.map((note) =>
		note.id === id
			? {
					...note,
					completed: !note.completed,
					updatedAt: new Date().toISOString()
				}
			: note
	);

	syncPostItState(next);

	const target = next.find((note) => note.id === id);
	if (target && canSyncRemote()) {
		const pendingIds = readPendingIds();
		pendingIds.add(id);
		writePendingIds(pendingIds);
		void upsertRemotePostIt({
			id,
			text: target.text,
			completed: target.completed,
			color: target.color
		})
			.then((remotePostIt) => {
				if (!remotePostIt) {
					return;
				}

				const nextPendingIds = readPendingIds();
				nextPendingIds.delete(remotePostIt.id);
				writePendingIds(nextPendingIds);
				const merged = readNotes().map((item) => (item.id === id ? remotePostIt : item));
				syncPostItState(merged);
			})
			.catch((error) => {
				console.warn('Impossibile aggiornare il post-it sul backend ICP.', error);
			});
	}
}

export function removePostIt(id: string) {
	const principal = currentPrincipal();
	const next = readNotes(principal).filter((note) => note.id !== id);
	const deletedIds = readDeletedIds(principal);
	const pendingIds = readPendingIds(principal);
	deletedIds.add(id);
	pendingIds.delete(id);
	writeDeletedIds(deletedIds, principal);
	writePendingIds(pendingIds, principal);
	syncPostItState(next);

	if (canSyncRemote()) {
		void deleteRemotePostIt(id)
			.then(() => {
				const nextDeletedIds = readDeletedIds(principal);
				nextDeletedIds.delete(id);
				writeDeletedIds(nextDeletedIds, principal);
			})
			.catch((error) => {
				console.warn('Impossibile eliminare il post-it dal backend ICP.', error);
			});
	}
}

export const postitState = {
	subscribe: postitStore.subscribe
};
