import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { authState } from '$lib/auth';
import type { DocumentCryptoState } from '$lib/types';
import {
	createRandomAesKey,
	bytesToBase64,
	exportAesKeyRaw,
	importAesKeyRaw,
	unwrapRawKeyWithAesGcm,
	wrapRawKeyWithAesGcm,
	base64ToBytes
} from '$lib/crypto/clientEncryption';
import {
	fetchEncryptedUserVetKey,
	fetchRemoteVetKeyConfig,
	fetchUserVetKeyPublicKey,
	isVaultBackendConfigured,
} from '$lib/ic/vaultBackend';
import {
	DerivedPublicKey,
	EncryptedVetKey,
	TransportSecretKey
} from '@dfinity/vetkeys';
import { Principal } from '@dfinity/principal';

const LOCAL_USER_KEY_PREFIX = 'fatturavault-local-user-key:';
const II_WRAPPING_ENABLED = import.meta.env.VITE_ENABLE_II_DERIVED_WRAPPING === 'true';
let cachedIiWrappingKeyPrincipal: string | null = null;
let cachedIiWrappingKeyPromise: Promise<CryptoKey> | null = null;

function requirePrincipal() {
	const principal = get(authState).principal;
	if (!browser || !principal) {
		throw new Error('Utente non autenticato per la cifratura locale.');
	}

	return principal;
}

async function getOrCreateLocalUserWrappingKey() {
	const principal = requirePrincipal();
	const storageKey = `${LOCAL_USER_KEY_PREFIX}${principal}`;
	const stored = localStorage.getItem(storageKey);

	if (stored) {
		return importAesKeyRaw(base64ToBytes(stored));
	}

	const key = await createRandomAesKey();
	const rawKey = await exportAesKeyRaw(key);
	localStorage.setItem(storageKey, bytesToBase64(rawKey));
	return importAesKeyRaw(rawKey);
}

async function wrapDocumentKeyWithLocalProvider(documentKey: CryptoKey) {
	const wrappingKey = await getOrCreateLocalUserWrappingKey();
	const rawDocumentKey = await exportAesKeyRaw(documentKey);
	const wrapped = await wrapRawKeyWithAesGcm(rawDocumentKey, wrappingKey);

	return {
		keyWrapping: 'local-browser-v1' as const,
		wrappedDocumentKeyBase64: wrapped.wrappedKeyBase64,
		wrappingIvBase64: wrapped.wrappingIvBase64
	};
}

async function unwrapDocumentKeyWithLocalProvider(cryptoState: DocumentCryptoState) {
	if (!cryptoState.wrappedDocumentKeyBase64 || !cryptoState.wrappingIvBase64) {
		throw new Error('Chiave documento non disponibile.');
	}

	const wrappingKey = await getOrCreateLocalUserWrappingKey();
	const rawDocumentKey = await unwrapRawKeyWithAesGcm(
		cryptoState.wrappedDocumentKeyBase64,
		cryptoState.wrappingIvBase64,
		wrappingKey
	);

	return importAesKeyRaw(rawDocumentKey);
}

async function deriveIiWrappingKey(principalText: string) {
	const config = await fetchRemoteVetKeyConfig();
	if (!config) {
		throw new Error('Configurazione vetKey non disponibile.');
	}

	const publicKeyBytes = await fetchUserVetKeyPublicKey();
	if (!publicKeyBytes) {
		throw new Error('Public key vetKey non disponibile.');
	}

	const transportSecretKey = TransportSecretKey.random();
	const encryptedVetKey = await fetchEncryptedUserVetKey(transportSecretKey.publicKeyBytes());
	if (!encryptedVetKey) {
		throw new Error('vetKey non disponibile per l’utente corrente.');
	}

	const derivedPublicKey = DerivedPublicKey.deserialize(publicKeyBytes);
	const input = Principal.fromText(principalText).toUint8Array();
	const vetKey = EncryptedVetKey.deserialize(encryptedVetKey).decryptAndVerify(
		transportSecretKey,
		derivedPublicKey,
		input
	);
	const derivedKeyMaterial = await vetKey.asDerivedKeyMaterial();

	return derivedKeyMaterial.deriveAesGcmCryptoKey(config.aesDomainSeparator);
}

async function getIiDerivedWrappingKey() {
	const principal = requirePrincipal();

	if (cachedIiWrappingKeyPromise && cachedIiWrappingKeyPrincipal === principal) {
		return cachedIiWrappingKeyPromise;
	}

	cachedIiWrappingKeyPrincipal = principal;
	cachedIiWrappingKeyPromise = deriveIiWrappingKey(principal).catch((error) => {
		cachedIiWrappingKeyPromise = null;
		throw error;
	});

	return cachedIiWrappingKeyPromise;
}

async function wrapDocumentKeyWithIiProvider(documentKey: CryptoKey) {
	const wrappingKey = await getIiDerivedWrappingKey();
	const rawDocumentKey = await exportAesKeyRaw(documentKey);
	const wrapped = await wrapRawKeyWithAesGcm(rawDocumentKey, wrappingKey);

	return {
		keyWrapping: 'ii-derived-v1' as const,
		wrappedDocumentKeyBase64: wrapped.wrappedKeyBase64,
		wrappingIvBase64: wrapped.wrappingIvBase64
	};
}

async function unwrapDocumentKeyWithIiProvider(cryptoState: DocumentCryptoState) {
	if (!cryptoState.wrappedDocumentKeyBase64 || !cryptoState.wrappingIvBase64) {
		throw new Error('Chiave documento non disponibile.');
	}

	const wrappingKey = await getIiDerivedWrappingKey();
	const rawDocumentKey = await unwrapRawKeyWithAesGcm(
		cryptoState.wrappedDocumentKeyBase64,
		cryptoState.wrappingIvBase64,
		wrappingKey
	);

	return importAesKeyRaw(rawDocumentKey);
}

export async function wrapDocumentKeyForCurrentUser(documentKey: CryptoKey) {
	if (II_WRAPPING_ENABLED && isVaultBackendConfigured()) {
		try {
			return await wrapDocumentKeyWithIiProvider(documentKey);
		} catch (error) {
			console.warn(
				'Impossibile usare il provider chiave legato a Internet Identity, fallback locale.',
				error
			);
		}
	}

	return wrapDocumentKeyWithLocalProvider(documentKey);
}

export async function unwrapDocumentKeyForCurrentUser(cryptoState: DocumentCryptoState) {
	if (cryptoState.keyWrapping === 'ii-derived-v1') {
		return unwrapDocumentKeyWithIiProvider(cryptoState);
	}

	return unwrapDocumentKeyWithLocalProvider(cryptoState);
}

export async function migrateDocumentCryptoStateToStableProvider(
	cryptoState: DocumentCryptoState
) {
	if (cryptoState.keyWrapping !== 'ii-derived-v1') {
		return cryptoState;
	}

	const documentKey = await unwrapDocumentKeyWithIiProvider(cryptoState);
	const wrapped = await wrapDocumentKeyWithLocalProvider(documentKey);

	return {
		...cryptoState,
		keyWrapping: wrapped.keyWrapping,
		wrappedDocumentKeyBase64: wrapped.wrappedDocumentKeyBase64,
		wrappingIvBase64: wrapped.wrappingIvBase64
	} satisfies DocumentCryptoState;
}
