<script lang="ts">
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import type { Category } from '$lib/types';

	let { category }: { category: Category } = $props();
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white shadow-[0_6px_14px_rgba(15,23,42,0.08)]"
	style={`background-color: ${category.color};`}
>
	<span aria-hidden="true" class="inline-flex items-center justify-center">
		<CategoryIcon icon={category.icon} className="h-3.5 w-3.5" />
	</span>
	{category.name}
</span>
