export type Category = {
	id?: string;
	name: string;
	color: string;
	icon: string;
	is_default: boolean;
	doc_count: number;
};

export type CategoryDefinition = Omit<Category, 'doc_count'>;

export type InvoiceData = {
	invoiceType: 'ricevuta' | 'emessa';
	invoiceNumber?: string;
	supplier?: string;
	vatNumber?: string;
	netAmount?: number;
	vatRate?: number;
	vatAmount?: number;
	totalAmount?: number;
	lineItems: LineItem[];
};

export type LineItem = {
	description: string;
	amount: number;
	vatRate: number;
};

export type WarrantyData = {
	product?: string;
	brand?: string;
	store?: string;
	purchaseDate?: string;
	durationMonths?: number;
	serialNumber?: string;
};

export type EncryptionAlgorithm = 'AES-GCM-256';

export type BlobEncryptionMetadata = {
	version: 1;
	algorithm: EncryptionAlgorithm;
	ivBase64: string;
	plaintextSha256Hex: string;
	ciphertextSha256Hex: string;
	plaintextSize: number;
	ciphertextSize: number;
};

export type KeyWrappingScheme = 'local-browser-v1' | 'ii-derived-v1';

export type DocumentCryptoState = {
	scheme: 'client-aes-gcm-v1';
	wrappedDocumentKeyBase64?: string;
	wrappingIvBase64?: string;
	keyWrapping?: KeyWrappingScheme;
	original?: BlobEncryptionMetadata;
	preview?: BlobEncryptionMetadata;
};

export type InboxDocumentStatus =
	| 'uploaded'
	| 'processing'
	| 'ready_for_review'
	| 'archived'
	| 'error';

export type InboxDocument = {
	id: string;
	name: string;
	size: number;
	type: string;
	sourceBlobId?: string;
	previewBlobId?: string;
	status: InboxDocumentStatus;
	ocrText?: string;
	suggestedTitle?: string;
	suggestedCategoryId?: string;
	suggestedCategoryName?: string;
	suggestedTags: string[];
	extractedPayloadJson?: string;
	errorMessage?: string;
	createdAt: string;
	updatedAt: string;
	expiresAt?: string;
	archivedAt?: string;
};
