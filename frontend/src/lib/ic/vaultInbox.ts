import { browser } from '$app/environment';
import { AuthClient } from '@icp-sdk/auth/client';
import { Actor, HttpAgent } from '@icp-sdk/core/agent';
import { safeGetCanisterEnv } from '@icp-sdk/core/agent/canister-env';
import type { InboxAnalysisStatus, InboxDocument, InboxDocumentStatus } from '$lib/types';

export type { InboxDocumentStatus } from '$lib/types';

type BackendResult<T> = { Ok: T } | { Err: string };
type Nullable<T> = [] | [T];

type RawInboxDocumentStatus =
	| { Uploaded: null }
	| { Processing: null }
	| { ReadyForReview: null }
	| { Archived: null }
	| { Error: null };

type RawInboxAnalysisStatus =
	| { Idle: null }
	| { Queued: null }
	| { Processing: null }
	| { Completed: null }
	| { Error: null };

type RawPaymentStatus = { Due: null } | { Paid: null };

type RawInboxLlmLineItemRecord = {
	description: string;
	amount: Nullable<number>;
	vat_rate: Nullable<number>;
};

type RawInboxLlmInvoiceDataRecord = {
	invoice_type: Nullable<string>;
	invoice_number: Nullable<string>;
	supplier: Nullable<string>;
	vat_number: Nullable<string>;
	net_amount: Nullable<number>;
	vat_rate: Nullable<number>;
	vat_amount: Nullable<number>;
	total_amount: Nullable<number>;
	line_items: RawInboxLlmLineItemRecord[];
};

type RawInboxOnchainLlmRequest = {
	file_name: string;
	mime_type: string;
	extracted_text: string;
	heuristic_category_name: Nullable<string>;
	heuristic_merchant_name: Nullable<string>;
	heuristic_document_date: Nullable<string>;
	heuristic_amount: Nullable<number>;
};

type RawInboxOnchainLlmResponse = {
	provider: string;
	model: string;
	title: Nullable<string>;
	category_name: Nullable<string>;
	tags: string[];
	document_date: Nullable<string>;
	merchant_name: Nullable<string>;
	amount: Nullable<number>;
	payment_status: Nullable<RawPaymentStatus>;
	document_text_excerpt: Nullable<string>;
	invoice_data: Nullable<RawInboxLlmInvoiceDataRecord>;
};

type RawInboxDocumentRecord = {
	id: string;
	owner: unknown;
	name: string;
	size_bytes: number | bigint;
	mime_type: string;
	source_blob_id: Nullable<string>;
	preview_blob_id: Nullable<string>;
	status: RawInboxDocumentStatus;
	analysis_status: Nullable<RawInboxAnalysisStatus>;
	ocr_text: Nullable<string>;
	suggested_title: Nullable<string>;
	suggested_category_id: Nullable<string>;
	suggested_category_name: Nullable<string>;
	suggested_tags: string[];
	extracted_payload_json: Nullable<string>;
	extracted_document_date: Nullable<string>;
	extracted_merchant_name: Nullable<string>;
	extracted_amount: Nullable<number>;
	extracted_payment_status: Nullable<RawPaymentStatus>;
	error_message: Nullable<string>;
	analysis_updated_at_ns: Nullable<bigint>;
	created_at_ns: bigint;
	updated_at_ns: bigint;
	expires_at_ns: Nullable<bigint>;
	archived_at_ns: Nullable<bigint>;
};

type RawInboxDocumentUpsertInput = {
	id: Nullable<string>;
	name: string;
	size_bytes: bigint;
	mime_type: string;
	source_blob_id: Nullable<string>;
	preview_blob_id: Nullable<string>;
	status: Nullable<RawInboxDocumentStatus>;
	expires_at_ns: Nullable<bigint>;
	created_at_ns: Nullable<bigint>;
};

type RawInboxAiUpdateInput = {
	document_id: string;
	status: RawInboxDocumentStatus;
	analysis_status: Nullable<RawInboxAnalysisStatus>;
	ocr_text: Nullable<string>;
	suggested_title: Nullable<string>;
	suggested_category_id: Nullable<string>;
	suggested_category_name: Nullable<string>;
	suggested_tags: string[];
	extracted_payload_json: Nullable<string>;
	extracted_document_date: Nullable<string>;
	extracted_merchant_name: Nullable<string>;
	extracted_amount: Nullable<number>;
	extracted_payment_status: Nullable<RawPaymentStatus>;
	error_message: Nullable<string>;
};

type VaultInboxActor = {
	list_my_inbox_documents: () => Promise<RawInboxDocumentRecord[]>;
	get_my_inbox_document: (documentId: string) => Promise<Nullable<RawInboxDocumentRecord>>;
	upsert_inbox_document: (
		input: RawInboxDocumentUpsertInput
	) => Promise<BackendResult<RawInboxDocumentRecord>>;
	update_inbox_ai_state: (
		input: RawInboxAiUpdateInput
	) => Promise<BackendResult<RawInboxDocumentRecord>>;
	mark_inbox_document_archived: (
		documentId: string,
		archivedAtNs: Nullable<bigint>
	) => Promise<BackendResult<RawInboxDocumentRecord>>;
	delete_inbox_document: (documentId: string) => Promise<{ Ok: null } | { Err: string }>;
	purge_my_expired_inbox_documents: (limit: Nullable<number>) => Promise<number>;
	analyze_inbox_with_onchain_llm: (
		input: RawInboxOnchainLlmRequest
	) => Promise<BackendResult<RawInboxOnchainLlmResponse>>;
};

function idlFactory({ IDL: idl }: { IDL: any }) {
	const InboxDocumentStatus = idl.Variant({
		Uploaded: idl.Null,
		Processing: idl.Null,
		ReadyForReview: idl.Null,
		Archived: idl.Null,
		Error: idl.Null
	});

	const InboxAnalysisStatus = idl.Variant({
		Idle: idl.Null,
		Queued: idl.Null,
		Processing: idl.Null,
		Completed: idl.Null,
		Error: idl.Null
	});

	const PaymentStatus = idl.Variant({
		Due: idl.Null,
		Paid: idl.Null
	});

	const InboxDocumentRecord = idl.Record({
		id: idl.Text,
		owner: idl.Principal,
		name: idl.Text,
		size_bytes: idl.Nat64,
		mime_type: idl.Text,
		source_blob_id: idl.Opt(idl.Text),
		preview_blob_id: idl.Opt(idl.Text),
		status: InboxDocumentStatus,
		analysis_status: idl.Opt(InboxAnalysisStatus),
		ocr_text: idl.Opt(idl.Text),
		suggested_title: idl.Opt(idl.Text),
		suggested_category_id: idl.Opt(idl.Text),
		suggested_category_name: idl.Opt(idl.Text),
		suggested_tags: idl.Vec(idl.Text),
		extracted_payload_json: idl.Opt(idl.Text),
		extracted_document_date: idl.Opt(idl.Text),
		extracted_merchant_name: idl.Opt(idl.Text),
		extracted_amount: idl.Opt(idl.Float64),
		extracted_payment_status: idl.Opt(PaymentStatus),
		error_message: idl.Opt(idl.Text),
		analysis_updated_at_ns: idl.Opt(idl.Nat64),
		created_at_ns: idl.Nat64,
		updated_at_ns: idl.Nat64,
		expires_at_ns: idl.Opt(idl.Nat64),
		archived_at_ns: idl.Opt(idl.Nat64)
	});

	const InboxDocumentResult = idl.Variant({ Ok: InboxDocumentRecord, Err: idl.Text });
	const UnitResult = idl.Variant({ Ok: idl.Null, Err: idl.Text });
	const InboxLlmLineItemRecord = idl.Record({
		description: idl.Text,
		amount: idl.Opt(idl.Float64),
		vat_rate: idl.Opt(idl.Float64)
	});
	const InboxLlmInvoiceDataRecord = idl.Record({
		invoice_type: idl.Opt(idl.Text),
		invoice_number: idl.Opt(idl.Text),
		supplier: idl.Opt(idl.Text),
		vat_number: idl.Opt(idl.Text),
		net_amount: idl.Opt(idl.Float64),
		vat_rate: idl.Opt(idl.Float64),
		vat_amount: idl.Opt(idl.Float64),
		total_amount: idl.Opt(idl.Float64),
		line_items: idl.Vec(InboxLlmLineItemRecord)
	});
	const InboxOnchainLlmRequest = idl.Record({
		file_name: idl.Text,
		mime_type: idl.Text,
		extracted_text: idl.Text,
		heuristic_category_name: idl.Opt(idl.Text),
		heuristic_merchant_name: idl.Opt(idl.Text),
		heuristic_document_date: idl.Opt(idl.Text),
		heuristic_amount: idl.Opt(idl.Float64)
	});
	const InboxOnchainLlmResponse = idl.Record({
		provider: idl.Text,
		model: idl.Text,
		title: idl.Opt(idl.Text),
		category_name: idl.Opt(idl.Text),
		tags: idl.Vec(idl.Text),
		document_date: idl.Opt(idl.Text),
		merchant_name: idl.Opt(idl.Text),
		amount: idl.Opt(idl.Float64),
		payment_status: idl.Opt(PaymentStatus),
		document_text_excerpt: idl.Opt(idl.Text),
		invoice_data: idl.Opt(InboxLlmInvoiceDataRecord)
	});
	const InboxOnchainLlmResult = idl.Variant({ Ok: InboxOnchainLlmResponse, Err: idl.Text });

	const InboxDocumentUpsertInput = idl.Record({
		id: idl.Opt(idl.Text),
		name: idl.Text,
		size_bytes: idl.Nat64,
		mime_type: idl.Text,
		source_blob_id: idl.Opt(idl.Text),
		preview_blob_id: idl.Opt(idl.Text),
		status: idl.Opt(InboxDocumentStatus),
		expires_at_ns: idl.Opt(idl.Nat64),
		created_at_ns: idl.Opt(idl.Nat64)
	});

	const InboxAiUpdateInput = idl.Record({
		document_id: idl.Text,
		status: InboxDocumentStatus,
		analysis_status: idl.Opt(InboxAnalysisStatus),
		ocr_text: idl.Opt(idl.Text),
		suggested_title: idl.Opt(idl.Text),
		suggested_category_id: idl.Opt(idl.Text),
		suggested_category_name: idl.Opt(idl.Text),
		suggested_tags: idl.Vec(idl.Text),
		extracted_payload_json: idl.Opt(idl.Text),
		extracted_document_date: idl.Opt(idl.Text),
		extracted_merchant_name: idl.Opt(idl.Text),
		extracted_amount: idl.Opt(idl.Float64),
		extracted_payment_status: idl.Opt(PaymentStatus),
		error_message: idl.Opt(idl.Text)
	});

	return idl.Service({
		list_my_inbox_documents: idl.Func([], [idl.Vec(InboxDocumentRecord)], []),
		get_my_inbox_document: idl.Func([idl.Text], [idl.Opt(InboxDocumentRecord)], []),
		upsert_inbox_document: idl.Func([InboxDocumentUpsertInput], [InboxDocumentResult], []),
		update_inbox_ai_state: idl.Func([InboxAiUpdateInput], [InboxDocumentResult], []),
		analyze_inbox_with_onchain_llm: idl.Func(
			[InboxOnchainLlmRequest],
			[InboxOnchainLlmResult],
			[]
		),
		mark_inbox_document_archived: idl.Func(
			[idl.Text, idl.Opt(idl.Nat64)],
			[InboxDocumentResult],
			[]
		),
		delete_inbox_document: idl.Func([idl.Text], [UnitResult], []),
		purge_my_expired_inbox_documents: idl.Func([idl.Opt(idl.Nat32)], [idl.Nat32], [])
	});
}

function resolveVaultInboxCanisterId() {
	if (!browser) {
		return null;
	}

	const env = safeGetCanisterEnv<{ readonly ['PUBLIC_CANISTER_ID:vault_inbox']: string }>();
	return import.meta.env.VITE_VAULT_INBOX_CANISTER_ID || env?.['PUBLIC_CANISTER_ID:vault_inbox'] || null;
}

function resolveHost() {
	return import.meta.env.VITE_ICP_HOST || 'http://127.0.0.1:4943';
}

export function isVaultInboxConfigured() {
	return Boolean(resolveVaultInboxCanisterId());
}

let authClientPromise: Promise<AuthClient> | null = null;

async function getAuthClient() {
	if (!authClientPromise) {
		authClientPromise = AuthClient.create();
	}

	return authClientPromise;
}

async function getActor(): Promise<VaultInboxActor | null> {
	if (!browser) {
		return null;
	}

	const canisterId = resolveVaultInboxCanisterId();
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

	return Actor.createActor<VaultInboxActor>(idlFactory, {
		agent,
		canisterId
	});
}

function optionToUndefined<T>(value: Nullable<T>): T | undefined {
	return value.length ? value[0] : undefined;
}

function unwrapResult<T>(result: BackendResult<T>): T {
	if ('Err' in result) {
		throw new Error(result.Err);
	}

	return result.Ok;
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

	return BigInt(new Date(value).getTime()) * BigInt(1_000_000);
}

function toOptText(value: string | undefined) {
	return value && value.trim()
		? ([value.trim()] as Nullable<string>)
		: ([] as Nullable<string>);
}

function mapInboxDocumentStatus(value: RawInboxDocumentStatus): InboxDocumentStatus {
	if ('Processing' in value) return 'processing';
	if ('ReadyForReview' in value) return 'ready_for_review';
	if ('Archived' in value) return 'archived';
	if ('Error' in value) return 'error';
	return 'uploaded';
}

function mapInboxAnalysisStatus(value: RawInboxAnalysisStatus): InboxAnalysisStatus {
	if ('Queued' in value) return 'queued';
	if ('Processing' in value) return 'processing';
	if ('Completed' in value) return 'completed';
	if ('Error' in value) return 'error';
	return 'idle';
}

function toRawInboxDocumentStatus(value: InboxDocumentStatus): RawInboxDocumentStatus {
	if (value === 'processing') return { Processing: null };
	if (value === 'ready_for_review') return { ReadyForReview: null };
	if (value === 'archived') return { Archived: null };
	if (value === 'error') return { Error: null };
	return { Uploaded: null };
}

function toRawInboxAnalysisStatus(value: InboxAnalysisStatus): RawInboxAnalysisStatus {
	if (value === 'queued') return { Queued: null };
	if (value === 'processing') return { Processing: null };
	if (value === 'completed') return { Completed: null };
	if (value === 'error') return { Error: null };
	return { Idle: null };
}

function mapPaymentStatus(value: RawPaymentStatus): 'due' | 'paid' {
	return 'Due' in value ? 'due' : 'paid';
}

function mapRawInvoiceData(raw: RawInboxLlmInvoiceDataRecord | undefined) {
	if (!raw) {
		return undefined;
	}

	const invoiceType = optionToUndefined(raw.invoice_type);

	return {
		invoiceType: invoiceType === 'emessa' ? 'emessa' : 'ricevuta',
		invoiceNumber: optionToUndefined(raw.invoice_number),
		supplier: optionToUndefined(raw.supplier),
		vatNumber: optionToUndefined(raw.vat_number),
		netAmount: optionToUndefined(raw.net_amount),
		vatRate: optionToUndefined(raw.vat_rate),
		vatAmount: optionToUndefined(raw.vat_amount),
		totalAmount: optionToUndefined(raw.total_amount),
		lineItems: raw.line_items.map((item) => ({
			description: item.description,
			amount: optionToUndefined(item.amount),
			vatRate: optionToUndefined(item.vat_rate)
		}))
	};
}

function toRawPaymentStatus(value: 'due' | 'paid'): RawPaymentStatus {
	return value === 'due' ? { Due: null } : { Paid: null };
}

function mapInboxDocument(raw: RawInboxDocumentRecord): InboxDocument {
	const analysisStatus = optionToUndefined(raw.analysis_status);
	const extractedPaymentStatus = optionToUndefined(raw.extracted_payment_status);

	return {
		id: raw.id,
		name: raw.name,
		size: Number(raw.size_bytes),
		type: raw.mime_type,
		sourceBlobId: optionToUndefined(raw.source_blob_id),
		previewBlobId: optionToUndefined(raw.preview_blob_id),
		status: mapInboxDocumentStatus(raw.status),
		analysisStatus: analysisStatus ? mapInboxAnalysisStatus(analysisStatus) : undefined,
		ocrText: optionToUndefined(raw.ocr_text),
		suggestedTitle: optionToUndefined(raw.suggested_title),
		suggestedCategoryId: optionToUndefined(raw.suggested_category_id),
		suggestedCategoryName: optionToUndefined(raw.suggested_category_name),
		suggestedTags: raw.suggested_tags,
		extractedPayloadJson: optionToUndefined(raw.extracted_payload_json),
		extractedDocumentDate: optionToUndefined(raw.extracted_document_date),
		extractedMerchantName: optionToUndefined(raw.extracted_merchant_name),
		extractedAmount: optionToUndefined(raw.extracted_amount),
		extractedPaymentStatus: extractedPaymentStatus
			? mapPaymentStatus(extractedPaymentStatus)
			: undefined,
		errorMessage: optionToUndefined(raw.error_message),
		analysisUpdatedAt:
			bigintToIso(optionToUndefined(raw.analysis_updated_at_ns)) ?? undefined,
		createdAt: bigintToIso(raw.created_at_ns) ?? new Date().toISOString(),
		updatedAt: bigintToIso(raw.updated_at_ns) ?? new Date().toISOString(),
		expiresAt: bigintToIso(optionToUndefined(raw.expires_at_ns)) ?? undefined,
		archivedAt: bigintToIso(optionToUndefined(raw.archived_at_ns)) ?? undefined
	};
}

export async function listMyInboxDocuments() {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const documents = await actor.list_my_inbox_documents();
	return documents.map(mapInboxDocument);
}

export async function getMyInboxDocument(documentId: string) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.get_my_inbox_document(documentId);
	return result.length ? mapInboxDocument(result[0]) : null;
}

export async function upsertInboxDocument(input: {
	id?: string;
	name: string;
	size: number;
	type: string;
	sourceBlobId?: string;
	previewBlobId?: string;
	status?: InboxDocumentStatus;
	expiresAt?: string;
	createdAt?: string;
}) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.upsert_inbox_document({
		id: toOptText(input.id),
		name: input.name,
		size_bytes: BigInt(input.size),
		mime_type: input.type,
		source_blob_id: toOptText(input.sourceBlobId),
		preview_blob_id: toOptText(input.previewBlobId),
		status: input.status ? [toRawInboxDocumentStatus(input.status)] : [],
		expires_at_ns: input.expiresAt ? [isoToBigint(input.expiresAt)] : [],
		created_at_ns: input.createdAt ? [isoToBigint(input.createdAt)] : []
	});

	return mapInboxDocument(unwrapResult(result));
}

export async function updateInboxAiState(input: {
	documentId: string;
	status: InboxDocumentStatus;
	analysisStatus?: InboxAnalysisStatus;
	ocrText?: string;
	suggestedTitle?: string;
	suggestedCategoryId?: string;
	suggestedCategoryName?: string;
	suggestedTags?: string[];
	extractedPayloadJson?: string;
	extractedDocumentDate?: string;
	extractedMerchantName?: string;
	extractedAmount?: number;
	extractedPaymentStatus?: 'due' | 'paid';
	errorMessage?: string;
}) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.update_inbox_ai_state({
		document_id: input.documentId,
		status: toRawInboxDocumentStatus(input.status),
		analysis_status: input.analysisStatus
			? [toRawInboxAnalysisStatus(input.analysisStatus)]
			: [],
		ocr_text: toOptText(input.ocrText),
		suggested_title: toOptText(input.suggestedTitle),
		suggested_category_id: toOptText(input.suggestedCategoryId),
		suggested_category_name: toOptText(input.suggestedCategoryName),
		suggested_tags: input.suggestedTags ?? [],
		extracted_payload_json: toOptText(input.extractedPayloadJson),
		extracted_document_date: toOptText(input.extractedDocumentDate),
		extracted_merchant_name: toOptText(input.extractedMerchantName),
		extracted_amount:
			typeof input.extractedAmount === 'number' && Number.isFinite(input.extractedAmount)
				? [input.extractedAmount]
				: [],
		extracted_payment_status: input.extractedPaymentStatus
			? [toRawPaymentStatus(input.extractedPaymentStatus)]
			: [],
		error_message: toOptText(input.errorMessage)
	});

	return mapInboxDocument(unwrapResult(result));
}

export async function markInboxDocumentArchived(documentId: string, archivedAt?: string) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.mark_inbox_document_archived(
		documentId,
		archivedAt ? [isoToBigint(archivedAt)] : []
	);

	return mapInboxDocument(unwrapResult(result));
}

export async function deleteInboxDocument(documentId: string) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.delete_inbox_document(documentId);
	if ('Err' in result) {
		throw new Error(result.Err);
	}

	return true;
}

export async function purgeMyExpiredInboxDocuments(limit?: number) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	return await actor.purge_my_expired_inbox_documents(
		typeof limit === 'number' && Number.isFinite(limit) ? [limit] : []
	);
}

export async function analyzeInboxWithOnchainLlm(input: {
	fileName: string;
	mimeType: string;
	extractedText: string;
	heuristicCategoryName?: string;
	heuristicMerchantName?: string;
	heuristicDocumentDate?: string;
	heuristicAmount?: number;
}) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.analyze_inbox_with_onchain_llm({
		file_name: input.fileName,
		mime_type: input.mimeType,
		extracted_text: input.extractedText,
		heuristic_category_name: toOptText(input.heuristicCategoryName),
		heuristic_merchant_name: toOptText(input.heuristicMerchantName),
		heuristic_document_date: toOptText(input.heuristicDocumentDate),
		heuristic_amount:
			typeof input.heuristicAmount === 'number' && Number.isFinite(input.heuristicAmount)
				? [input.heuristicAmount]
				: []
	});

	const raw = unwrapResult(result);
	return {
		provider: raw.provider,
		model: raw.model,
		title: optionToUndefined(raw.title),
		categoryName: optionToUndefined(raw.category_name),
		tags: raw.tags,
		documentDate: optionToUndefined(raw.document_date),
		merchantName: optionToUndefined(raw.merchant_name),
		amount: optionToUndefined(raw.amount),
		paymentStatus: optionToUndefined(raw.payment_status)
			? mapPaymentStatus(optionToUndefined(raw.payment_status)!)
			: undefined,
		documentTextExcerpt: optionToUndefined(raw.document_text_excerpt),
		invoiceData: mapRawInvoiceData(optionToUndefined(raw.invoice_data))
	};
}
