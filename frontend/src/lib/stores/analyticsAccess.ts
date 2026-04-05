import { writable } from 'svelte/store';
import { fetchAnalyticsAccessState, isVaultAnalyticsConfigured } from '$lib/ic/vaultAnalytics';

type AnalyticsAccessViewState = {
	loading: boolean;
	canView: boolean;
	hasAdmins: boolean;
	configured: boolean;
};

const initialState: AnalyticsAccessViewState = {
	loading: false,
	canView: false,
	hasAdmins: false,
	configured: false
};

export const analyticsAccessState = writable<AnalyticsAccessViewState>(initialState);

export async function initAnalyticsAccess() {
	if (!isVaultAnalyticsConfigured()) {
		analyticsAccessState.set({
			loading: false,
			canView: false,
			hasAdmins: false,
			configured: false
		});
		return;
	}

	analyticsAccessState.update((state) => ({ ...state, loading: true, configured: true }));
	const accessState = await fetchAnalyticsAccessState();

	analyticsAccessState.set({
		loading: false,
		canView: Boolean(accessState?.isAdmin),
		hasAdmins: Boolean(accessState?.hasAdmins),
		configured: true
	});
}
