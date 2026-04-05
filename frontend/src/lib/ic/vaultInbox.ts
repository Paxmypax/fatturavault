import { browser } from '$app/environment';
import { AuthClient } from '@icp-sdk/auth/client';
import { Actor, HttpAgent } from '@icp-sdk/core/agent';
import { safeGetCanisterEnv } from '@icp-sdk/core/agent/canister-env';
import type { InboxDocument, InboxDocumentStatus } from '$lib/types';

export type { InboxDocumentStatus } from '$lib/types';

type BackendResult<T> = { Ok: T } | { Err: string };
type Nullable<T> = [] | [T];

type RawInboxDocumentStatus =
	| { Uploaded: null }
	| { Processing: null }
	| { ReadyForReview: null }
	| { Archived: null }
	| { Error: null };

type RawInboxDocumentRecord = {
	id: string;
	owner: unknown;
	name: string;
	size_bytes: number | bigint;
	mime_type: string;
	source_blob_id: Nullable<string>;
	preview_blob_id: Nullable<string>;
	status: RawInboxDocumentStatus;
	ocr_text: Nullable<string>;
	suggested_title: Nullable<string>;
	suggested_category_id: Nullable<string>;
	suggested_category_name: Nullable<string>;
	suggested_tags: string[];
	extracted_payload_json: Nullable<string>;
	error_message: Nullable<string>;
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
	ocr_text: Nullable<string>;
	suggested_title: Nullable<string>;
	suggested_category_id: Nullable<string>;
	suggested_category_name: Nullable<string>;
	suggested_tags: string[];
	extracted_payload_json: Nullable<string>;
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
};

function idlFactory({ IDL: idl }: { IDL: any }) {
	const InboxDocumentStatus = idl.Variant({
		Uploaded: idl.Null,
		Processing: idl.Null,
		ReadyForReview: idl.Null,
		Archived: idl.Null,
		Error: idl.Null
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
		ocr_text: idl.Opt(idl.Text),
		suggested_title: idl.Opt(idl.Text),
		suggested_category_id: idl.Opt(idl.Text),
		suggested_category_name: idl.Opt(idl.Text),
		suggested_tags: idl.Vec(idl.Text),
		extracted_payload_json: idl.Opt(idl.Text),
		error_message: idl.Opt(idl.Text),
		created_at_ns: idl.Nat64,
		updated_at_ns: idl.Nat64,
		expires_at_ns: idl.Opt(idl.Nat64),
		archived_at_ns: idl.Opt(idl.Nat64)
	});

	const InboxDocumentResult = idl.Variant({ Ok: InboxDocumentRecord, Err: idl.Text });
	const UnitResult = idl.Variant({ Ok: idl.Null, Err: idl.Text });

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
		ocr_text: idl.Opt(idl.Text),
		suggested_title: idl.Opt(idl.Text),
		suggested_category_id: idl.Opt(idl.Text),
		suggested_category_name: idl.Opt(idl.Text),
		suggested_tags: idl.Vec(idl.Text),
		extracted_payload_json: idl.Opt(idl.Text),
		error_message: idl.Opt(idl.Text)
	});

	return idl.Service({
		list_my_inbox_documents: idl.Func([], [idl.Vec(InboxDocumentRecord)], []),
		get_my_inbox_document: idl.Func([idl.Text], [idl.Opt(InboxDocumentRecord)], []),
		upsert_inbox_document: idl.Func([InboxDocumentUpsertInput], [InboxDocumentResult], []),
		update_inbox_ai_state: idl.Func([InboxAiUpdateInput], [InboxDocumentResult], []),
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

function toRawInboxDocumentStatus(value: InboxDocumentStatus): RawInboxDocumentStatus {
	if (value === 'processing') return { Processing: null };
	if (value === 'ready_for_review') return { ReadyForReview: null };
	if (value === 'archived') return { Archived: null };
	if (value === 'error') return { Error: null };
	return { Uploaded: null };
}

function mapInboxDocument(raw: RawInboxDocumentRecord): InboxDocument {
	return {
		id: raw.id,
		name: raw.name,
		size: Number(raw.size_bytes),
		type: raw.mime_type,
		sourceBlobId: optionToUndefined(raw.source_blob_id),
		previewBlobId: optionToUndefined(raw.preview_blob_id),
		status: mapInboxDocumentStatus(raw.status),
		ocrText: optionToUndefined(raw.ocr_text),
		suggestedTitle: optionToUndefined(raw.suggested_title),
		suggestedCategoryId: optionToUndefined(raw.suggested_category_id),
		suggestedCategoryName: optionToUndefined(raw.suggested_category_name),
		suggestedTags: raw.suggested_tags,
		extractedPayloadJson: optionToUndefined(raw.extracted_payload_json),
		errorMessage: optionToUndefined(raw.error_message),
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
	ocrText?: string;
	suggestedTitle?: string;
	suggestedCategoryId?: string;
	suggestedCategoryName?: string;
	suggestedTags?: string[];
	extractedPayloadJson?: string;
	errorMessage?: string;
}) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const result = await actor.update_inbox_ai_state({
		document_id: input.documentId,
		status: toRawInboxDocumentStatus(input.status),
		ocr_text: toOptText(input.ocrText),
		suggested_title: toOptText(input.suggestedTitle),
		suggested_category_id: toOptText(input.suggestedCategoryId),
		suggested_category_name: toOptText(input.suggestedCategoryName),
		suggested_tags: input.suggestedTags ?? [],
		extracted_payload_json: toOptText(input.extractedPayloadJson),
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
