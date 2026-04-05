import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { authState } from '$lib/auth';
import {
	fetchRemoteNotes,
	isVaultBackendConfigured,
	upsertRemoteNote,
	deleteRemoteNote
} from '$lib/ic/vaultBackend';
import { trackAnalyticsEvent } from '$lib/ic/vaultAnalytics';

export type VaultNote = {
	id: string;
	title: string;
	content: string;
	pinned: boolean;
	createdAt: string;
	updatedAt: string;
};

type NotesState = {
	notes: VaultNote[];
	ready: boolean;
};

const NOTES_STORAGE_KEY = 'fatturavault-notes';
const NOTES_DELETED_STORAGE_KEY = 'fatturavault-notes-deleted';
const NOTES_PENDING_STORAGE_KEY = 'fatturavault-notes-pending';

const notesStore = writable<NotesState>({
	notes: [],
	ready: false
});

let notesInitialized = false;
let authSubscriptionStarted = false;

function currentPrincipal() {
	return get(authState).principal ?? null;
}

function storageKeyFor(principal: string | null) {
	return principal ? `${NOTES_STORAGE_KEY}:${principal}` : NOTES_STORAGE_KEY;
}

function deletedStorageKeyFor(principal: string | null) {
	return principal ? `${NOTES_DELETED_STORAGE_KEY}:${principal}` : NOTES_DELETED_STORAGE_KEY;
}

function pendingStorageKeyFor(principal: string | null) {
	return principal ? `${NOTES_PENDING_STORAGE_KEY}:${principal}` : NOTES_PENDING_STORAGE_KEY;
}

function readNotes(principal: string | null = currentPrincipal()): VaultNote[] {
	if (!browser) {
		return [];
	}

	const raw = localStorage.getItem(storageKeyFor(principal));
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.map((note: Record<string, unknown>) => ({
			id: (note.id as string) ?? crypto.randomUUID(),
			title: (note.title as string) ?? 'Nota senza titolo',
			content: (note.content as string) ?? '',
			pinned: Boolean(note.pinned),
			createdAt: (note.createdAt as string) ?? new Date().toISOString(),
			updatedAt: (note.updatedAt as string) ?? new Date().toISOString()
		}));
	} catch {
		return [];
	}
}

function writeNotes(notes: VaultNote[], principal: string | null = currentPrincipal()) {
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

function sortNotes(notes: VaultNote[]) {
	return [...notes].sort((a, b) => {
		if (a.pinned !== b.pinned) {
			return a.pinned ? -1 : 1;
		}

		return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
	});
}

function syncNotes(notes: VaultNote[], principal: string | null = currentPrincipal()) {
	const sorted = sortNotes(notes);
	writeNotes(sorted, principal);
	notesStore.set({
		notes: sorted,
		ready: true
	});
}

function canSyncRemote() {
	const snapshot = get(authState);
	return snapshot.authenticated && Boolean(snapshot.principal) && isVaultBackendConfigured();
}

function mergeNotes(
	localNotes: VaultNote[],
	remoteNotes: VaultNote[],
	deletedIds: Set<string>,
	pendingIds: Set<string>
) {
	const merged = new Map<string, VaultNote>();

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

		const localUpdatedAt = new Date(note.updatedAt).getTime();
		const remoteUpdatedAt = new Date(current.updatedAt).getTime();
		if (Number.isNaN(remoteUpdatedAt) || localUpdatedAt >= remoteUpdatedAt) {
			merged.set(note.id, note);
		}
	}

	return sortNotes([...merged.values()]);
}

async function flushNotesToRemote(
	localNotes: VaultNote[],
	remoteNotes: VaultNote[],
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
			await deleteRemoteNote(deletedId);
			remoteById.delete(deletedId);
			nextDeletedIds.delete(deletedId);
			nextPendingIds.delete(deletedId);
		} catch (error) {
			console.warn('Impossibile eliminare la nota dal backend ICP.', error);
		}
	}

	for (const note of localNotes) {
		const remoteNote = remoteById.get(note.id);
		const localUpdatedAt = new Date(note.updatedAt).getTime();
		const remoteUpdatedAt = remoteNote
			? new Date(remoteNote.updatedAt).getTime()
			: Number.NEGATIVE_INFINITY;

		if (!remoteNote || localUpdatedAt > remoteUpdatedAt) {
			try {
				const synced = await upsertRemoteNote({
					id: note.id,
					title: note.title,
					content: note.content,
					pinned: note.pinned
				});
				if (synced) {
					remoteById.set(synced.id, synced);
					nextDeletedIds.delete(synced.id);
					nextPendingIds.delete(synced.id);
				}
			} catch (error) {
				console.warn('Impossibile riallineare la nota col backend ICP.', error);
			}
		}
	}

	writeDeletedIds(nextDeletedIds);
	writePendingIds(nextPendingIds);
	syncNotes(mergeNotes(localNotes, [...remoteById.values()], nextDeletedIds, nextPendingIds));
}

async function syncRemoteNotes() {
	if (!canSyncRemote()) {
		return;
	}

	try {
		const principal = currentPrincipal();
		const localNotes = readNotes(principal);
		const deletedIds = readDeletedIds(principal);
		const pendingIds = readPendingIds(principal);
		const remoteNotes = await fetchRemoteNotes();
		if (!remoteNotes) {
			return;
		}

		const merged = mergeNotes(localNotes, remoteNotes, deletedIds, pendingIds);
		syncNotes(merged, principal);
		await flushNotesToRemote(merged, remoteNotes, deletedIds, pendingIds);
	} catch (error) {
		console.warn('Impossibile sincronizzare le note dal backend ICP.', error);
	}
}

export function initNotes() {
	if (!browser) {
		return Promise.resolve();
	}

	if (!authSubscriptionStarted) {
		authState.subscribe((state) => {
			syncNotes(readNotes(state.principal ?? null), state.principal ?? null);
			if (state.authenticated && isVaultBackendConfigured()) {
				void syncRemoteNotes();
			}
		});
		authSubscriptionStarted = true;
	}

	if (notesInitialized) {
		return Promise.resolve();
	}

	notesInitialized = true;
	notesStore.set({
		notes: sortNotes(readNotes()),
		ready: true
	});

	return syncRemoteNotes();
}

export function createNote() {
	const now = new Date().toISOString();
	const nextNote: VaultNote = {
		id: crypto.randomUUID(),
		title: 'Nuova nota',
		content: '',
		pinned: false,
		createdAt: now,
		updatedAt: now
	};

	const deletedIds = readDeletedIds();
	const pendingIds = readPendingIds();
	deletedIds.delete(nextNote.id);
	pendingIds.add(nextNote.id);
	writeDeletedIds(deletedIds);
	writePendingIds(pendingIds);
	syncNotes([nextNote, ...readNotes()]);

	if (canSyncRemote()) {
		void upsertRemoteNote({
			id: nextNote.id,
			title: nextNote.title,
			content: nextNote.content,
			pinned: nextNote.pinned
		})
			.then((remoteNote) => {
				if (!remoteNote) {
					return;
				}

				const nextPendingIds = readPendingIds();
				nextPendingIds.delete(remoteNote.id);
				writePendingIds(nextPendingIds);
				const next = readNotes().map((note) => (note.id === nextNote.id ? remoteNote : note));
				syncNotes(next);
			})
			.catch((error) => {
				console.warn('Impossibile creare la nota sul backend ICP.', error);
			});
	}

	void trackAnalyticsEvent({
		eventType: 'note_created',
		metadata: { sourceScreen: 'note' }
	});

	return nextNote;
}

export function updateNote(id: string, updates: Partial<Pick<VaultNote, 'title' | 'content' | 'pinned'>>) {
	const currentNotes = readNotes();
	const target = currentNotes.find((note) => note.id === id);
	const next = currentNotes.map((note) =>
		note.id === id
			? {
					...note,
					...updates,
					updatedAt: new Date().toISOString()
				}
			: note
	);

	syncNotes(next);

	const nextTarget = next.find((note) => note.id === id);
	if (target && nextTarget && canSyncRemote()) {
		const pendingIds = readPendingIds();
		pendingIds.add(id);
		writePendingIds(pendingIds);
		void upsertRemoteNote({
			id,
			title: nextTarget.title,
			content: nextTarget.content,
			pinned: nextTarget.pinned
		})
			.then((remoteNote) => {
				if (!remoteNote) {
					return;
				}

				const nextPendingIds = readPendingIds();
				nextPendingIds.delete(remoteNote.id);
				writePendingIds(nextPendingIds);
				const merged = readNotes().map((note) => (note.id === id ? remoteNote : note));
				syncNotes(merged);
			})
			.catch((error) => {
				console.warn('Impossibile aggiornare la nota sul backend ICP.', error);
			});
	}
}

export function deleteNote(id: string) {
	const principal = currentPrincipal();
	const next = readNotes(principal).filter((note) => note.id !== id);
	const deletedIds = readDeletedIds(principal);
	const pendingIds = readPendingIds(principal);
	deletedIds.add(id);
	pendingIds.delete(id);
	writeDeletedIds(deletedIds, principal);
	writePendingIds(pendingIds, principal);
	syncNotes(next, principal);

	if (canSyncRemote()) {
		void deleteRemoteNote(id)
			.then(() => {
				const nextDeletedIds = readDeletedIds(principal);
				nextDeletedIds.delete(id);
				writeDeletedIds(nextDeletedIds, principal);
			})
			.catch((error) => {
				console.warn('Impossibile eliminare la nota dal backend ICP.', error);
			});
	}
}

export const notesState = {
	subscribe: notesStore.subscribe
};
