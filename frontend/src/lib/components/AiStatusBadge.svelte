<script lang="ts">
	interface Props {
		status: 'inbox' | 'processed';
	}

	let { status }: Props = $props();
</script>

{#if status === 'inbox'}
	<span class="inline-flex rounded-full bg-[#fff4d7] px-3 py-1 text-sm font-semibold text-[#9a6c00]">In coda</span>
{:else}
	<span class="inline-flex rounded-full bg-[#d1fae5] px-3 py-1 text-sm font-semibold text-[#065f46]">Archiviato</span>
{/if}
