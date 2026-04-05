import { browser } from '$app/environment';
import {
	AuthClient,
	IdbStorage,
	KEY_STORAGE_DELEGATION,
	KEY_STORAGE_KEY
} from '@icp-sdk/auth/client';
import { Principal } from '@dfinity/principal';
import { get, writable } from 'svelte/store';
import {
	fetchRemoteProfile,
	isVaultBackendConfigured,
	upsertRemoteProfile
} from '$lib/ic/vaultBackend';
import { trackAnalyticsEvent } from '$lib/ic/vaultAnalytics';

type LoginIntent = 'hero' | 'dashboard';

export type SecurityState = {
	ackRecoveryPhrase: boolean;
	ackBackupDevice: boolean;
	ackRiskUnderstood: boolean;
	completedAt: string | null;
};

type AuthState = {
	ready: boolean;
	pending: boolean;
	authenticated: boolean;
	principal: string | null;
	displayName: string | null;
	security: SecurityState | null;
};

const LOGIN_INTENT_KEY = 'fatturavault-login-intent';
const DISPLAY_NAME_PREFIX = 'fatturavault-display-name:';
const SECURITY_STATE_PREFIX = 'fatturavault-security:';
const AUTH_STORAGE_VECTOR_KEY = 'iv';

const authStateStore = writable<AuthState>({
	ready: false,
	pending: false,
	authenticated: false,
	principal: null,
	displayName: null,
	security: null
});

let authClientPromise: Promise<AuthClient> | null = null;
let authInitPromise: Promise<void> | null = null;

function isLocalIcEnvironment() {
	if (!browser) {
		return false;
	}

	const host = window.location.hostname;
	return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
}

function getIdentityProviderUrl() {
	if (!browser) {
		return 'https://id.ai';
	}

	if (import.meta.env.VITE_II_URL) {
		return import.meta.env.VITE_II_URL;
	}

	if (isLocalIcEnvironment()) {
		return 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.raw.localhost:8000';
	}

	return 'https://id.ai';
}

function getDerivationOrigin() {
	if (!browser) {
		return undefined;
	}

	const configured = import.meta.env.VITE_II_DERIVATION_ORIGIN?.trim();
	if (!configured) {
		return undefined;
	}

	try {
		const configuredOrigin = new URL(configured).origin;
		const currentOrigin = window.location.origin;
		return currentOrigin === configuredOrigin ? undefined : configuredOrigin;
	} catch (error) {
		console.warn('VITE_II_DERIVATION_ORIGIN non valido.', error);
		return undefined;
	}
}

function getDelegationTargets() {
	if (!browser) {
		return undefined;
	}

	const canisterIds = [
		import.meta.env.VITE_VAULT_BACKEND_CANISTER_ID,
		import.meta.env.VITE_VAULT_STORAGE_CANISTER_ID,
		import.meta.env.VITE_VAULT_ANALYTICS_CANISTER_ID
	].filter((value): value is string => Boolean(value?.trim()));

	const targets = canisterIds.flatMap((canisterId) => {
		try {
			return [Principal.fromText(canisterId)];
		} catch (error) {
			console.warn(`Canister ID non valido ignorato nei targets di login: ${canisterId}`, error);
			return [];
		}
	});

	return targets.length ? targets : undefined;
}

async function getAuthClient() {
	if (!authClientPromise) {
		authClientPromise = AuthClient.create();
	}

	return authClientPromise;
}

async function syncAuthState() {
	if (!browser) {
		return;
	}

	const client = await getAuthClient();
	const authenticated = await client.isAuthenticated();
	const principal = authenticated ? client.getIdentity().getPrincipal().toText() : null;
	let displayName = principal ? localStorage.getItem(`${DISPLAY_NAME_PREFIX}${principal}`) : null;
	let security = principal ? readSecurityState(principal) : null;

	if (authenticated && principal && isVaultBackendConfigured()) {
		try {
			const remoteProfile = await fetchRemoteProfile();
			if (remoteProfile) {
				displayName = remoteProfile.displayName ?? displayName;
				security = remoteProfile.security ?? security;

				if (displayName) {
					localStorage.setItem(`${DISPLAY_NAME_PREFIX}${principal}`, displayName);
				}

				if (security) {
					writeSecurityState(principal, security);
				}
			}
		} catch (error) {
			console.warn('Impossibile sincronizzare il profilo remoto.', error);
		}
	}

	authStateStore.set({
		ready: true,
		pending: false,
		authenticated,
		principal,
		displayName,
		security
	});
}

function getDefaultSecurityState(): SecurityState {
	return {
		ackRecoveryPhrase: false,
		ackBackupDevice: false,
		ackRiskUnderstood: false,
		completedAt: null
	};
}

function readSecurityState(principal: string): SecurityState {
	if (!browser) {
		return getDefaultSecurityState();
	}

	const raw = localStorage.getItem(`${SECURITY_STATE_PREFIX}${principal}`);
	if (!raw) {
		return getDefaultSecurityState();
	}

	try {
		const parsed = JSON.parse(raw) as Partial<SecurityState>;
		return {
			ackRecoveryPhrase: Boolean(parsed.ackRecoveryPhrase),
			ackBackupDevice: Boolean(parsed.ackBackupDevice),
			ackRiskUnderstood: Boolean(parsed.ackRiskUnderstood),
			completedAt: parsed.completedAt ?? null
		};
	} catch {
		return getDefaultSecurityState();
	}
}

function writeSecurityState(principal: string, security: SecurityState) {
	if (!browser) {
		return;
	}

	localStorage.setItem(`${SECURITY_STATE_PREFIX}${principal}`, JSON.stringify(security));
}

export const authState = {
	subscribe: authStateStore.subscribe
};

export async function initAuth() {
	if (!browser) {
		return;
	}

	const current = get(authStateStore);
	if (current.ready && !current.pending) {
		return;
	}

	if (authInitPromise) {
		return authInitPromise;
	}

	authStateStore.update((state) => ({ ...state, pending: true }));
	authInitPromise = syncAuthState().finally(() => {
		authInitPromise = null;
	});
	await authInitPromise;
}

export async function login(intent: LoginIntent) {
	if (!browser) {
		return;
	}

	const client = await getAuthClient();
	sessionStorage.setItem(LOGIN_INTENT_KEY, intent);
	authStateStore.update((state) => ({ ...state, pending: true }));

	return new Promise<void>((resolve, reject) => {
		client.login({
			identityProvider: getIdentityProviderUrl(),
			derivationOrigin: getDerivationOrigin(),
			maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000),
			customValues: {
				targets: getDelegationTargets()
			},
			onSuccess: async () => {
				await syncAuthState();
				void trackAnalyticsEvent({
					eventType: 'user_logged_in',
					metadata: { sourceScreen: intent === 'dashboard' ? 'navbar' : 'hero' }
				});
				const nextIntent = sessionStorage.getItem(LOGIN_INTENT_KEY);
				sessionStorage.removeItem(LOGIN_INTENT_KEY);
				window.location.assign(nextIntent === 'dashboard' ? '/dashboard' : '/');
				resolve();
			},
			onError: async (error) => {
				await syncAuthState();
				reject(error);
			}
		});
	});
}

export async function logout() {
	if (!browser) {
		return;
	}

	const client = await getAuthClient();
	await client.logout();
	await syncAuthState();
	window.location.assign('/');
}

export async function resetLocalInternetIdentitySession() {
	if (!browser) {
		return;
	}

	try {
		const storage = new IdbStorage();
		await storage.remove(KEY_STORAGE_DELEGATION);
		await storage.remove(KEY_STORAGE_KEY);
		await storage.remove(AUTH_STORAGE_VECTOR_KEY);
		localStorage.removeItem(KEY_STORAGE_DELEGATION);
		localStorage.removeItem(KEY_STORAGE_KEY);
		localStorage.removeItem(AUTH_STORAGE_VECTOR_KEY);
		sessionStorage.removeItem(LOGIN_INTENT_KEY);
	} catch (error) {
		console.warn('Impossibile pulire la sessione locale Internet Identity.', error);
	}

	authClientPromise = null;
	authInitPromise = null;
	authStateStore.set({
		ready: false,
		pending: false,
		authenticated: false,
		principal: null,
		displayName: null,
		security: null
	});
	window.location.assign('/');
}

export async function saveDisplayName(name: string) {
	if (!browser) {
		return;
	}

	const client = await getAuthClient();
	const authenticated = await client.isAuthenticated();

	if (!authenticated) {
		return;
	}

	const principal = client.getIdentity().getPrincipal().toText();
	const trimmedName = name.trim();
	localStorage.setItem(`${DISPLAY_NAME_PREFIX}${principal}`, trimmedName);

	if (isVaultBackendConfigured()) {
		try {
			const remoteProfile = await upsertRemoteProfile({ displayName: trimmedName });
			if (remoteProfile?.displayName) {
				localStorage.setItem(`${DISPLAY_NAME_PREFIX}${principal}`, remoteProfile.displayName);
			}
		} catch (error) {
			console.warn('Impossibile salvare il nome profilo sul backend ICP.', error);
		}
	}

	await syncAuthState();
}

export function isSecurityOnboardingComplete(state: AuthState) {
	return Boolean(state.security?.ackRecoveryPhrase && state.security?.ackRiskUnderstood);
}

export function needsSecurityOnboarding(state: AuthState) {
	return state.authenticated && !isSecurityOnboardingComplete(state);
}

export async function saveSecurityState(updates: Partial<SecurityState>) {
	if (!browser) {
		return;
	}

	const client = await getAuthClient();
	const authenticated = await client.isAuthenticated();
	if (!authenticated) {
		return;
	}

	const principal = client.getIdentity().getPrincipal().toText();
	const current = readSecurityState(principal);
	const next: SecurityState = {
		...current,
		...updates
	};

	if (next.ackRecoveryPhrase && next.ackRiskUnderstood && !next.completedAt) {
		next.completedAt = new Date().toISOString();
	}

	writeSecurityState(principal, next);

	if (isVaultBackendConfigured()) {
		try {
			const remoteProfile = await upsertRemoteProfile({ security: next });
			if (remoteProfile?.security) {
				writeSecurityState(principal, remoteProfile.security);
			}
		} catch (error) {
			console.warn('Impossibile salvare lo stato sicurezza sul backend ICP.', error);
		}
	}

	await syncAuthState();

	if (!isSecurityOnboardingComplete({ ...get(authStateStore), security: current }) &&
		isSecurityOnboardingComplete({ ...get(authStateStore), security: next })) {
		void trackAnalyticsEvent({
			eventType: 'security_onboarding_completed',
			metadata: { sourceScreen: 'sicurezza' }
		});
	}
}
