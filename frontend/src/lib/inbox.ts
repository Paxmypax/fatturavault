import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import type { Category, InboxAnalysisStatus, InvoiceData, WarrantyData } from '$lib/types';
import {
	deleteInboxDocument,
	getMyInboxDocument,
	isVaultInboxConfigured,
	listMyInboxDocuments,
	markInboxDocumentArchived,
	updateInboxAiState,
	upsertInboxDocument,
	type InboxDocumentStatus as RemoteInboxDocumentStatus
} from '$lib/ic/vaultInbox';
import { analyzeInboxFile } from '$lib/inboxAnalysis';
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
	analysisStatus?: InboxAnalysisStatus;
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
	extractedDocumentDate?: string;
	extractedMerchantName?: string;
	extractedAmount?: number;
	extractedPaymentStatus?: 'due' | 'paid';
	errorMessage?: string;
	analysisUpdatedAt?: string;
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
const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;
const IMAGE_COMPRESSION_TARGET_BYTES = 400 * 1024;
const IMAGE_COMPRESSION_MAX_DIMENSION = 2200;
const IMAGE_COMPRESSION_QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.42];

type ExtractedPayload = {
	provider?: string;
	title?: string | null;
	categoryName?: string | null;
	documentDate?: string | null;
	merchantName?: string | null;
	amount?: number | null;
	paymentStatus?: 'due' | 'paid' | null;
	tags?: string[] | null;
	invoiceData?: {
		invoiceType?: 'ricevuta' | 'emessa' | null;
		invoiceNumber?: string | null;
		supplier?: string | null;
		vatNumber?: string | null;
		netAmount?: number | null;
		vatRate?: number | null;
		vatAmount?: number | null;
		totalAmount?: number | null;
		lineItems?: Array<{
			description?: string | null;
			amount?: number | null;
			vatRate?: number | null;
		}> | null;
	} | null;
};

function parseExtractedPayload(value: string | undefined): ExtractedPayload | null {
	if (!value) {
		return null;
	}

	try {
		const parsed = JSON.parse(value) as ExtractedPayload;
		return parsed && typeof parsed === 'object' ? parsed : null;
	} catch {
		return null;
	}
}

function buildInboxPrefill(input: {
	name: string;
	extractedPayloadJson?: string;
	suggestedTitle?: string;
	suggestedCategoryName?: string;
	suggestedTags?: string[];
	extractedDocumentDate?: string;
	extractedMerchantName?: string;
	extractedAmount?: number;
	extractedPaymentStatus?: 'due' | 'paid';
}) {
	const payload = parseExtractedPayload(input.extractedPayloadJson);
	const llmProvider = payload?.provider === 'openai';

	if (!llmProvider) {
		return {
			title: input.name,
			categoryName: 'Altro',
			documentDate: undefined,
			tags: [] as string[],
			merchantName: undefined,
			amount: undefined,
			paymentStatus: 'paid' as const
		};
	}

	const title =
		typeof payload?.title === 'string' && payload.title.trim()
			? payload.title.trim()
			: input.suggestedTitle?.trim() || input.name;
	const categoryName =
		typeof payload?.categoryName === 'string' && payload.categoryName.trim()
			? payload.categoryName.trim()
			: input.suggestedCategoryName?.trim() || 'Altro';
	const documentDate =
		typeof payload?.documentDate === 'string' && payload.documentDate.trim()
			? payload.documentDate.trim()
			: input.extractedDocumentDate;
	const merchantName =
		typeof payload?.merchantName === 'string' && payload.merchantName.trim()
			? payload.merchantName.trim()
			: input.extractedMerchantName;
	const amount =
		typeof payload?.amount === 'number' && Number.isFinite(payload.amount)
			? payload.amount
			: input.extractedAmount;
	const paymentStatus =
		payload?.paymentStatus === 'due' || payload?.paymentStatus === 'paid'
			? payload.paymentStatus
			: input.extractedPaymentStatus || 'paid';
	const tags = Array.from(
		new Set(
			(Array.isArray(payload?.tags) ? payload.tags : input.suggestedTags ?? [])
				.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length >= 2)
				.map((tag) => tag.trim().toLowerCase())
		)
	);
	const invoiceData =
		payload?.invoiceData &&
		(
			categoryName === 'Fattura' ||
			categoryName === 'Ricevuta' ||
			categoryName === 'Fiscale' ||
			categoryName === 'Casa'
		)
			? {
					invoiceType: (payload.invoiceData.invoiceType === 'emessa'
						? 'emessa'
						: 'ricevuta') as 'emessa' | 'ricevuta',
					invoiceNumber:
						typeof payload.invoiceData.invoiceNumber === 'string'
							? payload.invoiceData.invoiceNumber.trim() || undefined
							: undefined,
					supplier:
						typeof payload.invoiceData.supplier === 'string'
							? payload.invoiceData.supplier.trim() || undefined
							: merchantName,
					vatNumber:
						typeof payload.invoiceData.vatNumber === 'string'
							? payload.invoiceData.vatNumber.trim() || undefined
							: undefined,
					netAmount:
						typeof payload.invoiceData.netAmount === 'number' &&
						Number.isFinite(payload.invoiceData.netAmount)
							? payload.invoiceData.netAmount
							: undefined,
					vatRate:
						typeof payload.invoiceData.vatRate === 'number' &&
						Number.isFinite(payload.invoiceData.vatRate)
							? payload.invoiceData.vatRate
							: undefined,
					vatAmount:
						typeof payload.invoiceData.vatAmount === 'number' &&
						Number.isFinite(payload.invoiceData.vatAmount)
							? payload.invoiceData.vatAmount
							: undefined,
					totalAmount:
						typeof payload.invoiceData.totalAmount === 'number' &&
						Number.isFinite(payload.invoiceData.totalAmount)
							? payload.invoiceData.totalAmount
							: undefined,
					lineItems: Array.isArray(payload.invoiceData.lineItems)
						? payload.invoiceData.lineItems.map((item) => ({
								description:
									typeof item.description === 'string' ? item.description.trim() : '',
								amount:
									typeof item.amount === 'number' && Number.isFinite(item.amount)
										? item.amount
										: 0,
								vatRate:
									typeof item.vatRate === 'number' && Number.isFinite(item.vatRate)
										? item.vatRate
										: 22
						  }))
						: []
				}
			: undefined;

	return {
		title,
		categoryName,
		documentDate,
		tags,
		merchantName,
		amount,
		paymentStatus,
		invoiceData
	};
}

function normalizeInboxDocument(input: {
	id: string;
	name: string;
	size: number;
	type: string;
	sourceBlobId?: string;
	previewBlobId?: string;
	status: RemoteInboxDocumentStatus;
	analysisStatus?: InboxAnalysisStatus;
	ocrText?: string;
	suggestedTitle?: string;
	suggestedCategoryId?: string;
	suggestedCategoryName?: string;
	suggestedTags: string[];
	extractedPayloadJson?: string;
	extractedDocumentDate?: string;
	extractedMerchantName?: string;
	extractedAmount?: number;
	extractedPaymentStatus?: 'due' | 'paid';
	errorMessage?: string;
	analysisUpdatedAt?: string;
	createdAt: string;
	updatedAt: string;
}): InboxDocument {
	const prefill = buildInboxPrefill({
		name: input.name,
		extractedPayloadJson: input.extractedPayloadJson,
		suggestedTitle: input.suggestedTitle,
		suggestedCategoryName: input.suggestedCategoryName,
		suggestedTags: input.suggestedTags,
		extractedDocumentDate: input.extractedDocumentDate,
		extractedMerchantName: input.extractedMerchantName,
		extractedAmount: input.extractedAmount,
		extractedPaymentStatus: input.extractedPaymentStatus
	});

	return {
		id: input.id,
		name: input.name,
		size: input.size,
		type: input.type,
		sourceBlobId: input.sourceBlobId,
		previewBlobId: input.previewBlobId,
		status: input.status,
		analysisStatus: input.analysisStatus,
		title: prefill.title,
		categoryName: prefill.categoryName,
		categoryId: undefined,
		createdAt: input.createdAt,
		updatedAt: input.updatedAt,
		documentDate: prefill.documentDate,
		tags: prefill.tags,
		merchantName: prefill.merchantName,
		amount: prefill.amount,
		paymentStatus: prefill.paymentStatus,
		hasExpiry: false,
		invoiceData: prefill.invoiceData,
		ocrText: input.ocrText,
		suggestedTitle: input.suggestedTitle,
		suggestedCategoryId: input.suggestedCategoryId,
		suggestedCategoryName: input.suggestedCategoryName,
		suggestedTags: input.suggestedTags ?? [],
		extractedPayloadJson: input.extractedPayloadJson,
		extractedDocumentDate: input.extractedDocumentDate,
		extractedMerchantName: input.extractedMerchantName,
		extractedAmount: input.extractedAmount,
		extractedPaymentStatus: input.extractedPaymentStatus,
		errorMessage: input.errorMessage,
		analysisUpdatedAt: input.analysisUpdatedAt,
		remoteSyncState: 'confirmed',
		sourceScope: 'inbox'
	};
}

function mergeInboxDocumentWithLocalState(
	remoteDocument: InboxDocument,
	localDocument?: InboxDocument | null
) {
	return {
		...remoteDocument,
		previewDataUrl: localDocument?.previewDataUrl,
		fileDataUrl: localDocument?.fileDataUrl
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

function formatBytesLabel(bytes: number) {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return '0 MB';
	}

	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(0)} KB`;
	}

	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeInboxUploadError(error: unknown, fileName?: string) {
	if (!(error instanceof Error)) {
		return 'Il file non rispetta i limiti di upload.';
	}

	const message = error.message;
	if (message.includes('5 MB')) {
		return message;
	}

	if (message.includes('500 MB')) {
		return 'Hai raggiunto il limite della inbox temporanea di 500 MB. Elimina o archivia qualche file prima di continuare.';
	}

	if (message.includes('5 GB')) {
		return 'Hai raggiunto il limite del vault personale di 5 GB. Elimina qualche file prima di continuare.';
	}

	if (message.includes('QuotaExceeded')) {
		return 'Lo spazio locale del browser è pieno. Chiudi qualche file o riprova dopo il salvataggio.';
	}

	return fileName ? `Impossibile caricare "${fileName}". ${message}` : message;
}

function renameFileWithExtension(name: string, extension: string) {
	const sanitizedExtension = extension.replace(/^\./, '');
	const dotIndex = name.lastIndexOf('.');
	const baseName = dotIndex > 0 ? name.slice(0, dotIndex) : name;
	return `${baseName}.${sanitizedExtension}`;
}

async function loadImageElement(file: File) {
	const objectUrl = URL.createObjectURL(file);

	try {
		const image = new Image();
		image.decoding = 'async';
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error('Impossibile leggere l’immagine.'));
			image.src = objectUrl;
		});
		return image;
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

async function canvasToJpegBlob(
	canvas: HTMLCanvasElement,
	quality: number
): Promise<Blob | null> {
	return await new Promise((resolve) => {
		canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
	});
}

async function compressImageForUpload(file: File): Promise<File> {
	if (!browser || typeof document === 'undefined' || file.size <= MAX_UPLOAD_FILE_BYTES) {
		return file;
	}

	const image = await loadImageElement(file);
	const largestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
	const initialScale =
		largestSide > IMAGE_COMPRESSION_MAX_DIMENSION
			? IMAGE_COMPRESSION_MAX_DIMENSION / largestSide
			: 1;
	let scale = initialScale;
	let bestBlob: Blob | null = null;

	for (let pass = 0; pass < 4; pass += 1) {
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
		canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Impossibile comprimere l’immagine in questo browser.');
		}

		context.drawImage(image, 0, 0, canvas.width, canvas.height);

		for (const quality of IMAGE_COMPRESSION_QUALITIES) {
			const candidate = await canvasToJpegBlob(canvas, quality);
			if (!candidate) {
				continue;
			}

			if (!bestBlob || candidate.size < bestBlob.size) {
				bestBlob = candidate;
			}

			if (
				candidate.size <= MAX_UPLOAD_FILE_BYTES &&
				(candidate.size <= IMAGE_COMPRESSION_TARGET_BYTES || pass >= 1)
			) {
				return new File([candidate], renameFileWithExtension(file.name, 'jpg'), {
					type: 'image/jpeg',
					lastModified: file.lastModified
				});
			}
		}

		scale *= 0.82;
	}

	if (bestBlob && bestBlob.size <= MAX_UPLOAD_FILE_BYTES) {
		return new File([bestBlob], renameFileWithExtension(file.name, 'jpg'), {
			type: 'image/jpeg',
			lastModified: file.lastModified
		});
	}

	throw new Error(
		`L'immagine supera il limite di 5 MB anche dopo la compressione automatica. Dimensione attuale: ${formatBytesLabel(file.size)}.`
	);
}

async function prepareFileForInboxUpload(file: File): Promise<File> {
	if (file.size <= MAX_UPLOAD_FILE_BYTES) {
		return file;
	}

	if (file.type.startsWith('image/')) {
		return await compressImageForUpload(file);
	}

	throw new Error(
		`"${file.name}" supera il limite di 5 MB. I PDF passano così come sono solo se restano entro 5 MB.`
	);
}

function mergeDocuments(remoteDocuments: InboxDocument[], localDocuments: InboxDocument[]) {
	const localById = new Map(localDocuments.map((document) => [document.id, document]));
	const merged = remoteDocuments
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
		});

	const remoteIds = new Set(merged.map((document) => document.id));
	const pendingLocalDocuments = localDocuments.filter(
		(document) =>
			!remoteIds.has(document.id) &&
			!pendingArchivedInboxIds.has(document.id) &&
			(document.status === 'processing' ||
				document.status === 'error' ||
				document.remoteSyncState === 'pending')
	);

	return [...merged, ...pendingLocalDocuments].sort(
		(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
	);
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

export async function refreshInboxDocument(documentId: string) {
	if (!browser || !documentId || !isVaultInboxConfigured()) {
		return null;
	}

	const remoteDocument = await getMyInboxDocument(documentId);
	if (!remoteDocument) {
		return null;
	}

	const normalizedRemoteDocument = normalizeInboxDocument({
		id: remoteDocument.id,
		name: remoteDocument.name,
		size: remoteDocument.size,
		type: remoteDocument.type,
		sourceBlobId: remoteDocument.sourceBlobId,
		previewBlobId: remoteDocument.previewBlobId,
		status: remoteDocument.status,
		analysisStatus: remoteDocument.analysisStatus,
		ocrText: remoteDocument.ocrText,
		suggestedTitle: remoteDocument.suggestedTitle,
		suggestedCategoryId: remoteDocument.suggestedCategoryId,
		suggestedCategoryName: remoteDocument.suggestedCategoryName,
		suggestedTags: remoteDocument.suggestedTags,
		extractedPayloadJson: remoteDocument.extractedPayloadJson,
		extractedDocumentDate: remoteDocument.extractedDocumentDate,
		extractedMerchantName: remoteDocument.extractedMerchantName,
		extractedAmount: remoteDocument.extractedAmount,
		extractedPaymentStatus: remoteDocument.extractedPaymentStatus,
		errorMessage: remoteDocument.errorMessage,
		analysisUpdatedAt: remoteDocument.analysisUpdatedAt,
		createdAt: remoteDocument.createdAt,
		updatedAt: remoteDocument.updatedAt
	});

	inboxStore.update((state) => {
		const existing = state.documents.find((document) => document.id === documentId);
		const mergedDocument = mergeInboxDocumentWithLocalState(normalizedRemoteDocument, existing);
		const alreadyPresent = Boolean(existing);

		return {
			ready: true,
			documents: (
				alreadyPresent
					? state.documents.map((document) =>
							document.id === documentId ? mergedDocument : document
						)
					: [mergedDocument, ...state.documents]
			).sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
			)
		};
	});

	return normalizedRemoteDocument;
}

export async function addInboxDocuments(files: File[]) {
	if (!browser || !files.length) {
		return [];
	}

	const now = new Date().toISOString();
	const uploadEntries: Array<{ uploadFile: File; baseDocument: InboxDocument }> = [];
	const rejectedDocuments: InboxDocument[] = [];

	for (const file of files) {
		const id = createClientId();

		try {
			const uploadFile = await prepareFileForInboxUpload(file);
			const fileDataUrl = createLocalObjectUrl(uploadFile);
			const previewDataUrl = uploadFile.type.startsWith('image/') ? fileDataUrl : undefined;

			if (fileDataUrl) {
				rememberBlobUrl(`${id}:original`, fileDataUrl);
			}

			if (previewDataUrl) {
				rememberBlobUrl(`${id}:preview`, previewDataUrl);
			}

			uploadEntries.push({
				uploadFile,
				baseDocument: {
					id,
					name: uploadFile.name,
					size: uploadFile.size,
					type: uploadFile.type || 'application/octet-stream',
					status: 'processing' as const,
					analysisStatus: 'idle' as const,
					title: uploadFile.name,
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
				}
			});
		} catch (error) {
			rejectedDocuments.push({
				id,
				name: file.name,
				size: file.size,
				type: file.type || 'application/octet-stream',
				status: 'error' as const,
				analysisStatus: 'error' as const,
				title: file.name,
				categoryName: 'Altro',
				createdAt: now,
				updatedAt: now,
				tags: [],
				suggestedTags: [],
				paymentStatus: 'paid' as const,
				hasExpiry: false,
				errorMessage:
					normalizeInboxUploadError(error, file.name),
				sourceScope: 'inbox' as const
			});
		}
	}

	const preparedDocuments = uploadEntries.map(({ baseDocument }) => baseDocument);

	inboxStore.update((state) => ({
		ready: true,
		documents: [...preparedDocuments, ...rejectedDocuments, ...state.documents]
	}));

	if (!isVaultInboxConfigured() || !isVaultStorageConfigured()) {
		return [...preparedDocuments, ...rejectedDocuments];
	}

	for (const { uploadFile: file, baseDocument } of uploadEntries) {
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
				status: 'processing',
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

				try {
					inboxStore.update((state) => ({
						ready: true,
						documents: state.documents.map((document) =>
							document.id === baseDocument.id
								? {
										...document,
										status: 'processing',
										analysisStatus: 'processing'
									}
								: document
						)
					}));

					const analysis = await analyzeInboxFile(file);
					const analyzedRemoteDocument = await updateInboxAiState({
						documentId: baseDocument.id,
						status: 'ready_for_review',
						analysisStatus: analysis.analysisStatus,
						ocrText: analysis.ocrText,
						suggestedTitle: analysis.suggestedTitle,
						suggestedCategoryName: analysis.suggestedCategoryName,
						suggestedTags: analysis.suggestedTags,
						extractedPayloadJson: analysis.extractedPayloadJson,
						extractedDocumentDate: analysis.extractedDocumentDate,
						extractedMerchantName: analysis.extractedMerchantName,
						extractedAmount: analysis.extractedAmount,
						extractedPaymentStatus: analysis.extractedPaymentStatus
					});

					if (analyzedRemoteDocument) {
						inboxStore.update((state) => ({
							ready: true,
							documents: state.documents.map((document) =>
								document.id === baseDocument.id
									? mergeInboxDocumentWithLocalState(
											normalizeInboxDocument(analyzedRemoteDocument),
											document
										)
									: document
							)
						}));
					}
				} catch (analysisError) {
					console.warn("Impossibile completare l'analisi iniziale del documento inbox.", analysisError);
					const fallbackRemoteDocument = await updateInboxAiState({
						documentId: baseDocument.id,
						status: 'ready_for_review',
						analysisStatus: 'error',
						errorMessage:
							analysisError instanceof Error
								? analysisError.message
								: 'Analisi inbox non riuscita.'
					}).catch((error: unknown) => {
						console.warn("Impossibile aggiornare lo stato finale del documento inbox.", error);
						return null;
					});

					inboxStore.update((state) => ({
						ready: true,
						documents: state.documents.map((document) =>
							document.id === baseDocument.id
									? fallbackRemoteDocument
										? mergeInboxDocumentWithLocalState(
												normalizeInboxDocument(fallbackRemoteDocument),
												document
											)
										: {
												...document,
												status: 'ready_for_review' as const,
												analysisStatus: 'error' as const,
												errorMessage:
													analysisError instanceof Error
														? analysisError.message
														: 'Analisi inbox non riuscita.'
											}
									: document
						)
					}));
				}
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
											normalizeInboxUploadError(error, baseDocument.name)
									}
								: document
						)
					}));
				}
			} catch (innerError) {
				console.warn('Impossibile aggiornare lo stato errore del documento inbox.', innerError);
				inboxStore.update((state) => ({
					ready: true,
					documents: state.documents.map((document) =>
						document.id === baseDocument.id
							? {
									...document,
									status: 'error',
									analysisStatus: 'error',
									errorMessage:
										normalizeInboxUploadError(error, baseDocument.name)
								}
							: document
					)
				}));
			}
		}
	}

	void syncRemoteInbox();
	return [...preparedDocuments, ...rejectedDocuments];
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

