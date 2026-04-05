<script lang="ts">
	interface Props {
		icon?: string;
		className?: string;
	}

	let { icon = 'other', className = 'h-4 w-4' }: Props = $props();

	const strokeClass = 'fill-none stroke-current stroke-[1.8] stroke-linecap-round stroke-linejoin-round';
</script>

{#if icon === 'invoice'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M7 4.8h6.5L19 10v8.2A2 2 0 0 1 17 20H7a2 2 0 0 1-2-1.8V6.8A2 2 0 0 1 7 4.8Z" />
		<path class={strokeClass} d="M13.5 4.9V10H19M8.5 12.2h7M8.5 15.2h5" />
	</svg>
{:else if icon === 'shield'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M12 3 6 5.5V11c0 4.25 2.56 7.36 6 9 3.44-1.64 6-4.75 6-9V5.5L12 3Z" />
		<path class={strokeClass} d="M9.6 11.7 11.3 13.4 14.8 9.9" />
	</svg>
{:else if icon === 'receipt'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M7.2 4.8h9.6v14.4l-2.1-1.2-1.6 1.2-1.1-1.2-1.1 1.2-1.6-1.2-2.1 1.2Z" />
		<path class={strokeClass} d="M9.3 9.1h5.4M9.3 12.1h5.4M9.3 15.1h3.4" />
	</svg>
{:else if icon === 'contract'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M7 4.8h10a2 2 0 0 1 2 2v10.4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.8a2 2 0 0 1 2-2Z" />
		<path class={strokeClass} d="M8.8 9h6.4M8.8 12.2h6.4M8.8 15.4h4.2" />
	</svg>
{:else if icon === 'id-card'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<rect class={strokeClass} x="4" y="6" width="16" height="12" rx="2.4" />
		<circle class={strokeClass} cx="9" cy="12" r="2.2" />
		<path class={strokeClass} d="M13.5 10.2H17M13.5 13.1H17M7.2 16.1c.7-1.4 2-2.1 3.3-2.1s2.6.7 3.3 2.1" />
	</svg>
{:else if icon === 'health'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M6.5 7.2h11a1.8 1.8 0 0 1 1.8 1.8v7a1.8 1.8 0 0 1-1.8 1.8h-11A1.8 1.8 0 0 1 4.7 16v-7a1.8 1.8 0 0 1 1.8-1.8Z" />
		<path class={strokeClass} d="M12 9.2v5.6M9.2 12h5.6" />
	</svg>
{:else if icon === 'home'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M4.8 10.6 12 4.8l7.2 5.8v8A1.4 1.4 0 0 1 17.8 20H6.2a1.4 1.4 0 0 1-1.4-1.4v-8Z" />
		<path class={strokeClass} d="M9.2 20v-5.4h5.6V20" />
	</svg>
{:else if icon === 'car'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M6.3 15.8 7.5 9.9A2 2 0 0 1 9.4 8.3h5.2a2 2 0 0 1 1.9 1.6l1.2 5.9" />
		<path class={strokeClass} d="M5.2 14.8h13.6a1.2 1.2 0 0 1 1.2 1.2v1.1a1.2 1.2 0 0 1-1.2 1.2H5.2A1.2 1.2 0 0 1 4 17.1V16a1.2 1.2 0 0 1 1.2-1.2Z" />
		<circle class={strokeClass} cx="7.8" cy="17.8" r="1.5" />
		<circle class={strokeClass} cx="16.2" cy="17.8" r="1.5" />
	</svg>
{:else if icon === 'graduation'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="m4.5 9.5 7.5-3.5 7.5 3.5-7.5 3.5-7.5-3.5Z" />
		<path class={strokeClass} d="M7.2 10.7v3.1c0 1.3 2.2 2.4 4.8 2.4s4.8-1.1 4.8-2.4v-3.1" />
		<path class={strokeClass} d="M19.5 10.4v4.4" />
	</svg>
{:else if icon === 'briefcase'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M8.2 7.2V6a1.5 1.5 0 0 1 1.5-1.5h4.6A1.5 1.5 0 0 1 15.8 6v1.2" />
		<rect class={strokeClass} x="4.5" y="7.2" width="15" height="11.8" rx="2" />
		<path class={strokeClass} d="M4.5 11.3h15M10.4 13.2h3.2" />
	</svg>
{:else if icon === 'coins'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<ellipse class={strokeClass} cx="12" cy="7.2" rx="4.8" ry="2.4" />
		<path class={strokeClass} d="M7.2 7.2v4.6c0 1.3 2.1 2.4 4.8 2.4s4.8-1.1 4.8-2.4V7.2M9 15.1v1.7c0 1.1 1.6 2 3.6 2s3.6-.9 3.6-2v-1.7" />
	</svg>
{:else if icon === 'lock'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<rect class={strokeClass} x="6.2" y="10.4" width="11.6" height="9" rx="2" />
		<path class={strokeClass} d="M8.8 10.4V8.2a3.2 3.2 0 1 1 6.4 0v2.2M12 14.2v2.4" />
	</svg>
{:else if icon === 'refresh'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M18.5 10a6.5 6.5 0 0 0-11-3.8M5.5 14a6.5 6.5 0 0 0 11 3.8" />
		<path class={strokeClass} d="M18.5 5.8v4.3h-4.2M5.5 18.2v-4.3h4.2" />
	</svg>
{:else if icon === 'government'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="m4.8 9 7.2-4.2L19.2 9M6.2 9v7.8M10.1 9v7.8M13.9 9v7.8M17.8 9v7.8M4.5 18.4h15" />
	</svg>
{:else if icon === 'paperclip'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M9.7 12.8 14 8.5a2.7 2.7 0 1 1 3.8 3.8l-6.1 6.1a4.2 4.2 0 1 1-5.9-5.9l6.4-6.4" />
	</svg>
{:else if icon === 'laptop'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<rect class={strokeClass} x="5.3" y="6" width="13.4" height="9.2" rx="1.4" />
		<path class={strokeClass} d="M3.8 18.1h16.4M9.5 18.1h5" />
	</svg>
{:else if icon === 'meal'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M7 4.8v6.7M9.3 4.8v6.7M7 8.2h2.3M14.8 4.8v14.4M18 4.8c0 3-1.1 4.8-3.2 5.5" />
	</svg>
{:else if icon === 'tools'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="m13.2 6.2 4.6 4.6M6.2 17.8l6.2-6.2M14.6 4.8a3 3 0 0 0 3.8 3.8l-5.9 5.9a2.4 2.4 0 1 1-3.4-3.4l5.5-5.5Z" />
	</svg>
{:else if icon === 'package'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="m12 4.8 7 4v10.4l-7 4-7-4V8.8l7-4Z" />
		<path class={strokeClass} d="m12 4.8 7 4M12 4.8l-7 4M12 12.3v10.9" />
	</svg>
{:else if icon === 'spark'}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="m12 4.5 1.9 4.6 4.6 1.9-4.6 1.9L12 17.5l-1.9-4.6-4.6-1.9 4.6-1.9L12 4.5Z" />
	</svg>
{:else}
	<svg aria-hidden="true" class={className} viewBox="0 0 24 24">
		<path class={strokeClass} d="M7 4.8h6.5L19 10v8.2A2 2 0 0 1 17 20H7a2 2 0 0 1-2-1.8V6.8A2 2 0 0 1 7 4.8Z" />
		<path class={strokeClass} d="M13.5 4.9V10H19" />
	</svg>
{/if}
