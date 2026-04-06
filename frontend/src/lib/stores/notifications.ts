import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { authState } from '$lib/auth';
import {
	fetchRemoteNotifications,
	markRemoteNotificationsSeen,
	type RemoteNotification
} from '$lib/ic/vaultBackend';

type NotificationState = {
	ready: boolean;
	items: RemoteNotification[];
	unreadCount: number;
};

const notificationStore = writable<NotificationState>({
	ready: false,
	items: [],
	unreadCount: 0
});

let initialized = false;
let refreshInFlight: Promise<void> | null = null;
let pollTimer: number | null = null;

function applyNotifications(items: RemoteNotification[]) {
	notificationStore.set({
		ready: true,
		items,
		unreadCount: items.filter((item) => item.isUnread).length
	});
}

function clearNotifications() {
	notificationStore.set({
		ready: true,
		items: [],
		unreadCount: 0
	});
}

export async function refreshNotifications() {
	if (!browser) {
		return;
	}

	if (refreshInFlight) {
		return refreshInFlight;
	}

	refreshInFlight = (async () => {
		const currentAuth = get(authState);
		if (!currentAuth.authenticated) {
			clearNotifications();
			return;
		}

		try {
			const notifications = await fetchRemoteNotifications();
			applyNotifications(notifications ?? []);
		} catch {
			clearNotifications();
		}
	})().finally(() => {
		refreshInFlight = null;
	});

	return refreshInFlight;
}

export async function markNotificationsSeen() {
	if (!browser) {
		return;
	}

	const currentAuth = get(authState);
	if (!currentAuth.authenticated) {
		clearNotifications();
		return;
	}

	try {
		const notifications = await markRemoteNotificationsSeen();
		applyNotifications(notifications ?? []);
	} catch {
		await refreshNotifications();
	}
}

function startNotificationPolling() {
	if (!browser || pollTimer !== null) {
		return;
	}

	pollTimer = window.setInterval(() => {
		void refreshNotifications();
	}, 120000);

	document.addEventListener('visibilitychange', handleVisibilityChange);
	window.addEventListener('focus', handleWindowFocus);
}

function stopNotificationPolling() {
	if (!browser) {
		return;
	}

	if (pollTimer !== null) {
		window.clearInterval(pollTimer);
		pollTimer = null;
	}

	document.removeEventListener('visibilitychange', handleVisibilityChange);
	window.removeEventListener('focus', handleWindowFocus);
}

function handleVisibilityChange() {
	if (document.visibilityState === 'visible') {
		void refreshNotifications();
	}
}

function handleWindowFocus() {
	void refreshNotifications();
}

export function initNotifications() {
	if (!browser || initialized) {
		return;
	}

	initialized = true;
	authState.subscribe((state) => {
		if (state.authenticated) {
			void refreshNotifications();
			startNotificationPolling();
			return;
		}

		stopNotificationPolling();
		clearNotifications();
	});
}

export const notificationsState = notificationStore;
