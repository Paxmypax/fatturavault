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

export type EncryptedBytesResult = {
	ciphertext: Uint8Array;
	metadata: BlobEncryptionMetadata;
};

export function bytesToBase64(bytes: Uint8Array) {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

export function base64ToBytes(value: string) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

function asArrayBuffer(bytes: Uint8Array) {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function sha256Hex(bytes: Uint8Array) {
	const digest = await crypto.subtle.digest('SHA-256', asArrayBuffer(bytes));
	return Array.from(new Uint8Array(digest))
		.map((part) => part.toString(16).padStart(2, '0'))
		.join('');
}

export async function createRandomAesKey() {
	return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportAesKeyRaw(key: CryptoKey) {
	return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

export async function importAesKeyRaw(rawKey: Uint8Array) {
	return crypto.subtle.importKey('raw', asArrayBuffer(rawKey), { name: 'AES-GCM' }, false, [
		'encrypt',
		'decrypt'
	]);
}

export async function encryptBytesWithAesGcm(plaintext: Uint8Array, key: CryptoKey) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertextBuffer = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		asArrayBuffer(plaintext)
	);
	const ciphertext = new Uint8Array(ciphertextBuffer);

	return {
		ciphertext,
		metadata: {
			version: 1,
			algorithm: 'AES-GCM-256',
			ivBase64: bytesToBase64(iv),
			plaintextSha256Hex: await sha256Hex(plaintext),
			ciphertextSha256Hex: await sha256Hex(ciphertext),
			plaintextSize: plaintext.byteLength,
			ciphertextSize: ciphertext.byteLength
		}
	} satisfies EncryptedBytesResult;
}

export async function decryptBytesWithAesGcm(
	ciphertext: Uint8Array,
	key: CryptoKey,
	metadata: BlobEncryptionMetadata
) {
	const iv = base64ToBytes(metadata.ivBase64);
	const plaintextBuffer = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv },
		key,
		asArrayBuffer(ciphertext)
	);
	return new Uint8Array(plaintextBuffer);
}

export async function decryptBytesWithIvBase64(
	ciphertext: Uint8Array,
	key: CryptoKey,
	ivBase64: string
) {
	const iv = base64ToBytes(ivBase64);
	const plaintextBuffer = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv },
		key,
		asArrayBuffer(ciphertext)
	);
	return new Uint8Array(plaintextBuffer);
}

export async function encryptBlobWithAesGcm(blob: Blob, key: CryptoKey) {
	const plaintext = new Uint8Array(await blob.arrayBuffer());
	const result = await encryptBytesWithAesGcm(plaintext, key);

	return {
		ciphertextBlob: new Blob([result.ciphertext], {
			type: 'application/octet-stream'
		}),
		metadata: result.metadata
	};
}

export async function decryptBlobWithAesGcm(
	ciphertextBlob: Blob,
	key: CryptoKey,
	metadata: BlobEncryptionMetadata,
	outputMimeType: string
) {
	const ciphertext = new Uint8Array(await ciphertextBlob.arrayBuffer());
	const plaintext = await decryptBytesWithAesGcm(ciphertext, key, metadata);
	return new Blob([plaintext], { type: outputMimeType });
}

export async function wrapRawKeyWithAesGcm(rawKey: Uint8Array, wrappingKey: CryptoKey) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertextBuffer = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		wrappingKey,
		asArrayBuffer(rawKey)
	);

	return {
		wrappedKeyBase64: bytesToBase64(new Uint8Array(ciphertextBuffer)),
		wrappingIvBase64: bytesToBase64(iv)
	};
}

export async function unwrapRawKeyWithAesGcm(
	wrappedKeyBase64: string,
	wrappingIvBase64: string,
	wrappingKey: CryptoKey
) {
	return decryptBytesWithIvBase64(base64ToBytes(wrappedKeyBase64), wrappingKey, wrappingIvBase64);
}
