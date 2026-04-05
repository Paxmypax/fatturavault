import { browser } from '$app/environment';
import { AuthClient } from '@icp-sdk/auth/client';
import { Actor, HttpAgent } from '@icp-sdk/core/agent';
import { safeGetCanisterEnv } from '@icp-sdk/core/agent/canister-env';
import { sha256Hex } from '$lib/crypto/clientEncryption';

type StorageResult<T> = { Ok: T } | { Err: StorageError };

type StorageError =
	| { NotFound: null }
	| { Unauthorized: null }
	| { AlreadyExists: null }
	| { InvalidChunkIndex: null }
	| { InvalidState: null }
	| { InvalidChecksum: null }
	| { TooLarge: null }
	| { Message: string };

type RawBlobKind = { Original: null } | { Preview: null };

type RawBlobManifest = {
	blob_id: string;
	owner: unknown;
	document_id: string;
	kind: RawBlobKind;
	mime_type: string;
	total_size: bigint;
	chunk_count: number | bigint;
	sha256_hex: string;
	created_at_ns: bigint;
	finalized: boolean;
};

type VaultStorageActor = {
	create_blob: (input: {
		document_id: string;
		kind: RawBlobKind;
		mime_type: string;
		total_size: bigint;
		chunk_count: number;
		sha256_hex: string;
	}) => Promise<StorageResult<RawBlobManifest>>;
	upload_blob_chunk: (input: {
		blob_id: string;
		chunk_index: number;
		bytes: Uint8Array;
	}) => Promise<StorageResult<null>>;
	finalize_blob: (blobId: string) => Promise<StorageResult<null>>;
	get_blob_manifest: (blobId: string) => Promise<[] | [RawBlobManifest]>;
	get_blob_chunk: (blobId: string, chunkIndex: number) => Promise<StorageResult<Uint8Array | number[]>>;
	delete_blob: (blobId: string) => Promise<StorageResult<null>>;
};

const CHUNK_SIZE = 900_000;

function idlFactory({ IDL: idl }: { IDL: any }) {
	const BlobKind = idl.Variant({
		Original: idl.Null,
		Preview: idl.Null
	});

	const BlobManifest = idl.Record({
		blob_id: idl.Text,
		owner: idl.Principal,
		document_id: idl.Text,
		kind: BlobKind,
		mime_type: idl.Text,
		total_size: idl.Nat64,
		chunk_count: idl.Nat32,
		sha256_hex: idl.Text,
		created_at_ns: idl.Nat64,
		finalized: idl.Bool
	});

	const StorageError = idl.Variant({
		NotFound: idl.Null,
		Unauthorized: idl.Null,
		AlreadyExists: idl.Null,
		InvalidChunkIndex: idl.Null,
		InvalidState: idl.Null,
		InvalidChecksum: idl.Null,
		TooLarge: idl.Null,
		Message: idl.Text
	});

	const BlobManifestResult = idl.Variant({ Ok: BlobManifest, Err: StorageError });
	const StorageResult = idl.Variant({ Ok: idl.Null, Err: StorageError });
	const BlobChunkResult = idl.Variant({ Ok: idl.Vec(idl.Nat8), Err: StorageError });

	const BlobCreateInput = idl.Record({
		document_id: idl.Text,
		kind: BlobKind,
		mime_type: idl.Text,
		total_size: idl.Nat64,
		chunk_count: idl.Nat32,
		sha256_hex: idl.Text
	});

	const BlobChunkInput = idl.Record({
		blob_id: idl.Text,
		chunk_index: idl.Nat32,
		bytes: idl.Vec(idl.Nat8)
	});

	return idl.Service({
		create_blob: idl.Func([BlobCreateInput], [BlobManifestResult], []),
		upload_blob_chunk: idl.Func([BlobChunkInput], [StorageResult], []),
		finalize_blob: idl.Func([idl.Text], [StorageResult], []),
		get_blob_manifest: idl.Func([idl.Text], [idl.Opt(BlobManifest)], []),
		get_blob_chunk: idl.Func([idl.Text, idl.Nat32], [BlobChunkResult], []),
		delete_blob: idl.Func([idl.Text], [StorageResult], [])
	});
}

function resolveVaultStorageCanisterId() {
	if (!browser) {
		return null;
	}

	const env = safeGetCanisterEnv<{ readonly ['PUBLIC_CANISTER_ID:vault_storage']: string }>();
	return (
		import.meta.env.VITE_VAULT_STORAGE_CANISTER_ID ||
		env?.['PUBLIC_CANISTER_ID:vault_storage'] ||
		null
	);
}

function resolveHost() {
	return import.meta.env.VITE_ICP_HOST || 'http://127.0.0.1:4943';
}

export function isVaultStorageConfigured() {
	return Boolean(resolveVaultStorageCanisterId());
}

let authClientPromise: Promise<AuthClient> | null = null;

async function getAuthClient() {
	if (!authClientPromise) {
		authClientPromise = AuthClient.create();
	}

	return authClientPromise;
}

async function getActor(): Promise<VaultStorageActor | null> {
	if (!browser) {
		return null;
	}

	const canisterId = resolveVaultStorageCanisterId();
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

	return Actor.createActor<VaultStorageActor>(idlFactory, {
		agent,
		canisterId
	});
}

function unwrapResult<T>(result: StorageResult<T>): T {
	if ('Err' in result) {
		if ('Message' in result.Err) {
			throw new Error(result.Err.Message);
		}
		throw new Error(Object.keys(result.Err)[0] ?? 'Storage error');
	}

	return result.Ok;
}

function toRawKind(kind: 'original' | 'preview'): RawBlobKind {
	return kind === 'preview' ? { Preview: null } : { Original: null };
}

function bytesFromChunk(value: Uint8Array | number[]) {
	return value instanceof Uint8Array ? value : Uint8Array.from(value);
}

function splitIntoChunks(bytes: Uint8Array) {
	const chunks: Uint8Array[] = [];
	for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
		chunks.push(bytes.slice(offset, offset + CHUNK_SIZE));
	}
	return chunks;
}

async function readBlobBytes(blob: Blob) {
	return new Uint8Array(await blob.arrayBuffer());
}

export async function uploadBlobForDocument(input: {
	documentId: string;
	kind: 'original' | 'preview';
	mimeType: string;
	blob: Blob;
}) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const bytes = await readBlobBytes(input.blob);
	const chunks = splitIntoChunks(bytes);
	const manifest = unwrapResult(
		await actor.create_blob({
			document_id: input.documentId,
			kind: toRawKind(input.kind),
			mime_type: input.mimeType || 'application/octet-stream',
			total_size: BigInt(bytes.length),
			chunk_count: chunks.length || 1,
			sha256_hex: await sha256Hex(bytes)
		})
	);

	for (let index = 0; index < chunks.length; index += 1) {
		unwrapResult(
			await actor.upload_blob_chunk({
				blob_id: manifest.blob_id,
				chunk_index: index,
				bytes: chunks[index]
			})
		);
	}

	unwrapResult(await actor.finalize_blob(manifest.blob_id));
	return manifest.blob_id;
}

export async function downloadBlobBytes(blobId: string) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	const manifestOpt = await actor.get_blob_manifest(blobId);
	const manifest = manifestOpt.length ? manifestOpt[0] : null;
	if (!manifest) {
		return null;
	}

	const chunkCount = Number(manifest.chunk_count);
	const parts: Uint8Array[] = [];
	for (let index = 0; index < chunkCount; index += 1) {
		const chunk = unwrapResult(await actor.get_blob_chunk(blobId, index));
		parts.push(bytesFromChunk(chunk));
	}

	const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
	const merged = new Uint8Array(totalLength);
	let offset = 0;
	for (const part of parts) {
		merged.set(part, offset);
		offset += part.length;
	}

	return {
		bytes: merged,
		mimeType: manifest.mime_type
	};
}

export async function deleteBlob(blobId: string) {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	unwrapResult(await actor.delete_blob(blobId));
	return true;
}
