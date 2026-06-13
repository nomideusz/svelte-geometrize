<script lang="ts">
	import { GeometrizedImage } from '$lib/index.js';
	import type { GeometrizePlaceholder } from '$lib/index.js';

	interface Props {
		placeholder: GeometrizePlaceholder;
		photo: string;
		title: string;
		query: string;
	}

	let { placeholder, photo, title, query }: Props = $props();

	let run = $state(0);
	let src = $state('');

	$effect(() => {
		void run;
		src = '';
		const t = setTimeout(() => (src = photo), 1600);
		return () => clearTimeout(t);
	});
</script>

<button class="card" onclick={() => run++} aria-label="Replay {title} placeholder">
	{#key run}
		<GeometrizedImage {placeholder} {src} alt={title} stagger={20} />
	{/key}
	<span class="meta">
		<span class="title">{title}</span>
		<span class="query">?{query}</span>
		<span class="replay" aria-hidden="true">↻ replay</span>
	</span>
</button>

<style>
	.card {
		display: block;
		width: 100%;
		padding: 0;
		border: 1px solid var(--geo-line);
		background: var(--geo-surface);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		clip-path: polygon(
			0 0,
			calc(100% - 16px) 0,
			100% 16px,
			100% 100%,
			16px 100%,
			0 calc(100% - 16px)
		);
		transition: border-color 150ms ease-out;
	}

	.card:hover,
	.card:focus-visible {
		border-color: var(--geo-accent);
		outline: none;
	}

	.meta {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		padding: 0.7rem 0.9rem 0.8rem;
		font-family: var(--geo-mono);
		font-size: 0.72rem;
	}

	.title {
		font-family: var(--geo-display);
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.query {
		color: var(--geo-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	.replay {
		color: var(--geo-accent);
		opacity: 0;
		transition: opacity 150ms ease-out;
	}

	.card:hover .replay,
	.card:focus-visible .replay {
		opacity: 1;
	}
</style>
