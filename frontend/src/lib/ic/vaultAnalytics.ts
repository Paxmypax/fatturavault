import { browser } from '$app/environment';
import { AuthClient } from '@icp-sdk/auth/client';
import { Actor, AnonymousIdentity, HttpAgent } from '@icp-sdk/core/agent';
import { safeGetCanisterEnv } from '@icp-sdk/core/agent/canister-env';

export type AnalyticsEventType =
	| 'user_logged_in'
	| 'security_onboarding_completed'
	| 'document_uploaded'
	| 'document_archived'
	| 'note_created';

export type AnalyticsEventMetadata = {
	categoryId?: string;
	documentKind?: string;
	sourceScreen?: string;
	itemCount?: number;
};

export type DailyMetrics = {
	dayKey: string;
	uniqueActiveUsers: number;
	logins: number;
	securityOnboardingCompleted: number;
	documentsUploaded: number;
	documentsArchived: number;
	notesCreated: number;
};

export type ProductSummary = {
	totalRegisteredUsers: number;
	dau: number;
	wau: number;
	mau: number;
	totalDocumentsUploaded: number;
	totalDocumentsArchived: number;
	totalNotesCreated: number;
};

export type AnalyticsAccessState = {
	isAdmin: boolean;
	hasAdmins: boolean;
};

export let lastAnalyticsAccessError = '';

type RawAnalyticsEventType =
	| { UserLoggedIn: null }
	| { SecurityOnboardingCompleted: null }
	| { DocumentUploaded: null }
	| { DocumentArchived: null }
	| { NoteCreated: null };

type RawAnalyticsEventMetadata = {
	category_id: [] | [string];
	document_kind: [] | [string];
	source_screen: [] | [string];
	item_count: [] | [number];
};

type RawDailyMetrics = {
	day_key: string;
	unique_active_users: bigint;
	logins: bigint;
	security_onboarding_completed: bigint;
	documents_uploaded: bigint;
	documents_archived: bigint;
	notes_created: bigint;
};

type RawProductSummary = {
	total_registered_users: bigint;
	dau: bigint;
	wau: bigint;
	mau: bigint;
	total_documents_uploaded: bigint;
	total_documents_archived: bigint;
	total_notes_created: bigint;
};

type RawAnalyticsAccessState = {
	is_admin: boolean;
	has_admins: boolean;
};

type VaultAnalyticsActor = {
	track_event: (input: {
		event_type: RawAnalyticsEventType;
		metadata: [] | [RawAnalyticsEventMetadata];
	}) => Promise<{ Ok: unknown } | { Err: string }>;
	get_last_30_days_metrics: () => Promise<RawDailyMetrics[]>;
	get_product_summary: () => Promise<RawProductSummary>;
	get_access_state: () => Promise<RawAnalyticsAccessState>;
};

function idlFactory({ IDL: idl }: { IDL: any }) {
	const AnalyticsEventType = idl.Variant({
		UserLoggedIn: idl.Null,
		SecurityOnboardingCompleted: idl.Null,
		DocumentUploaded: idl.Null,
		DocumentArchived: idl.Null,
		NoteCreated: idl.Null
	});

	const AnalyticsEventMetadata = idl.Record({
		category_id: idl.Opt(idl.Text),
		document_kind: idl.Opt(idl.Text),
		source_screen: idl.Opt(idl.Text),
		item_count: idl.Opt(idl.Nat32)
	});

	const AnalyticsEventRecord = idl.Record({
		id: idl.Text,
		user_hash: idl.Text,
		event_type: AnalyticsEventType,
		occurred_at_ns: idl.Nat64,
		metadata: idl.Opt(AnalyticsEventMetadata)
	});

	const DailyMetrics = idl.Record({
		day_key: idl.Text,
		unique_active_users: idl.Nat64,
		logins: idl.Nat64,
		security_onboarding_completed: idl.Nat64,
		documents_uploaded: idl.Nat64,
		documents_archived: idl.Nat64,
		notes_created: idl.Nat64
	});

	const ProductSummary = idl.Record({
		total_registered_users: idl.Nat64,
		dau: idl.Nat64,
		wau: idl.Nat64,
		mau: idl.Nat64,
		total_documents_uploaded: idl.Nat64,
		total_documents_archived: idl.Nat64,
		total_notes_created: idl.Nat64
	});

	const AnalyticsAccessState = idl.Record({
		is_admin: idl.Bool,
		has_admins: idl.Bool
	});

	return idl.Service({
		track_event: idl.Func(
			[
				idl.Record({
					event_type: AnalyticsEventType,
					metadata: idl.Opt(AnalyticsEventMetadata)
				})
			],
			[idl.Variant({ Ok: AnalyticsEventRecord, Err: idl.Text })],
			[]
		),
		get_access_state: idl.Func([], [AnalyticsAccessState], []),
		get_last_30_days_metrics: idl.Func([], [idl.Vec(DailyMetrics)], []),
		get_product_summary: idl.Func([], [ProductSummary], [])
	});
}

function resolveVaultAnalyticsCanisterId() {
	if (!browser) {
		return null;
	}

	const env = safeGetCanisterEnv<{ readonly ['PUBLIC_CANISTER_ID:vault_analytics']: string }>();
	return (
		import.meta.env.VITE_VAULT_ANALYTICS_CANISTER_ID ||
		env?.['PUBLIC_CANISTER_ID:vault_analytics'] ||
		null
	);
}

function resolveHost() {
	return import.meta.env.VITE_ICP_HOST || 'http://127.0.0.1:4943';
}

function isLocalIcHost() {
	const host = resolveHost();
	return host.includes('127.0.0.1') || host.includes('localhost');
}

export function isVaultAnalyticsConfigured() {
	return Boolean(resolveVaultAnalyticsCanisterId());
}

async function getActor(): Promise<VaultAnalyticsActor | null> {
	if (!browser) {
		return null;
	}

	const canisterId = resolveVaultAnalyticsCanisterId();
	if (!canisterId) {
		return null;
	}

	const authClient = await AuthClient.create();
	const authenticated = await authClient.isAuthenticated();
	const useAnonymousLocalActor = isLocalIcHost();
	if (!authenticated && !useAnonymousLocalActor) {
		return null;
	}

	const agent = await HttpAgent.create({
		host: resolveHost(),
		identity: useAnonymousLocalActor ? new AnonymousIdentity() : authClient.getIdentity()
	});

	if (isLocalIcHost()) {
		await agent.fetchRootKey?.();
	}

	return Actor.createActor<VaultAnalyticsActor>(idlFactory, {
		agent,
		canisterId
	});
}

function toRawEventType(eventType: AnalyticsEventType): RawAnalyticsEventType {
	switch (eventType) {
		case 'user_logged_in':
			return { UserLoggedIn: null };
		case 'security_onboarding_completed':
			return { SecurityOnboardingCompleted: null };
		case 'document_uploaded':
			return { DocumentUploaded: null };
		case 'document_archived':
			return { DocumentArchived: null };
		case 'note_created':
			return { NoteCreated: null };
	}
}

function toOptText(value: string | undefined): [] | [string] {
	const trimmed = value?.trim();
	return trimmed ? [trimmed] : ([] as []);
}

function toRawMetadata(metadata?: AnalyticsEventMetadata): [] | [RawAnalyticsEventMetadata] {
	if (!metadata) {
		return [];
	}

	return [
		{
			category_id: toOptText(metadata.categoryId),
			document_kind: toOptText(metadata.documentKind),
			source_screen: toOptText(metadata.sourceScreen),
			item_count:
				typeof metadata.itemCount === 'number' && Number.isFinite(metadata.itemCount)
					? [metadata.itemCount]
					: []
		}
	];
}

function asNumber(value: bigint) {
	return Number(value);
}

function fromRawDailyMetrics(metrics: RawDailyMetrics): DailyMetrics {
	return {
		dayKey: metrics.day_key,
		uniqueActiveUsers: asNumber(metrics.unique_active_users),
		logins: asNumber(metrics.logins),
		securityOnboardingCompleted: asNumber(metrics.security_onboarding_completed),
		documentsUploaded: asNumber(metrics.documents_uploaded),
		documentsArchived: asNumber(metrics.documents_archived),
		notesCreated: asNumber(metrics.notes_created)
	};
}

function fromRawProductSummary(summary: RawProductSummary): ProductSummary {
	return {
		totalRegisteredUsers: asNumber(summary.total_registered_users),
		dau: asNumber(summary.dau),
		wau: asNumber(summary.wau),
		mau: asNumber(summary.mau),
		totalDocumentsUploaded: asNumber(summary.total_documents_uploaded),
		totalDocumentsArchived: asNumber(summary.total_documents_archived),
		totalNotesCreated: asNumber(summary.total_notes_created)
	};
}

function fromRawAccessState(state: RawAnalyticsAccessState): AnalyticsAccessState {
	return {
		isAdmin: state.is_admin,
		hasAdmins: state.has_admins
	};
}

export async function trackAnalyticsEvent(input: {
	eventType: AnalyticsEventType;
	metadata?: AnalyticsEventMetadata;
}) {
	const actor = await getActor();
	if (!actor) {
		return false;
	}

	try {
		const result = await actor.track_event({
			event_type: toRawEventType(input.eventType),
			metadata: toRawMetadata(input.metadata)
		});

		if ('Err' in result) {
			throw new Error(result.Err);
		}

		return true;
	} catch (error) {
		console.warn('Impossibile registrare l’evento analytics.', error);
		return false;
	}
}

export async function fetchAnalyticsSummary() {
	const actor = await getActor();
	if (!actor) {
		return null;
	}

	try {
		const summary = await actor.get_product_summary();
		return fromRawProductSummary(summary);
	} catch (error) {
		console.warn("Impossibile leggere il riepilogo analytics.", error);
		return null;
	}
}

export async function fetchAnalyticsLast30Days() {
	const actor = await getActor();
	if (!actor) {
		return [];
	}

	try {
		const metrics = await actor.get_last_30_days_metrics();
		return metrics.map(fromRawDailyMetrics);
	} catch (error) {
		console.warn("Impossibile leggere lo storico analytics.", error);
		return [];
	}
}

export async function fetchAnalyticsAccessState() {
	lastAnalyticsAccessError = '';
	const actor = await getActor();
	if (!actor) {
		lastAnalyticsAccessError = 'Actor analytics non disponibile o utente non autenticato.';
		return null;
	}

	try {
		const accessState = await actor.get_access_state();
		return fromRawAccessState(accessState);
	} catch (error) {
		console.warn("Impossibile leggere lo stato accessi analytics.", error);
		lastAnalyticsAccessError = error instanceof Error ? error.message : String(error);
		return null;
	}
}
