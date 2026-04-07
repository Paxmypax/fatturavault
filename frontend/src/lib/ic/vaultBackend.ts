import { browser } from '$app/environment';
import { AuthClient } from '@icp-sdk/auth/client';
import { Actor, HttpAgent } from '@icp-sdk/core/agent';
import { safeGetCanisterEnv } from '@icp-sdk/core/agent/canister-env';
import type { SecurityState } from '$lib/auth';
import type {
	BlobEncryptionMetadata,
	Category,
	DocumentCryptoState,
	InvoiceData,
	WarrantyData
} from '$lib/types';

type BackendResult<T> = { Ok: T } | { Err: string };
type Nullable<T> = [] | [T];

type RawVetKeyConfigRecord = {
	key_name: string;
	derivation_context: Uint8Array | number[];
	aes_domain_separator: string;
};

type RawSecurityState = {
	ack_recovery_phrase: boolean;
	ack_backup_device: boolean;
	ack_risk_understood: boolean;
	completed_at_ns: Nullable<bigint>;
	last_reviewed_at_ns: Nullable<bigint>;
};

type RawUserProfile = {
	owner: unknown;
	display_name: Nullable<string>;
	created_at_ns: bigint;
	updated_at_ns: bigint;
	security: RawSecurityState;
};

type RawCategoryRecord = {
	id: string;
	owner: unknown;
	is_default: boolean;
	name: string;
	color: string;
	icon: string;
	sort_order: number | bigint;
	doc_count: number | bigint;
	created_at_ns: bigint;
	updated_at_ns: bigint;
};

type RawNoteRecord = {
	id: string;
	owner: unknown;
	title: string;
	encrypted_content: Uint8Array | number[];
	pinned: boolean;
	created_at_ns: bigint;
	updated_at_ns: bigint;
};

type RawPostItRecord = {
	id: string;
	owner: unknown;
	encrypted_text: Uint8Array | number[];
	completed: boolean;
	color: string;
	created_at_ns: bigint;
	updated_at_ns: bigint;
};

type RawDocumentStatus = { Inbox: null } | { Processed: null };
type RawPaymentStatus = { Due: null } | { Paid: null };
type RawActivityType = { Uploaded: null } | { Processed: null } | { Updated: null } | { Deleted: null };

type RawInvoiceLineItemRecord = {
	description: string;
	amount: number;
	vat_rate: number;
};

type RawInvoiceDataRecord = {
	invoice_type: string;
	invoice_number: Nullable<string>;
	supplier: Nullable<string>;
	vat_number: Nullable<string>;
	net_amount: Nullable<number>;
	vat_rate: Nullable<number>;
	vat_amount: Nullable<number>;
	total_amount: Nullable<number>;
	line_items: RawInvoiceLineItemRecord[];
};

type RawWarrantyDataRecord = {
	product: Nullable<string>;
	brand: Nullable<string>;
	store: Nullable<string>;
	purchase_date: Nullable<string>;
	duration_months: Nullable<number | bigint>;
	serial_number: Nullable<string>;
};

type RawBlobEncryptionMetadataRecord = {
	version: number | bigint;
	algorithm: string;
	iv_base64: string;
	plaintext_sha256_hex: string;
	ciphertext_sha256_hex: string;
	plaintext_size: number | bigint;
	ciphertext_size: number | bigint;
};

type RawDocumentCryptoStateRecord = {
	scheme: string;
	wrapped_document_key_base64: Nullable<string>;
	wrapping_iv_base64: Nullable<string>;
	key_wrapping: Nullable<string>;
	original: Nullable<RawBlobEncryptionMetadataRecord>;
	preview: Nullable<RawBlobEncryptionMetadataRecord>;
};

type RawDocumentRecord = {
	id: string;
	owner: unknown;
	name: string;
	size_bytes: number | bigint;
	mime_type: string;
	original_blob_id: Nullable<string>;
	preview_blob_id: Nullable<string>;
	category_id: Nullable<string>;
	category_name: string;
	title: string;
	status: RawDocumentStatus;
	document_date: Nullable<string>;
	tags: string[];
	notes: Nullable<string>;
	merchant_name: Nullable<string>;
	amount: Nullable<number>;
	payment_status: RawPaymentStatus;
	has_expiry: boolean;
	expiry_date: Nullable<string>;
	expiry_type: Nullable<string>;
	expiry_duration: Nullable<string>;
	crypto_state: Nullable<RawDocumentCryptoStateRecord>;
	invoice_data: Nullable<RawInvoiceDataRecord>;
	warranty_data: Nullable<RawWarrantyDataRecord>;
	created_at_ns: bigint;
	updated_at_ns: bigint;
};

type RawDocumentUpsertInput = {
	id: Nullable<string>;
	name: string;
	size_bytes: bigint;
	mime_type: string;
	original_blob_id: Nullable<string>;
	preview_blob_id: Nullable<string>;
	category_id: Nullable<string>;
	category_name: string;
	title: string;
	status: RawDocumentStatus;
	document_date: Nullable<string>;
	tags: string[];
	notes: Nullable<string>;
	merchant_name: Nullable<string>;
	amount: Nullable<number>;
	payment_status: RawPaymentStatus;
	has_expiry: boolean;
	expiry_date: Nullable<string>;
	expiry_type: Nullable<string>;
	expiry_duration: Nullable<string>;
	crypto_state: Nullable<RawDocumentCryptoStateRecord>;
	invoice_data: Nullable<RawInvoiceDataRecord>;
	warranty_data: Nullable<RawWarrantyDataRecord>;
	created_at_ns: Nullable<bigint>;
};

type RawActivityRecord = {
	id: string;
	owner: unknown;
	activity_type: RawActivityType;
	document_id: string;
	document_name: string;
	document_title: Nullable<string>;
	category_name: Nullable<string>;
	at_ns: bigint;
};

type RawOnchainVaultSummaryResponse = {
	provider: string;
	model: string;
	summary: string;
	highlights: string[];
	generated_at_ns: bigint;
};

type RawOnchainVaultChatResponse = {
	provider: string;
	model: string;
	answer: string;
	generated_at_ns: bigint;
};

type RawVaultCountsResponse = {
	processed_documents: bigint;
	due_documents: bigint;
	paid_documents: bigint;
	notes_count: bigint;
	postits_count: bigint;
};

type RawDashboardSuggestionRecord = {
	id: string;
	title: string;
	body: string;
	tone: string;
	cta_label: Nullable<string>;
	cta_href: Nullable<string>;
};

type RawNotificationBroadcastRecord = {
	id: string;
	title: string;
	body: string;
	created_at_ns: bigint;
};

type RawNotificationViewRecord = {
	id: string;
	title: string;
	body: string;
	created_at_ns: bigint;
	read_at_ns: Nullable<bigint>;
	is_unread: boolean;
};

type RawNotificationAccessState = {
	can_publish: boolean;
	has_admins: boolean;
};

export type RemoteVaultDocument = {
	id: string;
	name: string;
	size: number;
	type: string;
	originalBlobId?: string;
	previewBlobId?: string;
	categoryId?: string;
	cryptoState?: DocumentCryptoState;
	categoryName: string;
	title: string;
	status: 'inbox' | 'processed';
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
	createdAt: string;
	updatedAt: string;
};

export type RemoteVaultActivity = {
	id: string;
	type: 'uploaded' | 'processed' | 'updated' | 'deleted';
	documentId: string;
	documentName: string;
	documentTitle?: string;
	categoryName?: string;
	at: string;
};

export type RemoteVetKeyConfig = {
	keyName: string;
	derivationContext: Uint8Array;
	aesDomainSeparator: string;
};

export type RemoteAiVaultSummary = {
	provider: string;
	model: string;
	summary: string;
	highlights: string[];
	generatedAt: string;
};

export type RemoteAiVaultChatAnswer = {
	provider: string;
	model: string;
	answer: string;
	generatedAt: string;
};

export type RemoteVaultCounts = {
	processedDocuments: number;
	dueDocuments: number;
	paidDocuments: number;
	notesCount: number;
	postitsCount: number;
};

export type RemoteDashboardSuggestion = {
	id: string;
	title: string;
	body: string;
	tone: string;
	ctaLabel?: string;
	ctaHref?: string;
};

export type RemoteNotification = {
	id: string;
	title: string;
	body: string;
	createdAt: string;
	readAt?: string;
	isUnread: boolean;
};

export type RemoteNotificationAccessState = {
	canPublish: boolean;
	hasAdmins: boolean;
};

type VaultBackendActor = {
	get_my_profile: () => Promise<Nullable<RawUserProfile>>;
	get_user_vetkey_config: () => Promise<RawVetKeyConfigRecord>;
	get_user_vetkey_public_key: () => Promise<BackendResult<Uint8Array | number[]>>;
	get_encrypted_user_vetkey: (
		transportPublicKey: Uint8Array
	) => Promise<BackendResult<Uint8Array | number[]>>;
	upsert_my_profile: (
		displayName: Nullable<string>,
		security: Nullable<RawSecurityState>
	) => Promise<BackendResult<RawUserProfile>>;
	get_my_categories: () => Promise<RawCategoryRecord[]>;
	add_custom_category: (
		name: string,
		color: string,
		icon: string
	) => Promise<BackendResult<RawCategoryRecord>>;
	update_category: (
		categoryId: string,
		name: string,
		color: string,
		icon: string
	) => Promise<BackendResult<RawCategoryRecord>>;
	delete_custom_category: (categoryId: string) => Promise<{ Ok: null } | { Err: string }>;
	list_my_notes: () => Promise<RawNoteRecord[]>;
	upsert_note: (
		id: Nullable<string>,
		title: string,
		encryptedContent: Uint8Array,
		pinned: boolean
	) => Promise<BackendResult<RawNoteRecord>>;
	delete_note: (noteId: string) => Promise<{ Ok: null } | { Err: string }>;
	list_my_postits: () => Promise<RawPostItRecord[]>;
	upsert_postit: (
		id: Nullable<string>,
		encryptedText: Uint8Array,
		completed: boolean,
		color: string
	) => Promise<BackendResult<RawPostItRecord>>;
	delete_postit: (postitId: string) => Promise<{ Ok: null } | { Err: string }>;
	list_my_documents: () => Promise<RawDocumentRecord[]>;
	list_my_activities: (limit: Nullable<number>) => Promise<RawActivityRecord[]>;
	get_my_vault_counts: () => Promise<RawVaultCountsResponse>;
	get_my_dashboard_suggestions: () => Promise<RawDashboardSuggestionRecord[]>;
	cleanup_my_orphan_documents: () => Promise<bigint>;
	list_my_notifications: () => Promise<RawNotificationViewRecord[]>;
	get_my_notification_access_state: () => Promise<RawNotificationAccessState>;
	mark_my_notifications_seen: () => Promise<RawNotificationViewRecord[]>;
	publish_broadcast_notification: (
		title: string,
		body: string
	) => Promise<BackendResult<RawNotificationBroadcastRecord>>;
	generate_my_ai_summary: () => Promise<BackendResult<RawOnchainVaultSummaryResponse>>;
	ask_my_ai_vault: (question: string) => Promise<BackendResult<RawOnchainVaultChatResponse>>;
	upsert_document: (input: RawDocumentUpsertInput) => Promise<BackendResult<RawDocumentRecord>>;
	delete_document: (documentId: string) => Promise<{ Ok: null } | { Err: string }>;
};

function idlFactory({ IDL: idl }: { IDL: any }) {
	const SecurityState = idl.Record({
		ack_recovery_phrase: idl.Bool,
		ack_backup_device: idl.Bool,
		ack_risk_understood: idl.Bool,
		completed_at_ns: idl.Opt(idl.Nat64),
		last_reviewed_at_ns: idl.Opt(idl.Nat64)
	});

	const UserProfile = idl.Record({
		owner: idl.Principal,
		display_name: idl.Opt(idl.Text),
		created_at_ns: idl.Nat64,
		updated_at_ns: idl.Nat64,
		security: SecurityState
	});

	const VetKeyConfigRecord = idl.Record({
		key_name: idl.Text,
		derivation_context: idl.Vec(idl.Nat8),
		aes_domain_separator: idl.Text
	});

	const CategoryRecord = idl.Record({
		id: idl.Text,
		owner: idl.Principal,
		is_default: idl.Bool,
		name: idl.Text,
		color: idl.Text,
		icon: idl.Text,
		sort_order: idl.Nat32,
		doc_count: idl.Nat64,
		created_at_ns: idl.Nat64,
		updated_at_ns: idl.Nat64
	});

	const NoteRecord = idl.Record({
		id: idl.Text,
		owner: idl.Principal,
		title: idl.Text,
		encrypted_content: idl.Vec(idl.Nat8),
		pinned: idl.Bool,
		created_at_ns: idl.Nat64,
		updated_at_ns: idl.Nat64
	});

	const PostItRecord = idl.Record({
		id: idl.Text,
		owner: idl.Principal,
		encrypted_text: idl.Vec(idl.Nat8),
		completed: idl.Bool,
		color: idl.Text,
		created_at_ns: idl.Nat64,
		updated_at_ns: idl.Nat64
	});

	const DocumentStatus = idl.Variant({
		Inbox: idl.Null,
		Processed: idl.Null
	});

	const PaymentStatus = idl.Variant({
		Due: idl.Null,
		Paid: idl.Null
	});

	const ActivityType = idl.Variant({
		Uploaded: idl.Null,
		Processed: idl.Null,
		Updated: idl.Null,
		Deleted: idl.Null
	});

	const InvoiceLineItemRecord = idl.Record({
		description: idl.Text,
		amount: idl.Float64,
		vat_rate: idl.Float64
	});

	const InvoiceDataRecord = idl.Record({
		invoice_type: idl.Text,
		invoice_number: idl.Opt(idl.Text),
		supplier: idl.Opt(idl.Text),
		vat_number: idl.Opt(idl.Text),
		net_amount: idl.Opt(idl.Float64),
		vat_rate: idl.Opt(idl.Float64),
		vat_amount: idl.Opt(idl.Float64),
		total_amount: idl.Opt(idl.Float64),
		line_items: idl.Vec(InvoiceLineItemRecord)
	});

	const WarrantyDataRecord = idl.Record({
		product: idl.Opt(idl.Text),
		brand: idl.Opt(idl.Text),
		store: idl.Opt(idl.Text),
		purchase_date: idl.Opt(idl.Text),
		duration_months: idl.Opt(idl.Nat32),
		serial_number: idl.Opt(idl.Text)
	});

	const BlobEncryptionMetadataRecord = idl.Record({
		version: idl.Nat8,
		algorithm: idl.Text,
		iv_base64: idl.Text,
		plaintext_sha256_hex: idl.Text,
		ciphertext_sha256_hex: idl.Text,
		plaintext_size: idl.Nat64,
		ciphertext_size: idl.Nat64
	});

	const DocumentCryptoStateRecord = idl.Record({
		scheme: idl.Text,
		wrapped_document_key_base64: idl.Opt(idl.Text),
		wrapping_iv_base64: idl.Opt(idl.Text),
		key_wrapping: idl.Opt(idl.Text),
		original: idl.Opt(BlobEncryptionMetadataRecord),
		preview: idl.Opt(BlobEncryptionMetadataRecord)
	});

	const DocumentRecord = idl.Record({
		id: idl.Text,
		owner: idl.Principal,
		name: idl.Text,
		size_bytes: idl.Nat64,
		mime_type: idl.Text,
		original_blob_id: idl.Opt(idl.Text),
		preview_blob_id: idl.Opt(idl.Text),
		category_id: idl.Opt(idl.Text),
		category_name: idl.Text,
		title: idl.Text,
		status: DocumentStatus,
		document_date: idl.Opt(idl.Text),
		tags: idl.Vec(idl.Text),
		notes: idl.Opt(idl.Text),
		merchant_name: idl.Opt(idl.Text),
		amount: idl.Opt(idl.Float64),
		payment_status: PaymentStatus,
		has_expiry: idl.Bool,
		expiry_date: idl.Opt(idl.Text),
		expiry_type: idl.Opt(idl.Text),
		expiry_duration: idl.Opt(idl.Text),
		crypto_state: idl.Opt(DocumentCryptoStateRecord),
		invoice_data: idl.Opt(InvoiceDataRecord),
		warranty_data: idl.Opt(WarrantyDataRecord),
		created_at_ns: idl.Nat64,
		updated_at_ns: idl.Nat64
	});

	const DocumentUpsertInput = idl.Record({
		id: idl.Opt(idl.Text),
		name: idl.Text,
		size_bytes: idl.Nat64,
		mime_type: idl.Text,
		original_blob_id: idl.Opt(idl.Text),
		preview_blob_id: idl.Opt(idl.Text),
		category_id: idl.Opt(idl.Text),
		category_name: idl.Text,
		title: idl.Text,
		status: DocumentStatus,
		document_date: idl.Opt(idl.Text),
		tags: idl.Vec(idl.Text),
		notes: idl.Opt(idl.Text),
		merchant_name: idl.Opt(idl.Text),
		amount: idl.Opt(idl.Float64),
		payment_status: PaymentStatus,
		has_expiry: idl.Bool,
		expiry_date: idl.Opt(idl.Text),
		expiry_type: idl.Opt(idl.Text),
		expiry_duration: idl.Opt(idl.Text),
		crypto_state: idl.Opt(DocumentCryptoStateRecord),
		invoice_data: idl.Opt(InvoiceDataRecord),
		warranty_data: idl.Opt(WarrantyDataRecord),
		created_at_ns: idl.Opt(idl.Nat64)
	});

	const ActivityRecord = idl.Record({
		id: idl.Text,
		owner: idl.Principal,
		activity_type: ActivityType,
		document_id: idl.Text,
		document_name: idl.Text,
		document_title: idl.Opt(idl.Text),
		category_name: idl.Opt(idl.Text),
		at_ns: idl.Nat64
	});

	const OnchainVaultSummaryResponse = idl.Record({
		provider: idl.Text,
		model: idl.Text,
		summary: idl.Text,
		highlights: idl.Vec(idl.Text),
		generated_at_ns: idl.Nat64
	});
	const OnchainVaultChatResponse = idl.Record({
		provider: idl.Text,
		model: idl.Text,
		answer: idl.Text,
		generated_at_ns: idl.Nat64
	});
	const VaultCountsResponse = idl.Record({
		processed_documents: idl.Nat64,
		due_documents: idl.Nat64,
		paid_documents: idl.Nat64,
		notes_count: idl.Nat64,
		postits_count: idl.Nat64
	});
	const DashboardSuggestionRecord = idl.Record({
		id: idl.Text,
		title: idl.Text,
		body: idl.Text,
		tone: idl.Text,
		cta_label: idl.Opt(idl.Text),
		cta_href: idl.Opt(idl.Text)
	});
	const NotificationBroadcastRecord = idl.Record({
		id: idl.Text,
		title: idl.Text,
		body: idl.Text,
		created_at_ns: idl.Nat64
	});
	const NotificationViewRecord = idl.Record({
		id: idl.Text,
		title: idl.Text,
		body: idl.Text,
		created_at_ns: idl.Nat64,
		read_at_ns: idl.Opt(idl.Nat64),
		is_unread: idl.Bool
	});
	const NotificationAccessState = idl.Record({
		can_publish: idl.Bool,
		has_admins: idl.Bool
	});

	const UserProfileResult = idl.Variant({ Ok: UserProfile, Err: idl.Text });
	const CategoryResult = idl.Variant({ Ok: CategoryRecord, Err: idl.Text });
	const NoteResult = idl.Variant({ Ok: NoteRecord, Err: idl.Text });
	const PostItResult = idl.Variant({ Ok: PostItRecord, Err: idl.Text });
	const DocumentResult = idl.Variant({ Ok: DocumentRecord, Err: idl.Text });
	const OnchainVaultSummaryResult = idl.Variant({ Ok: OnchainVaultSummaryResponse, Err: idl.Text });
	const OnchainVaultChatResult = idl.Variant({ Ok: OnchainVaultChatResponse, Err: idl.Text });
	const UnitResult = idl.Variant({ Ok: idl.Null, Err: idl.Text });

	return idl.Service({
		get_my_profile: idl.Func([], [idl.Opt(UserProfile)], ['query']),
		get_user_vetkey_config: idl.Func([], [VetKeyConfigRecord], ['query']),
		get_user_vetkey_public_key: idl.Func(
			[],
			[
				idl.Variant({
					Ok: idl.Vec(idl.Nat8),
					Err: idl.Text
				})
			],
			[]
		),
		get_encrypted_user_vetkey: idl.Func(
			[idl.Vec(idl.Nat8)],
			[
				idl.Variant({
					Ok: idl.Vec(idl.Nat8),
					Err: idl.Text
				})
			],
			[]
		),
		upsert_my_profile: idl.Func([idl.Opt(idl.Text), idl.Opt(SecurityState)], [UserProfileResult], []),
		get_my_categories: idl.Func([], [idl.Vec(CategoryRecord)], []),
		add_custom_category: idl.Func([idl.Text, idl.Text, idl.Text], [CategoryResult], []),
		update_category: idl.Func([idl.Text, idl.Text, idl.Text, idl.Text], [CategoryResult], []),
		delete_custom_category: idl.Func([idl.Text], [UnitResult], []),
		list_my_notes: idl.Func([], [idl.Vec(NoteRecord)], ['query']),
		upsert_note: idl.Func([idl.Opt(idl.Text), idl.Text, idl.Vec(idl.Nat8), idl.Bool], [NoteResult], []),
		delete_note: idl.Func([idl.Text], [UnitResult], []),
		list_my_postits: idl.Func([], [idl.Vec(PostItRecord)], ['query']),
		upsert_postit: idl.Func([idl.Opt(idl.Text), idl.Vec(idl.Nat8), idl.Bool, idl.Text], [PostItResult], []),
		delete_postit: idl.Func([idl.Text], [UnitResult], []),
		list_my_documents: idl.Func([], [idl.Vec(DocumentRecord)], []),
		list_my_activities: idl.Func([idl.Opt(idl.Nat32)], [idl.Vec(ActivityRecord)], []),
		get_my_vault_counts: idl.Func([], [VaultCountsResponse], []),
		get_my_dashboard_suggestions: idl.Func([], [idl.Vec(DashboardSuggestionRecord)], ['query']),
		cleanup_my_orphan_documents: idl.Func([], [idl.Nat64], []),
		list_my_notifications: idl.Func([], [idl.Vec(NotificationViewRecord)], []),
		get_my_notification_access_state: idl.Func([], [NotificationAccessState], []),
		mark_my_notifications_seen: idl.Func([], [idl.Vec(NotificationViewRecord)], []),
		publish_broadcast_notification: idl.Func(
			[idl.Text, idl.Text],
			[idl.Variant({ Ok: NotificationBroadcastRecord, Err: idl.Text })],
			[]
		),
		generate_my_ai_summary: idl.Func([], [OnchainVaultSummaryResult], []),
		ask_my_ai_vault: idl.Func([idl.Text], [OnchainVaultChatResult], []),
		upsert_document: idl.Func([DocumentUpsertInput], [DocumentResult], []),
		delete_document: idl.Func([idl.Text], [UnitResult], [])
	});
}

export function resolveVaultBackendCanisterId() {
	if (!browser) {
		return null;
	}

	const env = safeGetCanisterEnv<{ readonly ['PUBLIC_CANISTER_ID:vault_backend']: string }>();
	return (
		import.meta.env.VITE_VAULT_BACKEND_CANISTER_ID ||
		env?.['PUBLIC_CANISTER_ID:vault_backend'] ||
		null
	);
}

function resolveHost() {
	return import.meta.env.VITE_ICP_HOST || 'http://127.0.0.1:4943';
}

export function isVaultBackendConfigured() {
	return Boolean(resolveVaultBackendCanisterId());
}

let authClientPromise: Promise<AuthClient> | null = null;

async function getAuthClient() {
	if (!authClientPromise) {
		authClientPromise = AuthClient.create();
	}

	return authClientPromise;
}

async function getActor(): Promise<VaultBackendActor | null> {
	if (!browser) {
		return null;
	}

	const canisterId = resolveVaultBackendCanisterId();
	if (!canisterId) {
		return null;
	}

	const authClient = await getAuthClient();
	const authenticated = await authClient.isAuthenticated();
	if (!authenticated) {
		return null;
	}

	const identity = authClient.getIdentity();
	const agent = await HttpAgent.create({
		host: resolveHost(),
		identity
	});

	if (resolveHost().includes('127.0.0.1') || resolveHost().includes('localhost')) {
		await agent.fetchRootKey?.();
	}

	return Actor.createActor<VaultBackendActor>(idlFactory, {
		agent,
		canisterId
	});
}

function unwrapResult<T>(result: BackendResult<T>): T {
	if ('Err' in result) {
		throw new Error(result.Err);
	}

	return result.Ok;
}

function optionToNullable<T>(value: Nullable<T>): T | null {
	return value.length ? value[0] : null;
}

function optionToUndefined<T>(value: Nullable<T>): T | undefined {
	return value.length ? value[0] : undefined;
}

function bigintToIso(value: bigint | null | undefined) {
	if (value == null) {
		return null;
	}

	return new Date(Number(value / BigInt(1_000_000))).toISOString();
}

function isoToBigint(value: string | null | undefined) {
	if (!value) {
		return BigInt(Date.now()) * BigInt(1_000_000);
	}

	const milliseconds = new Date(value).getTime();
	if (Number.isNaN(milliseconds)) {
		return BigInt(Date.now()) * BigInt(1_000_000);
	}

	return BigInt(milliseconds) * BigInt(1_000_000);
}

function decodeBytes(value: Uint8Array | number[]) {
	const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value);
	return new TextDecoder().decode(bytes);
}

function toUint8Array(value: Uint8Array | number[]) {
	return value instanceof Uint8Array ? value : Uint8Array.from(value);
}

function encodeText(value: string) {
	return new TextEncoder().encode(value);
}

function mapSecurityState(raw: RawSecurityState): SecurityState {
	return {
		ackRecoveryPhrase: raw.ack_recovery_phrase,
		ackBackupDevice: raw.ack_backup_device,
		ackRiskUnderstood: raw.ack_risk_understood,
		completedAt: bigintToIso(optionToNullable(raw.completed_at_ns))
	};
}

function toRawSecurityState(security: SecurityState): RawSecurityState {
	return {
		ack_recovery_phrase: security.ackRecoveryPhrase,
		ack_backup_device: security.ackBackupDevice,
		ack_risk_understood: security.ackRiskUnderstood,
		completed_at_ns: security.completedAt ? [isoToBigint(security.completedAt)] : [],
		last_reviewed_at_ns: [BigInt(Date.now()) * BigInt(1_000_000)]
	};
}

function mapCategory(raw: RawCategoryRecord): Category {
	return {
		id: raw.id,
		name: raw.name,
		color: raw.color,
		icon: raw.icon,
		is_default: raw.is_default,
		doc_count: Number(raw.doc_count)
	};
}

function mapInvoiceData(raw: RawInvoiceDataRecord | null | undefined): InvoiceData | undefined {
	if (!raw) {
		return undefined;
	}

	return {
		invoiceType: raw.invoice_type as InvoiceData['invoiceType'],
		invoiceNumber: optionToUndefined(raw.invoice_number),
		supplier: optionToUndefined(raw.supplier),
		vatNumber: optionToUndefined(raw.vat_number),
		netAmount: optionToNullable(raw.net_amount) ?? undefined,
		vatRate: optionToNullable(raw.vat_rate) ?? undefined,
		vatAmount: optionToNullable(raw.vat_amount) ?? undefined,
		totalAmount: optionToNullable(raw.total_amount) ?? undefined,
		lineItems: raw.line_items.map((lineItem) => ({
			description: lineItem.description,
			amount: lineItem.amount,
			vatRate: lineItem.vat_rate
		}))
	};
}

function mapWarrantyData(raw: RawWarrantyDataRecord | null | undefined): WarrantyData | undefined {
	if (!raw) {
		return undefined;
	}

	return {
		product: optionToUndefined(raw.product),
		brand: optionToUndefined(raw.brand),
		store: optionToUndefined(raw.store),
		purchaseDate: optionToUndefined(raw.purchase_date),
		durationMonths: optionToNullable(raw.duration_months)
			? Number(optionToNullable(raw.duration_months))
			: undefined,
		serialNumber: optionToUndefined(raw.serial_number)
	};
}

function mapBlobEncryptionMetadata(
	raw: RawBlobEncryptionMetadataRecord | null | undefined
): BlobEncryptionMetadata | undefined {
	if (!raw) {
		return undefined;
	}

		return {
		version: Number(raw.version) as 1,
		algorithm: raw.algorithm as BlobEncryptionMetadata['algorithm'],
		ivBase64: raw.iv_base64,
		plaintextSha256Hex: raw.plaintext_sha256_hex,
		ciphertextSha256Hex: raw.ciphertext_sha256_hex,
		plaintextSize: Number(raw.plaintext_size),
		ciphertextSize: Number(raw.ciphertext_size)
	};
}

function mapDocumentCryptoState(
	raw: RawDocumentCryptoStateRecord | null | undefined
): DocumentCryptoState | undefined {
	if (!raw) {
		return undefined;
	}

	return {
		scheme: raw.scheme as DocumentCryptoState['scheme'],
		wrappedDocumentKeyBase64: optionToUndefined(raw.wrapped_document_key_base64),
		wrappingIvBase64: optionToUndefined(raw.wrapping_iv_base64),
		keyWrapping: optionToUndefined(raw.key_wrapping) as DocumentCryptoState['keyWrapping'],
		original: mapBlobEncryptionMetadata(optionToNullable(raw.original)),
		preview: mapBlobEncryptionMetadata(optionToNullable(raw.preview))
	};
}

function mapDocumentStatus(value: RawDocumentStatus): RemoteVaultDocument['status'] {
	return 'Processed' in value ? 'processed' : 'inbox';
}

function mapPaymentStatus(value: RawPaymentStatus): RemoteVaultDocument['paymentStatus'] {
	return 'Due' in value ? 'due' : 'paid';
}

function mapActivityType(value: RawActivityType): RemoteVaultActivity['type'] {
	if ('Uploaded' in value) return 'uploaded';
	if ('Processed' in value) return 'processed';
	if ('Deleted' in value) return 'deleted';
	return 'updated';
}

function toRawDocumentStatus(value: RemoteVaultDocument['status']): RawDocumentStatus {
	return value === 'processed' ? { Processed: null } : { Inbox: null };
}

function toRawPaymentStatus(value: RemoteVaultDocument['paymentStatus']): RawPaymentStatus {
	return value === 'due' ? { Due: null } : { Paid: null };
}

function toRawBlobEncryptionMetadata(
	value: BlobEncryptionMetadata | undefined
): Nullable<RawBlobEncryptionMetadataRecord> {
	if (!value) {
		return [];
	}

	return [
		{
			version: value.version,
			algorithm: value.algorithm,
			iv_base64: value.ivBase64,
			plaintext_sha256_hex: value.plaintextSha256Hex,
			ciphertext_sha256_hex: value.ciphertextSha256Hex,
			plaintext_size: BigInt(value.plaintextSize),
			ciphertext_size: BigInt(value.ciphertextSize)
		}
	];
}

function toRawDocumentCryptoState(
	value: DocumentCryptoState | undefined
): Nullable<RawDocumentCryptoStateRecord> {
	if (!value) {
		return [];
	}

	return [
		{
			scheme: value.scheme,
			wrapped_document_key_base64: toOptText(value.wrappedDocumentKeyBase64),
			wrapping_iv_base64: toOptText(value.wrappingIvBase64),
			key_wrapping: toOptText(value.keyWrapping),
			original: toRawBlobEncryptionMetadata(value.original),
			preview: toRawBlobEncryptionMetadata(value.preview)
		}
	];
}

function toOptText(value: string | null | undefined): Nullable<string> {
	const trimmed = value?.trim();
	return trimmed ? [trimmed] : [];
}

function toOptNumber(value: number | null | undefined): Nullable<number> {
	return typeof value === 'number' && Number.isFinite(value) ? [value] : [];
}

function mapRemoteDocument(raw: RawDocumentRecord): RemoteVaultDocument {
	return {
		id: raw.id,
		name: raw.name,
		size: Number(raw.size_bytes),
		type: raw.mime_type,
		originalBlobId: optionToUndefined(raw.original_blob_id),
		previewBlobId: optionToUndefined(raw.preview_blob_id),
		categoryId: optionToUndefined(raw.category_id),
		cryptoState: mapDocumentCryptoState(optionToNullable(raw.crypto_state)),
		categoryName: raw.category_name,
		title: raw.title,
		status: mapDocumentStatus(raw.status),
		documentDate: optionToUndefined(raw.document_date),
		tags: raw.tags,
		notes: optionToUndefined(raw.notes),
		merchantName: optionToUndefined(raw.merchant_name),
		amount: optionToNullable(raw.amount) ?? undefined,
		paymentStatus: mapPaymentStatus(raw.payment_status),
		hasExpiry: raw.has_expiry,
		expiryDate: optionToUndefined(raw.expiry_date),
		expiryType: optionToUndefined(raw.expiry_type),
		expiryDuration: optionToUndefined(raw.expiry_duration),
		invoiceData: mapInvoiceData(optionToNullable(raw.invoice_data)),
		warrantyData: mapWarrantyData(optionToNullable(raw.warranty_data)),
		createdAt: bigintToIso(raw.created_at_ns) ?? new Date().toISOString(),
		updatedAt: bigintToIso(raw.updated_at_ns) ?? new Date().toISOString()
	};
}

function toRawInvoiceData(value: InvoiceData | undefined): Nullable<RawInvoiceDataRecord> {
	if (!value) {
		return [];
	}

	return [
		{
			invoice_type: value.invoiceType,
			invoice_number: toOptText(value.invoiceNumber),
			supplier: toOptText(value.supplier),
			vat_number: toOptText(value.vatNumber),
			net_amount: toOptNumber(value.netAmount),
			vat_rate: toOptNumber(value.vatRate),
			vat_amount: toOptNumber(value.vatAmount),
			total_amount: toOptNumber(value.totalAmount),
			line_items: value.lineItems.map((lineItem) => ({
				description: lineItem.description,
				amount: lineItem.amount,
				vat_rate: lineItem.vatRate
			}))
		}
	];
}

function toRawWarrantyData(value: WarrantyData | undefined): Nullable<RawWarrantyDataRecord> {
	if (!value) {
		return [];
	}

	return [
		{
			product: toOptText(value.product),
			brand: toOptText(value.brand),
			store: toOptText(value.store),
			purchase_date: toOptText(value.purchaseDate),
			duration_months:
				typeof value.durationMonths === 'number' && Number.isFinite(value.durationMonths)
					? [value.durationMonths]
					: [],
			serial_number: toOptText(value.serialNumber)
		}
	];
}

function toRawDocumentInput(document: RemoteVaultDocument): RawDocumentUpsertInput {
	return {
		id: toOptText(document.id),
		name: document.name,
		size_bytes: BigInt(document.size || 0),
		mime_type: document.type,
		original_blob_id: toOptText(document.originalBlobId),
		preview_blob_id: toOptText(document.previewBlobId),
		category_id: toOptText(document.categoryId),
		category_name: document.categoryName || 'Altro',
		title: document.title || document.name,
		status: toRawDocumentStatus(document.status),
		document_date: toOptText(document.documentDate),
		tags: document.tags ?? [],
		notes: toOptText(document.notes),
		merchant_name: toOptText(document.merchantName),
		amount: toOptNumber(document.amount),
		payment_status: toRawPaymentStatus(document.paymentStatus ?? 'paid'),
		has_expiry: document.hasExpiry,
		expiry_date: toOptText(document.expiryDate),
		expiry_type: toOptText(document.expiryType),
		expiry_duration: toOptText(document.expiryDuration),
		crypto_state: toRawDocumentCryptoState(document.cryptoState),
		invoice_data: toRawInvoiceData(document.invoiceData),
		warranty_data: toRawWarrantyData(document.warrantyData),
		created_at_ns: document.createdAt ? [isoToBigint(document.createdAt)] : []
	};
}

export async function fetchRemoteProfile() {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const response = await actor.get_my_profile();
	const profile = optionToNullable(response);
	if (!profile) {
		return null;
	}

	return {
		displayName: optionToNullable(profile.display_name),
		security: mapSecurityState(profile.security)
	};
}

export async function fetchRemoteVetKeyConfig(): Promise<RemoteVetKeyConfig | null> {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const config = await actor.get_user_vetkey_config();
	return {
		keyName: config.key_name,
		derivationContext: toUint8Array(config.derivation_context),
		aesDomainSeparator: config.aes_domain_separator
	};
}

export async function fetchEncryptedUserVetKey(
	transportPublicKey: Uint8Array
): Promise<Uint8Array | null> {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.get_encrypted_user_vetkey(transportPublicKey);
	const encryptedVetKey = unwrapResult(result);
	return toUint8Array(encryptedVetKey);
}

export async function fetchUserVetKeyPublicKey(): Promise<Uint8Array | null> {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.get_user_vetkey_public_key();
	const publicKey = unwrapResult(result);
	return toUint8Array(publicKey);
}

export async function upsertRemoteProfile(input: {
	displayName?: string | null;
	security?: SecurityState | null;
}) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.upsert_my_profile(
		input.displayName === undefined
			? []
			: input.displayName === null
				? []
				: [input.displayName],
		input.security ? [toRawSecurityState(input.security)] : []
	);

	const profile = unwrapResult(result);
	return {
		displayName: optionToNullable(profile.display_name),
		security: mapSecurityState(profile.security)
	};
}

export async function fetchRemoteCategories() {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const categories = await actor.get_my_categories();
	return categories.map(mapCategory);
}

export async function addRemoteCategory(name: string, color: string, icon: string) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	return mapCategory(unwrapResult(await actor.add_custom_category(name, color, icon)));
}

export async function updateRemoteCategory(
	categoryId: string,
	name: string,
	color: string,
	icon: string
) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	return mapCategory(unwrapResult(await actor.update_category(categoryId, name, color, icon)));
}

export async function deleteRemoteCategory(categoryId: string) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.delete_custom_category(categoryId);
	if ('Err' in result) {
		throw new Error(result.Err);
	}

	return true;
}

export async function fetchRemoteNotes() {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const notes = await actor.list_my_notes();
	return notes.map((note) => ({
		id: note.id,
		title: note.title,
		content: decodeBytes(note.encrypted_content),
		pinned: note.pinned,
		createdAt: bigintToIso(note.created_at_ns) ?? new Date().toISOString(),
		updatedAt: bigintToIso(note.updated_at_ns) ?? new Date().toISOString()
	}));
}

export async function upsertRemoteNote(input: {
	id?: string | null;
	title: string;
	content: string;
	pinned: boolean;
}) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.upsert_note(
		input.id ? [input.id] : [],
		input.title,
		encodeText(input.content),
		input.pinned
	);
	const note = unwrapResult(result);
	return {
		id: note.id,
		title: note.title,
		content: decodeBytes(note.encrypted_content),
		pinned: note.pinned,
		createdAt: bigintToIso(note.created_at_ns) ?? new Date().toISOString(),
		updatedAt: bigintToIso(note.updated_at_ns) ?? new Date().toISOString()
	};
}

export async function deleteRemoteNote(noteId: string) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.delete_note(noteId);
	if ('Err' in result) {
		throw new Error(result.Err);
	}

	return true;
}

export async function fetchRemotePostIts() {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const postits = await actor.list_my_postits();
	return postits.map((postit) => ({
		id: postit.id,
		text: decodeBytes(postit.encrypted_text),
		completed: postit.completed,
		color: postit.color,
		createdAt: bigintToIso(postit.created_at_ns) ?? new Date().toISOString(),
		updatedAt: bigintToIso(postit.updated_at_ns) ?? new Date().toISOString()
	}));
}

export async function upsertRemotePostIt(input: {
	id?: string | null;
	text: string;
	completed: boolean;
	color: string;
}) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.upsert_postit(
		input.id ? [input.id] : [],
		encodeText(input.text),
		input.completed,
		input.color
	);
	const postit = unwrapResult(result);
	return {
		id: postit.id,
		text: decodeBytes(postit.encrypted_text),
		completed: postit.completed,
		color: postit.color,
		createdAt: bigintToIso(postit.created_at_ns) ?? new Date().toISOString(),
		updatedAt: bigintToIso(postit.updated_at_ns) ?? new Date().toISOString()
	};
}

export async function deleteRemotePostIt(postitId: string) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.delete_postit(postitId);
	if ('Err' in result) {
		throw new Error(result.Err);
	}

	return true;
}

export async function fetchRemoteDocuments() {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const documents = await actor.list_my_documents();
	return documents.map(mapRemoteDocument);
}

export async function fetchRemoteActivities(limit?: number) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const activities = await actor.list_my_activities(
		typeof limit === 'number' && Number.isFinite(limit) ? [limit] : []
	);
	return activities.map((activity) => ({
		id: activity.id,
		type: mapActivityType(activity.activity_type),
		documentId: activity.document_id,
		documentName: activity.document_name,
		documentTitle: optionToUndefined(activity.document_title),
		categoryName: optionToUndefined(activity.category_name),
		at: bigintToIso(activity.at_ns) ?? new Date().toISOString()
	}));
}

export async function fetchRemoteVaultCounts(): Promise<RemoteVaultCounts | null> {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const counts = await actor.get_my_vault_counts();
	return {
		processedDocuments: Number(counts.processed_documents),
		dueDocuments: Number(counts.due_documents),
		paidDocuments: Number(counts.paid_documents),
		notesCount: Number(counts.notes_count),
		postitsCount: Number(counts.postits_count)
	};
}

export async function fetchRemoteDashboardSuggestions(): Promise<RemoteDashboardSuggestion[] | null> {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const suggestions = await actor.get_my_dashboard_suggestions();
	return suggestions.map((suggestion) => ({
		id: suggestion.id,
		title: suggestion.title,
		body: suggestion.body,
		tone: suggestion.tone,
		ctaLabel: optionToUndefined(suggestion.cta_label),
		ctaHref: optionToUndefined(suggestion.cta_href)
	}));
}

export async function cleanupRemoteOrphanDocuments(): Promise<number | null> {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const removed = await actor.cleanup_my_orphan_documents();
	return Number(removed);
}

function mapRemoteNotification(raw: RawNotificationViewRecord): RemoteNotification {
	return {
		id: raw.id,
		title: raw.title,
		body: raw.body,
		createdAt: bigintToIso(raw.created_at_ns) ?? new Date().toISOString(),
		readAt: bigintToIso(optionToUndefined(raw.read_at_ns)) ?? undefined,
		isUnread: raw.is_unread
	};
}

export async function fetchRemoteNotifications(): Promise<RemoteNotification[] | null> {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const notifications = await actor.list_my_notifications();
	return notifications.map(mapRemoteNotification);
}

export async function fetchRemoteNotificationAccessState(): Promise<RemoteNotificationAccessState | null> {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const access = await actor.get_my_notification_access_state();
	return {
		canPublish: access.can_publish,
		hasAdmins: access.has_admins
	};
}

export async function markRemoteNotificationsSeen(): Promise<RemoteNotification[] | null> {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const notifications = await actor.mark_my_notifications_seen();
	return notifications.map(mapRemoteNotification);
}

export async function publishRemoteNotification(title: string, body: string) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.publish_broadcast_notification(title, body);
	const notification = unwrapResult(result);
	return {
		id: notification.id,
		title: notification.title,
		body: notification.body,
		createdAt: bigintToIso(notification.created_at_ns) ?? new Date().toISOString()
	};
}

export async function generateRemoteAiVaultSummary(): Promise<RemoteAiVaultSummary | null> {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.generate_my_ai_summary();
	const summary = unwrapResult(result);
	return {
		provider: summary.provider,
		model: summary.model,
		summary: summary.summary,
		highlights: summary.highlights,
		generatedAt: bigintToIso(summary.generated_at_ns) ?? new Date().toISOString()
	};
}

export async function askRemoteAiVault(question: string): Promise<RemoteAiVaultChatAnswer | null> {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.ask_my_ai_vault(question);
	const answer = unwrapResult(result);
	return {
		provider: answer.provider,
		model: answer.model,
		answer: answer.answer,
		generatedAt: bigintToIso(answer.generated_at_ns) ?? new Date().toISOString()
	};
}

export async function upsertRemoteDocument(document: RemoteVaultDocument) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.upsert_document(toRawDocumentInput(document));
	return mapRemoteDocument(unwrapResult(result));
}

export async function deleteRemoteDocument(documentId: string) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.delete_document(documentId);
	if ('Err' in result) {
		throw new Error(result.Err);
	}

	return true;
}
