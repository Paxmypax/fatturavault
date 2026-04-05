import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import type { Category, InvoiceData, WarrantyData } from '$lib/types';
import {
	deleteInboxDocument,
	getMyInboxDocument,
	isVaultInboxConfigured,
	listMyInboxDocuments,
	markInboxDocumentArchived,
	upsertInboxDocument,
	type InboxDocumentStatus as RemoteInboxDocumentStatus
} from '$lib/ic/vaultInbox';
import {
	deleteBlob,
	downloadBlobBytes,
	isVaultStorageConfigured,
	uploadBlobForDocument
} from '$lib/ic/vaultStorage';
import {
	addVaultDocuments,
	forceSyncVaultDocument,
	updateVaultDocument,
	waitForVaultDocumentPreparation,
	type VaultDocument
} from '$lib/vault';

export type InboxDocument = {
	id: string;
	name: string;
	size: number;
	type: string;
	sourceBlobId?: string;
	previewBlobId?: string;
	status: RemoteInboxDocumentStatus;
	title: string;
	categoryName: string;
	categoryId?: string;
	createdAt: string;
	updatedAt: string;
	documentDate?: string;
	tags: string[];
	notes?: string;
	merchantName?: string;
	amount?: number;
	paymentStatus: 'due' | 'paid';
	hasExpiry: boolean;
	expiryDate?: string;
	expiryType?: string;
	expiryDuration?: string;
	invoiceData?: InvoiceData;
	warrantyData?: WarrantyData;
	ocrText?: string;
	suggestedTitle?: string;
	suggestedCategoryId?: string;
	suggestedCategoryName?: string;
	suggestedTags: string[];
	extractedPayloadJson?: string;
	errorMessage?: string;
	previewDataUrl?: string;
	fileDataUrl?: string;
	remoteSyncState?: 'pending' | 'confirmed';
	sourceScope: 'inbox';
};

type InboxState = {
	ready: boolean;
	documents: InboxDocument[];
};

type InboxAssetOperationState = {
	previewingDocumentIds: string[];
};

const inboxStore = writable<InboxState>({
	ready: false,
	documents: []
});

const inboxAssetOperationStore = writable<InboxAssetOperationState>({
	previewingDocumentIds: []
});

let inboxInitialized = false;
const blobObjectUrls = new Map<string, string>();
const pendingArchivedInboxIds = new Set<string>();
type PendingInboxArchiveFinalization = {
	documentId: string;
	vaultDocumentId: string;
};

const archiveFinalizationQueue: PendingInboxArchiveFinalization[] = [];
let archiveFinalizationInFlight: Promise<void> | null = null;

function normalizeInboxDocument(input: {
	id: string;
	name: string;
	size: number;
	type: string;
	sourceBlobId?: string;
	previewBlobId?: string;
	status: RemoteInboxDocumentStatus;
	ocrText?: string;
	suggestedTitle?: string;
	suggestedCategoryId?: string;
	suggestedCategoryName?: string;
	suggestedTags: string[];
	extractedPayloadJson?: string;
	errorMessage?: string;
	createdAt: string;
	updatedAt: string;
}): InboxDocument {
	return {
		id: input.id,
		name: input.name,
		size: input.size,
		type: input.type,
		sourceBlobId: input.sourceBlobId,
		previewBlobId: input.previewBlobId,
		status: input.status,
		title: input.suggestedTitle || input.name,
		categoryName: input.suggestedCategoryName || 'Altro',
		categoryId: input.suggestedCategoryId,
		createdAt: input.createdAt,
		updatedAt: input.updatedAt,
		tags: input.suggestedTags ?? [],
		paymentStatus: 'paid',
		hasExpiry: false,
		ocrText: input.ocrText,
		suggestedTitle: input.suggestedTitle,
		suggestedCategoryId: input.suggestedCategoryId,
		suggestedCategoryName: input.suggestedCategoryName,
		suggestedTags: input.suggestedTags ?? [],
		extractedPayloadJson: input.extractedPayloadJson,
		errorMessage: input.errorMessage,
		remoteSyncState: 'confirmed',
		sourceScope: 'inbox'
	};
}

function rememberBlobUrl(cacheKey: string, url: string) {
	const previous = blobObjectUrls.get(cacheKey);
	if (previous) {
		URL.revokeObjectURL(previous);
	}
	blobObjectUrls.set(cacheKey, url);
}

function setPreviewing(documentId: string, active: boolean) {
	inboxAssetOperationStore.update((state) => {
		const currentIds = state.previewingDocumentIds;
		const nextIds = active
			? currentIds.includes(documentId)
				? currentIds
				: [...currentIds, documentId]
			: currentIds.filter((id) => id !== documentId);

		if (nextIds === currentIds) {
			return state;
		}

		return {
			previewingDocumentIds: nextIds
		};
	});
}

function createClientId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function createLocalObjectUrl(file: File) {
	try {
		return URL.createObjectURL(file);
	} catch {
		return undefined;
	}
}

function mergeDocuments(remoteDocuments: InboxDocument[], localDocuments: InboxDocument[]) {
	const localById = new Map(localDocuments.map((document) => [document.id, document]));
	return remoteDocuments
		.filter(
			(document) =>
				document.status !== 'archived' && !pendingArchivedInboxIds.has(document.id)
		)
		.map((document) => {
			const local = localById.get(document.id);
			return {
				...document,
				previewDataUrl: local?.previewDataUrl,
				fileDataUrl: local?.fileDataUrl
			};
		})
		.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function syncRemoteInbox() {
	if (!browser || !isVaultInboxConfigured()) {
		return;
	}

	const remoteDocuments = await listMyInboxDocuments();
	if (!remoteDocuments) {
		return;
	}

	inboxStore.update((state) => ({
		ready: true,
		documents: mergeDocuments(remoteDocuments.map(normalizeInboxDocument), state.documents)
	}));
}

export const inboxState = {
	subscribe: inboxStore.subscribe
};

export const inboxAssetOperationState = {
	subscribe: inboxAssetOperationStore.subscribe
};

export function initInbox() {
	if (!browser) {
		return Promise.resolve();
	}

	if (inboxInitialized) {
		return syncRemoteInbox();
	}

	inboxInitialized = true;
	inboxStore.set({
		ready: true,
		documents: []
	});

	return syncRemoteInbox();
}

export function getInboxDocumentById(id: string) {
	if (!browser || !id) {
		return null;
	}

	return get(inboxStore).documents.find((document) => document.id === id) ?? null;
}

export async function addInboxDocuments(files: File[]) {
	if (!browser || !files.length) {
		return [];
	}

	const now = new Date().toISOString();
	const preparedDocuments = files.map((file) => {
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
			type: file.type || 'application/octet-stream',
			status: 'processing' as const,
			title: file.name,
			categoryName: 'Altro',
			createdAt: now,
			updatedAt: now,
			tags: [],
			suggestedTags: [],
			paymentStatus: 'paid' as const,
			hasExpiry: false,
			previewDataUrl,
			fileDataUrl,
			sourceScope: 'inbox' as const
		} satisfies InboxDocument;
	});

	inboxStore.update((state) => ({
		ready: true,
		documents: [...preparedDocuments, ...state.documents]
	}));

	if (!isVaultInboxConfigured() || !isVaultStorageConfigured()) {
		return preparedDocuments;
	}

	for (const [index, file] of files.entries()) {
		const baseDocument = preparedDocuments[index];
		try {
			await upsertInboxDocument({
				id: baseDocument.id,
				name: baseDocument.name,
				size: baseDocument.size,
				type: baseDocument.type,
				status: 'processing',
				createdAt: baseDocument.createdAt
			});

			const sourceBlobId =
				(await uploadBlobForDocument({
					documentId: baseDocument.id,
					kind: 'original',
					mimeType: baseDocument.type,
					blob: file
				})) ?? undefined;

			const previewBlobId =
				file.type.startsWith('image/')
					? sourceBlobId
					: undefined;

			const remoteDocument = await upsertInboxDocument({
				id: baseDocument.id,
				name: baseDocument.name,
				size: baseDocument.size,
				type: baseDocument.type,
				sourceBlobId,
				previewBlobId,
				status: 'ready_for_review',
				createdAt: baseDocument.createdAt
			});

			if (remoteDocument) {
				inboxStore.update((state) => ({
					ready: true,
					documents: state.documents.map((document) =>
						document.id === baseDocument.id
							? {
									...document,
									...normalizeInboxDocument(remoteDocument),
									previewDataUrl: document.previewDataUrl,
									fileDataUrl: document.fileDataUrl
								}
							: document
					)
				}));
			}
		} catch (error) {
			console.warn('Impossibile salvare il documento inbox sul backend ICP.', error);
			try {
				const erroredRemoteDocument = await upsertInboxDocument({
					id: baseDocument.id,
					name: baseDocument.name,
					size: baseDocument.size,
					type: baseDocument.type,
					status: 'error',
					createdAt: baseDocument.createdAt
				});

				if (erroredRemoteDocument) {
					inboxStore.update((state) => ({
						ready: true,
						documents: state.documents.map((document) =>
							document.id === baseDocument.id
								? {
										...document,
										...normalizeInboxDocument(erroredRemoteDocument),
										previewDataUrl: document.previewDataUrl,
										fileDataUrl: document.fileDataUrl,
										errorMessage:
											error instanceof Error
												? error.message
												: 'Caricamento inbox non riuscito.'
									}
								: document
						)
					}));
				}
			} catch (innerError) {
				console.warn('Impossibile aggiornare lo stato errore del documento inbox.', innerError);
			}
		}
	}

	void syncRemoteInbox();
	return preparedDocuments;
}

export async function ensureInboxDocumentAssets(
	documentId: string,
	options: { includeOriginal?: boolean; operation?: 'preview' | 'download' } = {}
) {
	if (!browser) {
		return null;
	}

	const document = getInboxDocumentById(documentId);
	if (!document) {
		return null;
	}

	const shouldLoadPreview =
		!document.previewDataUrl && Boolean(document.previewBlobId || document.sourceBlobId);
	const shouldLoadOriginal = Boolean(options.includeOriginal) && !document.fileDataUrl && Boolean(document.sourceBlobId);

	if (!shouldLoadPreview && !shouldLoadOriginal) {
		return document;
	}

	setPreviewing(documentId, true);

	try {
		const nextAssets: Partial<Pick<InboxDocument, 'previewDataUrl' | 'fileDataUrl'>> = {};

		if (shouldLoadPreview) {
			const blobId = document.previewBlobId || document.sourceBlobId;
			if (blobId) {
				const preview = await downloadBlobBytes(blobId);
				if (preview) {
					const previewBlob = new Blob([preview.bytes], { type: preview.mimeType || document.type });
					const previewUrl = URL.createObjectURL(previewBlob);
					rememberBlobUrl(`${document.id}:preview`, previewUrl);
					nextAssets.previewDataUrl = previewUrl;
				}
			}
		}

		if (shouldLoadOriginal && document.sourceBlobId) {
			const original = await downloadBlobBytes(document.sourceBlobId);
			if (original) {
				const originalBlob = new Blob([original.bytes], { type: original.mimeType || document.type });
				const originalUrl = URL.createObjectURL(originalBlob);
				rememberBlobUrl(`${document.id}:original`, originalUrl);
				nextAssets.fileDataUrl = originalUrl;
			}
		}

		if (Object.keys(nextAssets).length) {
			inboxStore.update((state) => ({
				ready: true,
				documents: state.documents.map((entry) =>
					entry.id === document.id
						? {
								...entry,
								...nextAssets
							}
						: entry
				)
			}));
		}

		return getInboxDocumentById(documentId);
	} catch (error) {
		console.warn('Impossibile caricare gli asset del documento inbox.', error);
		return document;
	} finally {
		setPreviewing(documentId, false);
	}
}

export async function removeInboxDocumentAndSync(documentId: string) {
	const document = getInboxDocumentById(documentId);

	inboxStore.update((state) => ({
		ready: true,
		documents: state.documents.filter((entry) => entry.id !== documentId)
	}));

	try {
		await deleteInboxDocument(documentId);
		if (document?.sourceBlobId) {
			await deleteBlob(document.sourceBlobId);
		}
		if (document?.previewBlobId && document.previewBlobId !== document.sourceBlobId) {
			await deleteBlob(document.previewBlobId);
		}
	} catch (error) {
		console.warn('Impossibile eliminare il documento inbox dal backend ICP.', error);
	}
}

function suppressInboxDocumentLocally(documentId: string) {
	pendingArchivedInboxIds.add(documentId);
	inboxStore.update((state) => ({
		ready: true,
		documents: state.documents.filter((entry) => entry.id !== documentId)
	}));
}

function enqueueArchiveFinalization(entry: PendingInboxArchiveFinalization) {
	archiveFinalizationQueue.push(entry);

	if (archiveFinalizationInFlight) {
		return;
	}

	archiveFinalizationInFlight = (async () => {
		while (archiveFinalizationQueue.length) {
			const current = archiveFinalizationQueue.shift();
			if (!current) {
				continue;
			}

			try {
				await markInboxDocumentArchived(current.documentId);
				await waitForVaultDocumentPreparation(current.vaultDocumentId);
				await forceSyncVaultDocument(current.vaultDocumentId);
				await removeInboxDocumentAndSync(current.documentId);
			} catch (error) {
				console.warn(
					"Impossibile completare l'archiviazione definitiva del documento.",
					error
				);
			} finally {
				pendingArchivedInboxIds.delete(current.documentId);
				await syncRemoteInbox();
			}
		}
	})().finally(() => {
		archiveFinalizationInFlight = null;
		if (archiveFinalizationQueue.length) {
			enqueueArchiveFinalization(archiveFinalizationQueue.shift() as PendingInboxArchiveFinalization);
		}
	});
}

export async function archiveInboxDocumentAndSync(
	documentId: string,
	updates: Partial<VaultDocument>,
	options: {
		onProgress?: (message: string) => void;
	} = {}
) {
	const reportProgress = (message: string) => {
		options.onProgress?.(message);
	};

	reportProgress('Preparo il file');

	const inboxDocument =
		getInboxDocumentById(documentId) ??
		(await getMyInboxDocument(documentId).then((doc) =>
			doc ? normalizeInboxDocument(doc) : null
		));
	if (!inboxDocument || !inboxDocument.sourceBlobId) {
		throw new Error('Documento inbox non trovato o file sorgente non disponibile.');
	}

	const source = await downloadBlobBytes(inboxDocument.sourceBlobId);
	if (!source) {
		throw new Error('Impossibile scaricare il file temporaneo dall\'inbox.');
	}

	const file = new File([source.bytes], inboxDocument.name, {
		type: source.mimeType || inboxDocument.type || 'application/octet-stream'
	});

	reportProgress('Proteggo il documento');

	const [vaultDocument] = (await addVaultDocuments([file])) ?? [];
	if (!vaultDocument) {
		throw new Error('Impossibile creare il documento nel vault.');
	}

	const nextUpdates: Partial<VaultDocument> = {
		...updates,
		title: updates.title ?? inboxDocument.title,
		categoryName: updates.categoryName ?? inboxDocument.categoryName,
		categoryId: updates.categoryId ?? inboxDocument.categoryId,
		status: 'processed',
		tags: updates.tags ?? inboxDocument.tags
	};

	reportProgress('Lo salvo nel vault');

	updateVaultDocument(vaultDocument.id, nextUpdates);
	suppressInboxDocumentLocally(documentId);
	enqueueArchiveFinalization({
		documentId,
		vaultDocumentId: vaultDocument.id
	});

	return vaultDocument.id;
}

