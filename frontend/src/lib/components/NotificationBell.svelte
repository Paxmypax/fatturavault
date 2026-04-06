<script lang="ts">
	import {
		initNotifications,
		markNotificationsSeen,
		notificationsState,
		refreshNotifications
	} from '$lib/stores/notifications';
	import { onMount } from 'svelte';

	let open = $state(false);

	function clickOutside(node: HTMLElement, close: () => void) {
		const handlePointerDown = (event: PointerEvent) => {
			if (!node.contains(event.target as Node)) {
				close();
			}
		};

		document.addEventListener('pointerdown', handlePointerDown);

		return {
			destroy() {
				document.removeEventListener('pointerdown', handlePointerDown);
			}
		};
	}

	onMount(() => {
		initNotifications();
		void refreshNotifications();
	});

	function formatDate(iso: string) {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) {
			return 'Adesso';
		}

		return new Intl.DateTimeFormat('it-IT', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}

	async function toggleOpen() {
		open = !open;
		if (open) {
			await markNotificationsSeen();
		}
	}
</script>

<div class="relative" use:clickOutside={() => (open = false)}>
	<button
		aria-label="Notifiche"
		class="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/80 text-[#29414a] shadow-[0_10px_25px_rgba(148,163,184,0.1)] transition-transform hover:-translate-y-0.5"
		type="button"
		onclick={toggleOpen}
	>
		<svg aria-hidden="true" class="h-6 w-6" fill="none" viewBox="0 0 24 24">
			<path
				d="M6.8 16.3H17.2L16 14.5V10a4 4 0 1 0-8 0v4.5l-1.2 1.8ZM10.1 18.6a2.1 2.1 0 0 0 3.8 0"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.7"
			/>
		</svg>
		{#if $notificationsState.unreadCount > 0}
			<span class="absolute right-2 top-2 h-3 w-3 rounded-full bg-[#d14343] ring-2 ring-white"></span>
		{/if}
	</button>

	{#if open}
		<div class="absolute right-0 z-30 mt-3 w-[22rem] rounded-[1.45rem] border border-[#dce9ed] bg-white p-4 shadow-[0_24px_60px_rgba(148,163,184,0.18)]">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#6a8792]">
						Notifiche
					</p>
					<h2 class="mt-1 text-lg font-bold tracking-[-0.03em] text-[#103844]">
						Messaggi Fattura Vault
					</h2>
				</div>
				<button
					class="rounded-full border border-[#dbe5ea] px-3 py-1.5 text-xs font-semibold text-[#365661] transition-colors hover:bg-[#f4f8fa]"
					type="button"
					onclick={() => refreshNotifications()}
				>
					Aggiorna
				</button>
			</div>

			{#if !$notificationsState.items.length}
				<div class="mt-4 rounded-[1.2rem] border border-[#e4eef2] bg-[#f8fbfc] px-4 py-4 text-sm leading-6 text-[#58707a]">
					Non ci sono messaggi o notifiche in questo momento.
				</div>
			{:else}
				<div class="mt-4 grid max-h-[22rem] gap-3 overflow-y-auto pr-1">
					{#each $notificationsState.items as notification}
						<article class="rounded-[1.2rem] border border-[#e4eef2] bg-[#f8fbfc] px-4 py-4">
							<div class="flex items-start justify-between gap-3">
								<div>
									<h3 class="text-sm font-semibold text-[#173843]">{notification.title}</h3>
									<p class="mt-1 text-xs font-medium text-[#6a8792]">
										{formatDate(notification.createdAt)}
									</p>
								</div>
								{#if notification.isUnread}
									<span class="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[#d14343]"></span>
								{/if}
							</div>
							<p class="mt-3 text-sm leading-6 text-[#405a63]">{notification.body}</p>
						</article>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
