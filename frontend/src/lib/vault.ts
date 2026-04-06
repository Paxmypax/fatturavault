import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { authState } from '$lib/auth';
import type { DocumentCryptoState, InvoiceData, WarrantyData } from '$lib/types';
import {
	base64ToBytes,
	bytesToBase64,
	createRandomAesKey,
	decryptBlobWithAesGcm,
	encryptBlobWithAesGcm
} from '$lib/crypto/clientEncryption';
import {
	wrapDocumentKeyForCurrentUser,
	unwrapDocumentKeyForCurrentUser
} from '$lib/crypto/userKeyProvider';
import {
	cleanupRemoteOrphanDocuments,
	deleteRemoteDocument,
	fetchRemoteActivities,
	fetchRemoteDocuments,
	isVaultBackendConfigured,
	type RemoteVaultDocument,
	upsertRemoteDocument
} from '$lib/ic/vaultBackend';
import { trackAnalyticsEvent } from '$lib/ic/vaultAnalytics';
import {
	deleteBlob,
	downloadBlobBytes,
	isVaultStorageConfigured,
	uploadBlobForDocument
} from '$lib/ic/vaultStorage';

export type VaultDocument = {
	id: string;
	name: string;
	size: number;
	type: string;
	previewDataUrl?: string;
	fileDataUrl?: string;
	originalBlobId?: string;
	previewBlobId?: string;
	categoryId?: string;
	cryptoState?: DocumentCryptoState;
	categoryName: string;
	createdAt: string;
	updatedAt: string;
	title: string;
	status: 'inbox' | 'processed';
	remoteSyncState?: 'pending' | 'confirmed';
	documentDate?: string;
	tags: string[];
	notes?: string;
	merchantName?: string;
	amount?: number;
	paymentStatus?: 'due' | 'paid';
	hasExpiry: boolean;
	expiryDate?: string;
	expiryType?: string;
	expiryDuration?: string;
	invoiceData?: InvoiceData;
	warrantyData?: WarrantyData;
};

export type VaultActivity = {
	id: string;
	type: 'uploaded' | 'processed' | 'updated' | 'deleted';
	documentId: string;
	documentName: string;
	documentTitle?: string;
	categoryName?: string;
	at: string;
};

type VaultState = {
	ready: boolean;
	documents: VaultDocument[];
	activities: VaultActivity[];
};

type VaultAssetOperationState = {
	previewingDocumentIds: string[];
	downloadingDocumentIds: string[];
};

const VAULT_STORAGE_KEY = 'fatturavault-vault-documents';
const VAULT_ACTIVITY_KEY = 'fatturavault-vault-activities';
const VAULT_ENCRYPTED_BLOB_CACHE_KEY = 'fatturavault-vault-encrypted-blobs';
const VAULT_PENDING_MUTATIONS_KEY = 'fatturavault-vault-pending-mutations';

const vaultStore = writable<VaultState>({
	ready: false,
	documents: [],
	activities: []
});

const vaultAssetOperationStore = writable<VaultAssetOperationState>({
	previewingDocumentIds: [],
	downloadingDocumentIds: []
});

let vaultInitialized = false;
let authSubscriptionStarted = false;
let vaultRemoteRefreshHooksStarted = false;
let remoteSyncInFlight: Promise<void> | null = null;
let pendingMutationFlushInFlight: Promise<boolean> | null = null;
let remoteSyncRequestedWhileInFlight = false;
const blobObjectUrls = new Map<string, string>();
const documentPreparationPromises = new Map<string, Promise<void>>();
let inMemoryEncryptedBlobCache: EncryptedBlobCache = {};
let encryptedBlobPersistenceDisabled = false;

function setAssetOperation(kind: 'preview' | 'download', documentId: string, active: boolean) {
	vaultAssetOperationStore.update((state) => {
		const key = kind === 'preview' ? 'previewingDocumentIds' : 'downloadingDocumentIds';
		const currentIds = state[key];
		const nextIds = active
			? currentIds.includes(documentId)
				? currentIds
				: [...currentIds, documentId]
			: currentIds.filter((id) => id !== documentId);

		if (nextIds === currentIds) {
			return state;
		}

		return {
			...state,
			[key]: nextIds
		};
	});
}

type EncryptedBlobCacheEntry = {
	documentId: string;
	kind: 'original' | 'preview';
	bytesBase64: string;
	mimeType: string;
};

type EncryptedBlobCache = Record<string, EncryptedBlobCacheEntry>;

type PendingVaultMutation =
	| {
			id: string;
			type: 'upsert_document';
			documentId: string;
			document: RemoteVaultDocument;
			createdAt: string;
	  }
	| {
			id: string;
			type: 'delete_document';
			documentId: string;
			createdAt: string;
	  }
	| {
			id: string;
			type: 'delete_blob';
			documentId: string;
			blobId: string;
			createdAt: string;
	  };

function sanitizeDocumentsForPersistence(documents: VaultDocument[]) {
	return documents.map(({ previewDataUrl, fileDataUrl, ...document }) => document);
}

function writeVaultDocuments(documents: VaultDocument[]) {
	if (!browser) {
		return;
	}

	try {
		localStorage.setItem(
			VAULT_STORAGE_KEY,
			JSON.stringify(sanitizeDocumentsForPersistence(documents))
		);
	} catch (error) {
		if (
			error instanceof DOMException &&
			(error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
		) {
			console.warn(
				'Storage locale pieno: continuo senza persistere i documenti del vault in questa sessione.'
			);
			return;
		}

		throw error;
	}
}

function writeVaultActivities(activities: VaultActivity[]) {
	if (!browser) {
		return;
	}

	try {
		localStorage.setItem(VAULT_ACTIVITY_KEY, JSON.stringify(activities));
	} catch (error) {
		if (
			error instanceof DOMException &&
			(error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
		) {
			console.warn(
				'Storage locale pieno: continuo senza persistere le attivita del vault in questa sessione.'
			);
			return;
		}

		throw error;
	}
}

function readEncryptedBlobCache(): EncryptedBlobCache {
	if (!browser) {
		return {};
	}

	if (encryptedBlobPersistenceDisabled) {
		return { ...inMemoryEncryptedBlobCache };
	}

	const raw = localStorage.getItem(VAULT_ENCRYPTED_BLOB_CACHE_KEY);
	if (!raw) {
		return { ...inMemoryEncryptedBlobCache };
	}

	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object'
			? {
					...(parsed as EncryptedBlobCache),
					...inMemoryEncryptedBlobCache
				}
			: { ...inMemoryEncryptedBlobCache };
	} catch {
		return { ...inMemoryEncryptedBlobCache };
	}
}

function readPendingVaultMutations(): PendingVaultMutation[] {
	if (!browser) {
		return [];
	}

	const raw = localStorage.getItem(VAULT_PENDING_MUTATIONS_KEY);
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as PendingVaultMutation[]) : [];
	} catch {
		return [];
	}
}

function writePendingVaultMutations(queue: PendingVaultMutation[]) {
	if (!browser) {
		return;
	}

	try {
		localStorage.setItem(VAULT_PENDING_MUTATIONS_KEY, JSON.stringify(queue));
	} catch (error) {
		if (
			error instanceof DOMException &&
			(error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
		) {
			console.warn(
				'Storage locale pieno: non riesco a persistere la coda pending del vault in questa sessione.'
			);
			return;
		}

		throw error;
	}
}

function hasPendingUpsertForDocument(documentId: string) {
	if (!browser) {
		return false;
	}

	return (
		documentPreparationPromises.has(documentId) ||
		readPendingVaultMutations().some(
		(entry) => entry.documentId === documentId && entry.type === 'upsert_document'
		)
	);
}

function hasPendingRemoteDocumentSync(document: VaultDocument) {
	return (
		document.remoteSyncState === 'pending' ||
		hasPendingUpsertForDocument(document.id) ||
		Boolean(document.cryptoState?.original && !document.originalBlobId)
	);
}

function enqueuePendingVaultMutation(mutation: PendingVaultMutation) {
	if (!browser || !isVaultBackendConfigured()) {
		return;
	}

	const queue = readPendingVaultMutations();

	let nextQueue = queue;
	if (mutation.type === 'upsert_document') {
		nextQueue = queue.filter(
			(entry) =>
				!(
					entry.documentId === mutation.documentId &&
					(entry.type === 'upsert_document' || entry.type === 'delete_document')
				)
		);
	} else if (mutation.type === 'delete_document') {
		nextQueue = queue.filter(
			(entry) => !(entry.documentId === mutation.documentId && entry.type === 'upsert_document')
		);
	} else if (mutation.type === 'delete_blob') {
		nextQueue = queue.filter(
			(entry) =>
				!(entry.type === 'delete_blob' && entry.documentId === mutation.documentId && entry.blobId === mutation.blobId)
		);
	}

	nextQueue.push(mutation);
	writePendingVaultMutations(nextQueue);
	remoteSyncRequestedWhileInFlight = true;
}

function removePendingMutationsForDocument(
	documentId: string,
	types?: PendingVaultMutation['type'][]
) {
	if (!browser) {
		return;
	}

	const nextQueue = readPendingVaultMutations().filter((entry) => {
		if (entry.documentId !== documentId) {
			return true;
		}

		if (!types?.length) {
			return false;
		}

		return !types.includes(entry.type);
	});

	writePendingVaultMutations(nextQueue);
}

function isIgnorablePendingMutationError(
	mutation: PendingVaultMutation,
	error: unknown
) {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();

	if (mutation.type === 'delete_blob') {
		return message.includes('notfound') || message.includes('not found');
	}

	if (mutation.type === 'delete_document') {
		return message.includes('non trovato') || message.includes('notfound') || message.includes('not found');
	}

	return false;
}

async function flushPendingVaultMutations() {
	if (!browser || !canSyncRemote()) {
		return false;
	}

	if (pendingMutationFlushInFlight) {
		return pendingMutationFlushInFlight;
	}

	pendingMutationFlushInFlight = (async () => {
		if (!readPendingVaultMutations().length) {
			return true;
		}

		while (true) {
			const queue = readPendingVaultMutations();
			if (!queue.length) {
				return true;
			}

			const current = queue[0];

			try {
				if (current.type === 'upsert_document') {
					const remoteDocument = await upsertRemoteDocument(current.document);
					if (!remoteDocument) {
						throw new Error('Vault backend non disponibile');
					}
				} else if (current.type === 'delete_document') {
					const deleted = await deleteRemoteDocument(current.documentId);
					if (!deleted) {
						throw new Error('Vault backend non disponibile');
					}
				} else if (current.type === 'delete_blob') {
					if (canUseStorage()) {
						const deleted = await deleteBlob(current.blobId);
						if (!deleted) {
							throw new Error('Vault storage non disponibile');
						}
					}
				}
			} catch (error) {
				if (isIgnorablePendingMutationError(current, error)) {
					const latestQueue = readPendingVaultMutations();
					writePendingVaultMutations(
						latestQueue.filter(
							(entry) => !(entry.id === current.id && entry.type === current.type)
						)
					);
					continue;
				}

				console.warn('Impossibile completare una mutazione pendente del vault.', error);
				return false;
			}

			const latestQueue = readPendingVaultMutations();
			if (current.type === 'upsert_document') {
				persistSilentDocumentUpdate(current.documentId, { remoteSyncState: 'confirmed' });
			}
			if (
				latestQueue[0] &&
				latestQueue[0].id === current.id &&
				latestQueue[0].type === current.type
			) {
				writePendingVaultMutations(latestQueue.slice(1));
				continue;
			}

			writePendingVaultMutations(
				latestQueue.filter(
					(entry) => !(entry.id === current.id && entry.type === current.type)
				)
			);
		}
	})()
		.finally(() => {
			pendingMutationFlushInFlight = null;
		});

	return pendingMutationFlushInFlight;
}

function writeEncryptedBlobCache(cache: EncryptedBlobCache) {
	if (!browser) {
		return;
	}

	inMemoryEncryptedBlobCache = { ...cache };

	if (encryptedBlobPersistenceDisabled) {
		return;
	}

	try {
		localStorage.setItem(VAULT_ENCRYPTED_BLOB_CACHE_KEY, JSON.stringify(cache));
	} catch (error) {
		if (
			error instanceof DOMException &&
			(error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
		) {
			encryptedBlobPersistenceDisabled = true;
			console.warn(
				'Cache persistente dei blob cifrati piena: da ora uso solo la cache in memoria per questa sessione.'
			);
			try {
				localStorage.removeItem(VAULT_ENCRYPTED_BLOB_CACHE_KEY);
			} catch {
				// ignore cleanup failures
			}
			return;
		}

		throw error;
	}
}

function encryptedBlobCacheKey(documentId: string, kind: 'original' | 'preview') {
	return `${documentId}:${kind}`;
}

function cacheEncryptedBlob(input: {
	documentId: string;
	kind: 'original' | 'preview';
	bytes: Uint8Array;
	mimeType: string;
}) {
	if (!browser) {
		return;
	}

	const cache = readEncryptedBlobCache();
	cache[encryptedBlobCacheKey(input.documentId, input.kind)] = {
		documentId: input.documentId,
		kind: input.kind,
		bytesBase64: bytesToBase64(input.bytes),
		mimeType: input.mimeType
	};
	writeEncryptedBlobCache(cache);
}

function getCachedEncryptedBlob(documentId: string, kind: 'original' | 'preview') {
	if (!browser) {
		return null;
	}

	const entry = readEncryptedBlobCache()[encryptedBlobCacheKey(documentId, kind)];
	if (!entry) {
		return null;
	}

	return {
		bytes: base64ToBytes(entry.bytesBase64),
		mimeType: entry.mimeType
	};
}

function removeCachedEncryptedBlobs(documentId: string) {
	if (!browser) {
		return;
	}

	const cache = readEncryptedBlobCache();
	delete cache[encryptedBlobCacheKey(documentId, 'original')];
	delete cache[encryptedBlobCacheKey(documentId, 'preview')];
	writeEncryptedBlobCache(cache);
}

function syncVaultState(documents: VaultDocument[], activities: VaultActivity[]) {
	writeVaultDocuments(documents);
	writeVaultActivities(activities);
	vaultStore.set({
		ready: true,
		documents,
		activities
	});
}

function detectDocumentKind(document: Pick<VaultDocument, 'invoiceData' | 'warrantyData' | 'categoryName'>) {
	if (document.warrantyData || document.categoryName === 'Garanzia') {
		return 'warranty';
	}

	if (document.invoiceData || document.categoryName === 'Fattura') {
		return 'invoice';
	}

	if (document.categoryName === 'Ricevuta') {
		return 'receipt';
	}

	return 'generic';
}

function migrateDocument(doc: Record<string, unknown>): VaultDocument {
	const fallback = {
		id: (doc.id as string) ?? crypto.randomUUID(),
		name: (doc.name as string) ?? 'Documento',
		size: (doc.size as number) ?? 0,
		type: (doc.type as string) ?? '',
		previewDataUrl: doc.previewDataUrl as string | undefined,
		fileDataUrl: doc.fileDataUrl as string | undefined,
		originalBlobId: doc.originalBlobId as string | undefined,
		previewBlobId: doc.previewBlobId as string | undefined,
		categoryId: doc.categoryId as string | undefined,
		cryptoState: doc.cryptoState as DocumentCryptoState | undefined,
		categoryName: (doc.categoryName as string) ?? 'Altro',
		createdAt: (doc.createdAt as string) ?? new Date().toISOString(),
		updatedAt: (doc.updatedAt as string) ?? new Date().toISOString()
	};

	return {
		...fallback,
		title: (doc.title as string) ?? fallback.name,
		status: ((doc.status as string) === 'processed' ? 'processed' : 'inbox') as 'inbox' | 'processed',
		remoteSyncState:
			doc.remoteSyncState === 'pending' || doc.remoteSyncState === 'confirmed'
				? (doc.remoteSyncState as 'pending' | 'confirmed')
				: 'confirmed',
		documentDate: doc.documentDate as string | undefined,
		tags: Array.isArray(doc.tags) ? (doc.tags as string[]) : [],
		notes: doc.notes as string | undefined,
		merchantName: doc.merchantName as string | undefined,
		amount: typeof doc.amount === 'number' ? (doc.amount as number) : undefined,
		paymentStatus: (doc.paymentStatus as 'due' | 'paid' | undefined) ?? 'paid',
		hasExpiry: (doc.hasExpiry as boolean) ?? false,
		expiryDate: doc.expiryDate as string | undefined,
		expiryType: doc.expiryType as string | undefined,
		expiryDuration: doc.expiryDuration as string | undefined,
		invoiceData: doc.invoiceData as InvoiceData | undefined,
		warrantyData: doc.warrantyData as WarrantyData | undefined
	};
}

function readVaultDocuments(): VaultDocument[] {
	if (!browser) {
		return [];
	}

	const raw = localStorage.getItem(VAULT_STORAGE_KEY);
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.map((doc: Record<string, unknown>) => migrateDocument(doc));
	} catch {
		return [];
	}
}

function migrateActivity(activity: Record<string, unknown>): VaultActivity {
	return {
		id: (activity.id as string) ?? crypto.randomUUID(),
		type: (activity.type as VaultActivity['type']) ?? 'updated',
		documentId: (activity.documentId as string) ?? '',
		documentName: (activity.documentName as string) ?? 'Documento',
		documentTitle: activity.documentTitle as string | undefined,
		categoryName: activity.categoryName as string | undefined,
		at: (activity.at as string) ?? new Date().toISOString()
	};
}

function readVaultActivities(): VaultActivity[] {
	if (!browser) {
		return [];
	}

	const raw = localStorage.getItem(VAULT_ACTIVITY_KEY);
	if (!raw) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.map((activity: Record<string, unknown>) => migrateActivity(activity));
	} catch {
		return [];
	}
}

function getCurrentVaultDocuments() {
	const state = get(vaultStore);
	if (state.ready) {
		return state.documents;
	}

	return readVaultDocuments();
}

function getCurrentVaultActivities() {
	const state = get(vaultStore);
	if (state.ready) {
		return state.activities;
	}

	return readVaultActivities();
}

function canSyncRemote() {
	const snapshot = get(authState);
	return snapshot.authenticated && Boolean(snapshot.principal) && isVaultBackendConfigured();
}

function canUseStorage() {
	const snapshot = get(authState);
	return snapshot.authenticated && Boolean(snapshot.principal) && isVaultStorageConfigured();
}

function wasDocumentUpdatedRecently(document: Pick<VaultDocument, 'updatedAt'>) {
	const updatedAt = new Date(document.updatedAt).getTime();
	if (Number.isNaN(updatedAt)) {
		return false;
	}

	return Date.now() - updatedAt < 5 * 60 * 1000;
}

function mergeRemoteWithLocal(
	remoteDocuments: RemoteVaultDocument[],
	localDocuments: VaultDocument[]
): VaultDocument[] {
	const localById = new Map(localDocuments.map((document) => [document.id, document]));
	const mergedDocuments: VaultDocument[] = remoteDocuments.map((document) => {
		const localDocument = localById.get(document.id);
		const shouldPreferLocalState = localDocument
			? hasPendingRemoteDocumentSync(localDocument) || wasDocumentUpdatedRecently(localDocument)
			: false;

		if (localDocument && shouldPreferLocalState) {
			return {
				...document,
				title: localDocument.title,
				status: localDocument.status,
				categoryName: localDocument.categoryName,
				categoryId: localDocument.categoryId,
				updatedAt: localDocument.updatedAt,
				documentDate: localDocument.documentDate,
				tags: localDocument.tags,
				notes: localDocument.notes,
				merchantName: localDocument.merchantName,
				amount: localDocument.amount,
				paymentStatus: localDocument.paymentStatus,
				hasExpiry: localDocument.hasExpiry,
				expiryDate: localDocument.expiryDate,
				expiryType: localDocument.expiryType,
				expiryDuration: localDocument.expiryDuration,
				invoiceData: localDocument.invoiceData,
				warrantyData: localDocument.warrantyData,
				originalBlobId: localDocument.originalBlobId ?? document.originalBlobId,
				previewBlobId: localDocument.previewBlobId ?? document.previewBlobId,
				remoteSyncState: hasPendingRemoteDocumentSync(localDocument) ? 'pending' : 'confirmed',
				previewDataUrl: localDocument.previewDataUrl,
				fileDataUrl: localDocument.fileDataUrl,
				cryptoState: localDocument.cryptoState ?? document.cryptoState
			} satisfies VaultDocument;
		}

		return {
			...document,
			remoteSyncState: 'confirmed',
			previewDataUrl: localDocument?.previewDataUrl,
			fileDataUrl: localDocument?.fileDataUrl,
			cryptoState: localDocument?.cryptoState ?? document.cryptoState
		} satisfies VaultDocument;
	});

	for (const localDocument of localDocuments) {
		if (mergedDocuments.some((document) => document.id === localDocument.id)) {
			continue;
		}

		if (
			!hasPendingRemoteDocumentSync(localDocument) &&
			!wasDocumentUpdatedRecently(localDocument)
		) {
			continue;
		}

		mergedDocuments.push(localDocument);
	}

	mergedDocuments.sort(
		(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
	);

	return mergedDocuments;
}

function rememberBlobUrl(cacheKey: string, url: string) {
	const previous = blobObjectUrls.get(cacheKey);
	if (previous) {
		URL.revokeObjectURL(previous);
	}
	blobObjectUrls.set(cacheKey, url);
}

function revokeDocumentBlobUrls(documentId: string) {
	for (const suffix of ['preview', 'original']) {
		const cacheKey = `${documentId}:${suffix}`;
		const existing = blobObjectUrls.get(cacheKey);
		if (existing) {
			URL.revokeObjectURL(existing);
			blobObjectUrls.delete(cacheKey);
		}
	}
}

function bytesToArrayBuffer(bytes: Uint8Array) {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function createClientId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

async function createImagePreviewBlob(file: File) {
	if (!browser || !file.type.startsWith('image/') || typeof document === 'undefined') {
		return null;
	}

	const sourceUrl = URL.createObjectURL(file);

	try {
		const image = await new Promise<HTMLImageElement>((resolve, reject) => {
			const nextImage = new Image();
			nextImage.onload = () => resolve(nextImage);
			nextImage.onerror = () => reject(new Error('Preview image load failed'));
			nextImage.src = sourceUrl;
		});

		const maxSide = 1600;
		const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
		const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
		const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;

		const context = canvas.getContext('2d');
		if (!context) {
			return null;
		}

		context.drawImage(image, 0, 0, width, height);

		return await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(
				(blob) => resolve(blob),
				file.type === 'image/png' ? 'image/png' : 'image/jpeg',
				0.9
			);
		});
	} catch {
		return null;
	} finally {
		URL.revokeObjectURL(sourceUrl);
	}
}

function trackDocumentPreparation(documentId: string, preparation: Promise<void>) {
	documentPreparationPromises.set(documentId, preparation);
	preparation.finally(() => {
		if (documentPreparationPromises.get(documentId) === preparation) {
			documentPreparationPromises.delete(documentId);
		}
	});
}

export async function waitForVaultDocumentPreparation(documentId: string) {
	const pendingPreparation = documentPreparationPromises.get(documentId);
	if (!pendingPreparation) {
		return;
	}

	try {
		await pendingPreparation;
	} catch (error) {
		console.warn('Preparazione documento non completata correttamente.', error);
	}
}

function updateDocumentAssets(
	documentId: string,
	assets: Partial<Pick<VaultDocument, 'previewDataUrl' | 'fileDataUrl'>>
) {
	vaultStore.update((state) => {
		const documents = state.documents.map((document) =>
			document.id === documentId
				? {
						...document,
						...assets
					}
				: document
		);

		writeVaultDocuments(documents);

		return {
			...state,
			documents
		};
	});
}

function persistSilentDocumentUpdate(documentId: string, updates: Partial<VaultDocument>) {
	const documents = getCurrentVaultDocuments();
	const currentDocument = documents.find((document) => document.id === documentId);
	if (!currentDocument) {
		return null;
	}

	const nextDocuments = documents.map((document) =>
		document.id === documentId
			? {
					...document,
					...updates,
					updatedAt: updates.updatedAt ?? document.updatedAt
				}
			: document
	);

	syncVaultState(nextDocuments, getCurrentVaultActivities());
	return nextDocuments.find((document) => document.id === documentId) ?? null;
}

async function uploadStorageBackedBlobs(document: VaultDocument, file: File) {
	if (!canUseStorage()) {
		return document;
	}

	const documentKey = await createRandomAesKey();
	const encryptedOriginal = await encryptBlobWithAesGcm(file, documentKey);
	const encryptedOriginalBytes = new Uint8Array(await encryptedOriginal.ciphertextBlob.arrayBuffer());
	const wrappedDocumentKey = await wrapDocumentKeyForCurrentUser(documentKey);
	const cryptoState: DocumentCryptoState = {
		scheme: 'client-aes-gcm-v1',
		keyWrapping: wrappedDocumentKey.keyWrapping,
		wrappedDocumentKeyBase64: wrappedDocumentKey.wrappedDocumentKeyBase64,
		wrappingIvBase64: wrappedDocumentKey.wrappingIvBase64,
		original: encryptedOriginal.metadata
	};

	cacheEncryptedBlob({
		documentId: document.id,
		kind: 'original',
		bytes: encryptedOriginalBytes,
		mimeType: 'application/octet-stream'
	});

	try {
		const originalBlobId = await uploadBlobForDocument({
			documentId: document.id,
			kind: 'original',
			mimeType: 'application/octet-stream',
			blob: encryptedOriginal.ciphertextBlob
		});

		let previewBlobId: string | undefined;
		const previewBlob = await createImagePreviewBlob(file);
		if (previewBlob) {
			const encryptedPreview = await encryptBlobWithAesGcm(previewBlob, documentKey);
			const encryptedPreviewBytes = new Uint8Array(
				await encryptedPreview.ciphertextBlob.arrayBuffer()
			);

			cacheEncryptedBlob({
				documentId: document.id,
				kind: 'preview',
				bytes: encryptedPreviewBytes,
				mimeType: 'application/octet-stream'
			});

			cryptoState.preview = encryptedPreview.metadata;
			previewBlobId =
				(await uploadBlobForDocument({
					documentId: document.id,
					kind: 'preview',
					mimeType: 'application/octet-stream',
					blob: encryptedPreview.ciphertextBlob
				})) ?? undefined;
		}

		return {
			...document,
			originalBlobId: originalBlobId ?? undefined,
			previewBlobId,
			cryptoState
		};
	} catch (error) {
		console.warn('Impossibile caricare i blob nel vault_storage.', error);
		return {
			...document,
			cryptoState
		};
	}
}

async function trySyncCachedDocumentBlob(document: VaultDocument) {
	if (!canUseStorage() || document.originalBlobId || !document.cryptoState?.original) {
		return document;
	}

	const cachedOriginal = getCachedEncryptedBlob(document.id, 'original');
	if (!cachedOriginal) {
		return document;
	}

	try {
		const originalBlobId = await uploadBlobForDocument({
			documentId: document.id,
			kind: 'original',
			mimeType: cachedOriginal.mimeType || 'application/octet-stream',
			blob: new Blob([bytesToArrayBuffer(cachedOriginal.bytes)], {
				type: cachedOriginal.mimeType || 'application/octet-stream'
			})
		});

		if (!originalBlobId) {
			return document;
		}

		const nextDocument = {
			...document,
			originalBlobId
		};

		persistSilentDocumentUpdate(document.id, { originalBlobId });
		await upsertRemoteDocument(toRemoteDocument(nextDocument));
		return nextDocument;
	} catch (error) {
		console.warn('Impossibile sincronizzare il blob cifrato dalla cache locale.', error);
		return document;
	}
}

export async function ensureVaultDocumentAssets(
	documentId: string,
	options: { includeOriginal?: boolean; operation?: 'preview' | 'download' } = {}
) {
	if (!browser) {
		return null;
	}

	const document = getVaultDocumentById(documentId);
	if (!document) {
		return null;
	}

	const hasCachedOriginal = Boolean(getCachedEncryptedBlob(document.id, 'original'));
	const hasCachedPreview = Boolean(getCachedEncryptedBlob(document.id, 'preview'));
	const shouldLoadPreview =
		!document.previewDataUrl &&
		(document.previewBlobId || document.originalBlobId || hasCachedPreview || hasCachedOriginal);
	const shouldLoadOriginal =
		Boolean(options.includeOriginal) &&
		!document.fileDataUrl &&
		(document.originalBlobId || hasCachedOriginal);

	if (!shouldLoadPreview && !shouldLoadOriginal) {
		return document;
	}

	const operation = options.operation ?? (options.includeOriginal ? 'download' : 'preview');
	setAssetOperation(operation, documentId, true);

	try {
		const nextAssets: Partial<Pick<VaultDocument, 'previewDataUrl' | 'fileDataUrl'>> = {};
		let currentDocument = document;
		const documentKey = currentDocument.cryptoState?.original
			? await unwrapDocumentKeyForCurrentUser(currentDocument.cryptoState)
			: null;

		if (shouldLoadPreview) {
			const blobId = currentDocument.previewBlobId || currentDocument.originalBlobId;
			const previewMetadata =
				currentDocument.previewBlobId && blobId === currentDocument.previewBlobId
					? currentDocument.cryptoState?.preview ?? currentDocument.cryptoState?.original
					: currentDocument.cryptoState?.original;
			let previewBytes: Uint8Array | null = null;
			let previewMimeType = 'application/octet-stream';

			if (blobId) {
				const preview = await downloadBlobBytes(blobId);
				if (preview) {
					previewBytes = preview.bytes;
					previewMimeType = preview.mimeType || previewMimeType;
					cacheEncryptedBlob({
						documentId: currentDocument.id,
						kind:
							currentDocument.previewBlobId && blobId === currentDocument.previewBlobId
								? 'preview'
								: 'original',
						bytes: preview.bytes,
						mimeType: previewMimeType
					});
				}
			}

			if (!previewBytes) {
				const cachedPreview =
					getCachedEncryptedBlob(currentDocument.id, 'preview') ??
					getCachedEncryptedBlob(currentDocument.id, 'original');
				if (cachedPreview) {
					previewBytes = cachedPreview.bytes;
					previewMimeType = cachedPreview.mimeType || previewMimeType;
				}
			}

			if (previewBytes && documentKey && previewMetadata) {
				const previewBlob = await decryptBlobWithAesGcm(
					new Blob([bytesToArrayBuffer(previewBytes)], { type: previewMimeType }),
					documentKey,
					previewMetadata,
					currentDocument.type || 'application/octet-stream'
				);
				const previewUrl = URL.createObjectURL(previewBlob);
				rememberBlobUrl(`${currentDocument.id}:preview`, previewUrl);
				nextAssets.previewDataUrl = previewUrl;
			}
		}

		if (shouldLoadOriginal) {
			let originalBytes: Uint8Array | null = null;
			let originalMimeType = 'application/octet-stream';
			if (currentDocument.originalBlobId) {
				const original = await downloadBlobBytes(currentDocument.originalBlobId);
				if (original) {
					originalBytes = original.bytes;
					originalMimeType = original.mimeType || originalMimeType;
					cacheEncryptedBlob({
						documentId: currentDocument.id,
						kind: 'original',
						bytes: original.bytes,
						mimeType: originalMimeType
					});
				}
			}

			if (!originalBytes) {
				const cachedOriginal = getCachedEncryptedBlob(currentDocument.id, 'original');
				if (cachedOriginal) {
					originalBytes = cachedOriginal.bytes;
					originalMimeType = cachedOriginal.mimeType || originalMimeType;
				}
			}

			if (originalBytes && documentKey && currentDocument.cryptoState?.original) {
				const originalBlob = await decryptBlobWithAesGcm(
					new Blob([bytesToArrayBuffer(originalBytes)], { type: originalMimeType }),
					documentKey,
					currentDocument.cryptoState.original,
					currentDocument.type || 'application/octet-stream'
				);

				const originalUrl = URL.createObjectURL(originalBlob);
				rememberBlobUrl(`${currentDocument.id}:original`, originalUrl);
				nextAssets.fileDataUrl = originalUrl;
			}
		}

		if (Object.keys(nextAssets).length) {
			updateDocumentAssets(currentDocument.id, nextAssets);
		}

		return getVaultDocumentById(documentId);
	} catch (error) {
		console.warn('Impossibile scaricare i blob del documento dal vault_storage.', error);
		return document;
	} finally {
		setAssetOperation(operation, documentId, false);
	}
}

function toRemoteDocument(document: VaultDocument): RemoteVaultDocument {
	return {
		id: document.id,
		name: document.name,
		size: document.size,
		type: document.type,
		originalBlobId: document.originalBlobId,
		previewBlobId: document.previewBlobId,
		categoryId: document.categoryId,
		cryptoState: document.cryptoState,
		categoryName: document.categoryName,
		title: document.title,
		status: document.status,
		documentDate: document.documentDate,
		tags: document.tags,
		notes: document.notes,
		merchantName: document.merchantName,
		amount: document.amount,
		paymentStatus: document.paymentStatus ?? 'paid',
		hasExpiry: document.hasExpiry,
		expiryDate: document.expiryDate,
		expiryType: document.expiryType,
		expiryDuration: document.expiryDuration,
		invoiceData: document.invoiceData,
		warrantyData: document.warrantyData,
		createdAt: document.createdAt,
		updatedAt: document.updatedAt
	};
}

async function syncRemoteVault() {
	if (!canSyncRemote()) {
		return;
	}

	if (remoteSyncInFlight) {
		remoteSyncRequestedWhileInFlight = true;
		return remoteSyncInFlight;
	}

	remoteSyncInFlight = (async () => {
		remoteSyncRequestedWhileInFlight = false;

		try {
			const mutationsFlushed = await flushPendingVaultMutations();
			if (!mutationsFlushed) {
				return;
			}

			await cleanupRemoteOrphanDocuments();

			if (canUseStorage()) {
				for (const document of getCurrentVaultDocuments()) {
					if (!document.originalBlobId && document.cryptoState?.original) {
						await trySyncCachedDocumentBlob(document);
					}
				}
			}

			const [remoteDocuments, remoteActivities] = await Promise.all([
				fetchRemoteDocuments(),
				fetchRemoteActivities(30)
			]);

			if (!remoteDocuments || !remoteActivities) {
				return;
			}

			const persistedDocuments = readVaultDocuments();
			const inMemoryDocuments = get(vaultStore).documents;
			const mergedDocuments = mergeRemoteWithLocal(remoteDocuments, [
				...inMemoryDocuments,
				...persistedDocuments.filter(
					(document) => !inMemoryDocuments.some((current) => current.id === document.id)
				)
			]);
			syncVaultState(mergedDocuments, remoteActivities);
		} catch (error) {
			console.warn('Impossibile sincronizzare il vault dal backend ICP.', error);
		} finally {
			remoteSyncInFlight = null;
		}
	})();

	await remoteSyncInFlight;

	if (
		canSyncRemote() &&
		(remoteSyncRequestedWhileInFlight || readPendingVaultMutations().length > 0)
	) {
		return syncRemoteVault();
	}

	return remoteSyncInFlight;
}

export const vaultState = {
	subscribe: vaultStore.subscribe
};

export const vaultAssetOperationState = {
	subscribe: vaultAssetOperationStore.subscribe
};

export function initVault() {
	if (!browser) {
		return Promise.resolve();
	}

	const currentState = get(vaultStore);

	if (!authSubscriptionStarted) {
		authState.subscribe((state) => {
			if (state.authenticated && isVaultBackendConfigured()) {
				void syncRemoteVault();
			}
		});
		authSubscriptionStarted = true;
	}

	if (!vaultRemoteRefreshHooksStarted) {
		const requestRemoteRefresh = () => {
			if (!browser || document.visibilityState === 'hidden') {
				return;
			}

			if (canSyncRemote()) {
				void syncRemoteVault();
			}
		};

		window.addEventListener('focus', requestRemoteRefresh);
		document.addEventListener('visibilitychange', requestRemoteRefresh);
		window.setInterval(requestRemoteRefresh, 12000);
		vaultRemoteRefreshHooksStarted = true;
	}

	if (vaultInitialized) {
		return syncRemoteVault();
	}

	vaultInitialized = true;

	if (currentState.ready) {
		return syncRemoteVault();
	}

	const documents = readVaultDocuments();
	const activities = readVaultActivities();
	writeVaultDocuments(documents);
	vaultStore.set({
		ready: true,
		documents,
		activities
	});

	return syncRemoteVault();
}

function createLocalObjectUrl(file: File) {
	try {
		return URL.createObjectURL(file);
	} catch {
		return undefined;
	}
}

function isMobileDownloadFallbackNeeded() {
	if (!browser) {
		return false;
	}

	const userAgent = navigator.userAgent || '';
	return /iPhone|iPad|iPod|Android/i.test(userAgent);
}

async function downloadUrlAsFile(url: string, name: string, mimeType?: string) {
	const response = await fetch(url);
	const blob = await response.blob();
	return new File([blob], name, {
		type: blob.type || mimeType || 'application/octet-stream'
	});
}

export async function addVaultDocuments(files: File[]) {
	if (!browser || !files.length) {
		return;
	}

	const currentDocuments = getCurrentVaultDocuments();
	const currentActivities = getCurrentVaultActivities();
	const now = new Date().toISOString();
	const preparedDocuments: VaultDocument[] = files.map((file) => {
		const id = createClientId();
		const fileDataUrl = createLocalObjectUrl(file);
		const previewDataUrl = file.type.startsWith('image/') ? fileDataUrl : undefined;

		if (fileDataUrl) {
			rememberBlobUrl(`${id}:original`, fileDataUrl);
		}

		if (previewDataUrl) {
			rememberBlobUrl(`${id}:preview`, previewDataUrl);
		}

		return {
			id,
			name: file.name,
			size: file.size,
			type: file.type,
			previewDataUrl,
			fileDataUrl,
			categoryName: 'Altro',
			createdAt: now,
			updatedAt: now,
			title: file.name,
			status: 'inbox' as const,
			remoteSyncState: 'pending' as const,
			tags: [] as string[],
			paymentStatus: 'paid' as const,
			hasExpiry: false
		} satisfies VaultDocument;
	});
	const nextDocuments = [...preparedDocuments, ...currentDocuments];
	const nextActivities: VaultActivity[] = [
		...preparedDocuments.map((document) => ({
			id: createClientId(),
			type: 'uploaded' as const,
			documentId: document.id,
			documentName: document.name,
			documentTitle: document.title,
			categoryName: document.categoryName,
			at: new Date().toISOString()
		})),
		...currentActivities
	].slice(0, 30);

	syncVaultState(nextDocuments, nextActivities);

	if (canSyncRemote()) {
		for (const document of preparedDocuments) {
			enqueuePendingVaultMutation({
				id: createClientId(),
				type: 'upsert_document',
				documentId: document.id,
				document: toRemoteDocument(document),
				createdAt: new Date().toISOString()
			});
		}
		void syncRemoteVault();
	}

	for (const document of preparedDocuments) {
		void trackAnalyticsEvent({
			eventType: 'document_uploaded',
			metadata: {
				sourceScreen: 'inbox',
				documentKind: detectDocumentKind(document),
				categoryId: document.categoryId
			}
		});
	}

	for (const [index, file] of files.entries()) {
		const baseDocument: VaultDocument = preparedDocuments[index];
		const preparation = (async () => {
			const storageBackedDocument = await uploadStorageBackedBlobs(baseDocument, file);
			const hasStorageUpdates =
				storageBackedDocument.originalBlobId !== baseDocument.originalBlobId ||
				storageBackedDocument.previewBlobId !== baseDocument.previewBlobId ||
				JSON.stringify(storageBackedDocument.cryptoState) !== JSON.stringify(baseDocument.cryptoState);

			if (!hasStorageUpdates) {
				return;
			}

			const updatedDocument = persistSilentDocumentUpdate(baseDocument.id, {
				originalBlobId: storageBackedDocument.originalBlobId,
				previewBlobId: storageBackedDocument.previewBlobId,
				cryptoState: storageBackedDocument.cryptoState,
				remoteSyncState: 'pending'
			});

			if (updatedDocument && updatedDocument.originalBlobId && canSyncRemote()) {
				enqueuePendingVaultMutation({
					id: createClientId(),
					type: 'upsert_document',
					documentId: updatedDocument.id,
					document: toRemoteDocument(updatedDocument),
					createdAt: new Date().toISOString()
				});
				void syncRemoteVault();
			}
		})().catch((error) => {
			console.warn('Impossibile completare la sincronizzazione storage del documento.', error);
		});
		trackDocumentPreparation(baseDocument.id, preparation);
	}

	return preparedDocuments;
}


export function getVaultDocumentById(id: string) {
	if (!browser || !id) {
		return null;
	}

	const state = get(vaultStore);
	const fromState = state.documents.find((document) => document.id === id);
	if (fromState) {
		return fromState;
	}

	return readVaultDocuments().find((document) => document.id === id) ?? null;
}

export function updateVaultDocument(id: string, updates: Partial<VaultDocument>) {
	if (!browser || !id) {
		return;
	}

	const documents = getCurrentVaultDocuments();
	const currentDocument = documents.find((document) => document.id === id);
	if (!currentDocument) {
		return;
	}

	const nextDocuments = documents.map((document) =>
		document.id === id
			? {
					...document,
					...updates,
					remoteSyncState: 'pending' as const,
					updatedAt: new Date().toISOString()
				}
			: document
	);

	const nextDocument = nextDocuments.find((document) => document.id === id) ?? currentDocument;
	const currentActivities = getCurrentVaultActivities();
	const becameProcessed =
		currentDocument.status !== 'processed' && nextDocument.status === 'processed';
	const nextActivities: VaultActivity[] = [
		{
			id: crypto.randomUUID(),
			type: becameProcessed ? ('processed' as const) : ('updated' as const),
			documentId: nextDocument.id,
			documentName: nextDocument.name,
			documentTitle: nextDocument.title,
			categoryName: nextDocument.categoryName,
			at: new Date().toISOString()
		},
		...currentActivities
	].slice(0, 30);

	syncVaultState(nextDocuments, nextActivities);

	if (canSyncRemote()) {
		enqueuePendingVaultMutation({
			id: crypto.randomUUID(),
			type: 'upsert_document',
			documentId: nextDocument.id,
			document: toRemoteDocument(nextDocument),
			createdAt: new Date().toISOString()
		});
		void syncRemoteVault();
	}

	if (becameProcessed) {
		void trackAnalyticsEvent({
			eventType: 'document_archived',
			metadata: {
				sourceScreen: 'documento',
				documentKind: detectDocumentKind(nextDocument),
				categoryId: nextDocument.categoryId
			}
		});
	}
}

export async function updateVaultDocumentAndSync(id: string, updates: Partial<VaultDocument>) {
	updateVaultDocument(id, updates);

	if (!browser) {
		return getVaultDocumentById(id);
	}

	if (canSyncRemote()) {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			await syncRemoteVault();
			const pendingMutation = readPendingVaultMutations().find(
				(entry) => entry.documentId === id && entry.type !== 'delete_blob'
			);
			if (!pendingMutation) {
				break;
			}
		}
	}

	return getVaultDocumentById(id);
}

export async function forceSyncVaultDocument(id: string) {
	if (!browser || !id) {
		return getVaultDocumentById(id);
	}

	if (!canSyncRemote()) {
		throw new Error('La sessione non è pronta per sincronizzare il documento sul vault.');
	}

	let document = getVaultDocumentById(id);
	if (!document) {
		return null;
	}

	if (canUseStorage() && !document.originalBlobId && document.cryptoState?.original) {
		document = await trySyncCachedDocumentBlob(document);
	}

	for (let attempt = 0; attempt < 3; attempt += 1) {
		const remoteDocument = await upsertRemoteDocument(toRemoteDocument(document));
		if (!remoteDocument) {
			if (attempt === 2) {
				throw new Error('Il backend non ha confermato il salvataggio del documento.');
			}
			continue;
		}

		removePendingMutationsForDocument(id, ['upsert_document']);

		const currentDocuments = getCurrentVaultDocuments();
		const currentActivities = getCurrentVaultActivities();
		const localDocument = currentDocuments.find((entry) => entry.id === id);
		const mergedDocument: VaultDocument = {
			...remoteDocument,
			remoteSyncState: 'confirmed',
			previewDataUrl: localDocument?.previewDataUrl,
			fileDataUrl: localDocument?.fileDataUrl,
			cryptoState: localDocument?.cryptoState ?? remoteDocument.cryptoState
		};

		const nextDocuments = currentDocuments.map((entry) =>
			entry.id === id ? mergedDocument : entry
		);
		syncVaultState(nextDocuments, currentActivities);

		const matchesRequestedState =
			remoteDocument.status === document.status &&
			remoteDocument.categoryName === document.categoryName &&
			remoteDocument.title === document.title;

		if (matchesRequestedState) {
			void syncRemoteVault();
			return getVaultDocumentById(id);
		}

		void syncRemoteVault();
		document = getVaultDocumentById(id) ?? mergedDocument;
	}

	throw new Error(
		'Il vault remoto non ha confermato il documento archiviato. Riprova tra qualche secondo.'
	);
}

export function setVaultDocumentCategory(id: string, categoryName: string) {
	if (!browser || !id || !categoryName) {
		return;
	}

	updateVaultDocument(id, { categoryName });
}

export function replaceVaultCategory(oldName: string, nextName: string) {
	if (!browser || !oldName || !nextName || oldName === nextName) {
		return;
	}

	const documents = getCurrentVaultDocuments();
	const nextDocuments = documents.map((document) =>
		document.categoryName === oldName
			? {
					...document,
					categoryName: nextName,
					updatedAt: new Date().toISOString()
				}
			: document
	);

	syncVaultState(nextDocuments, getCurrentVaultActivities());

	if (canSyncRemote()) {
		const affected = nextDocuments.filter((document) => document.categoryName === nextName);
		for (const document of affected) {
			enqueuePendingVaultMutation({
				id: crypto.randomUUID(),
				type: 'upsert_document',
				documentId: document.id,
				document: toRemoteDocument(document),
				createdAt: new Date().toISOString()
			});
		}
		void syncRemoteVault();
	}
}

export function removeVaultDocument(id: string) {
	if (!browser || !id) {
		return;
	}

	const documents = getCurrentVaultDocuments();
	const documentToRemove = documents.find((document) => document.id === id);
	const nextDocuments = documents.filter((document) => document.id !== id);
	const currentActivities = getCurrentVaultActivities();

	if (documentToRemove) {
		revokeDocumentBlobUrls(documentToRemove.id);
		removeCachedEncryptedBlobs(documentToRemove.id);
		const nextActivities: VaultActivity[] = [
			{
				id: crypto.randomUUID(),
				type: 'deleted' as const,
				documentId: documentToRemove.id,
				documentName: documentToRemove.name,
				documentTitle: documentToRemove.title,
				categoryName: documentToRemove.categoryName,
				at: new Date().toISOString()
			},
			...currentActivities
		].slice(0, 30);
		syncVaultState(nextDocuments, nextActivities);
	} else {
		syncVaultState(nextDocuments, currentActivities);
	}

	if (canSyncRemote()) {
		if (documentToRemove) {
			const blobIds = [
				documentToRemove.originalBlobId,
				documentToRemove.previewBlobId
			].filter(Boolean) as string[];
			for (const blobId of [...new Set(blobIds)]) {
				enqueuePendingVaultMutation({
					id: crypto.randomUUID(),
					type: 'delete_blob',
					documentId: documentToRemove.id,
					blobId,
					createdAt: new Date().toISOString()
				});
			}
		}

		enqueuePendingVaultMutation({
			id: crypto.randomUUID(),
			type: 'delete_document',
			documentId: id,
			createdAt: new Date().toISOString()
		});
		void syncRemoteVault();
	}
}

export function getVaultDocumentsByCategory(categoryName: string) {
	if (!browser) {
		return [];
	}

	return getCurrentVaultDocuments().filter(
		(document) => document.categoryName === categoryName && document.status === 'processed'
	);
}

export function getInboxDocuments() {
	if (!browser) {
		return [];
	}

	return getCurrentVaultDocuments().filter((document) => document.status === 'inbox');
}

export function getProcessedDocuments() {
	if (!browser) {
		return [];
	}

	return getCurrentVaultDocuments().filter((document) => document.status === 'processed');
}

export function getProcessedVaultDocumentsSorted() {
	return getProcessedDocuments().sort(
		(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
	);
}

export function getRecentVaultActivities(limit = 5) {
	if (!browser) {
		return [];
	}

	return getCurrentVaultActivities()
		.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
		.slice(0, limit);
}

export function downloadVaultDocument(id: string) {
	if (!browser || !id) {
		return;
	}

	const triggerDownload = async (url: string, name: string, mimeType?: string) => {
		if (isMobileDownloadFallbackNeeded()) {
			try {
				const file = await downloadUrlAsFile(url, name, mimeType);
				const nav = navigator as Navigator & {
					canShare?: (data: ShareData) => boolean;
				};
				const sharePayload: ShareData = {
					files: [file],
					title: name
				};

				if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare(sharePayload))) {
					await nav.share(sharePayload);
					return;
				}
			} catch (error) {
				console.warn('Impossibile preparare il download file su mobile, fallback standard.', error);
			}
		}

		const link = window.document.createElement('a');
		link.href = url;
		link.download = name;
		link.rel = 'noopener';
		window.document.body.appendChild(link);
		link.click();
		link.remove();
	};

	const doc = getVaultDocumentById(id);
	if (doc?.fileDataUrl) {
		void triggerDownload(doc.fileDataUrl, doc.name, doc.type);
		return;
	}

	void ensureVaultDocumentAssets(id, { includeOriginal: true, operation: 'download' }).then((nextDocument) => {
		if (!nextDocument?.fileDataUrl) {
			return;
		}

		void triggerDownload(nextDocument.fileDataUrl, nextDocument.name, nextDocument.type);
	});
}
