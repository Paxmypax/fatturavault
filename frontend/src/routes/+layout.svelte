<script lang="ts">
	import './layout.css';
	import { browser } from '$app/environment';
	import favicon from '$lib/assets/favicon.svg';
	import { initAuth } from '$lib/auth';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		void initAuth();

		if (!browser) {
			return;
		}

		const preloadVault = () => {
			void import('./vault/+page.svelte');
		};

		const win = window as Window & {
			requestIdleCallback?: (
				callback: IdleRequestCallback,
				options?: IdleRequestOptions
			) => number;
			cancelIdleCallback?: (handle: number) => void;
		};

		if (typeof win.requestIdleCallback === 'function') {
			const idleId = win.requestIdleCallback(preloadVault, { timeout: 1200 });
			return () => win.cancelIdleCallback?.(idleId);
		}

		const timeoutId = globalThis.setTimeout(preloadVault, 250);
		return () => globalThis.clearTimeout(timeoutId);
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
