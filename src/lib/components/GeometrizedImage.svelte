<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import type { GeometrizePlaceholder } from '../core/types.js';

	interface Props extends Omit<HTMLImgAttributes, 'src' | 'alt' | 'class' | 'placeholder'> {
		placeholder: GeometrizePlaceholder;
		src: string;
		alt: string;
		/** Class applied to the wrapper element. */
		class?: string;
		/** Delay between consecutive shapes appearing, in ms. Default 15. */
		stagger?: number;
		/** Fade-in duration of each individual shape, in ms. Default 400. */
		shapeDuration?: number;
		/** Crossfade duration once the real image has loaded, in ms. Default 350. */
		fadeDuration?: number;
	}

	let {
		placeholder,
		src,
		alt,
		class: className = '',
		stagger = 15,
		shapeDuration = 400,
		fadeDuration = 350,
		...rest
	}: Props = $props();

	let img: HTMLImageElement | undefined = $state();
	let loaded = $state(false);

	// Re-evaluates on every src change: resets to hidden for a new (or empty) src,
	// and catches images that completed before hydration or onload binding (e.g. cached).
	$effect(() => {
		void src;
		loaded = Boolean(src && img?.complete && img.naturalWidth > 0);
	});

	// Built as one string (not Svelte-templated shapes) so the fragments live in a
	// real SVG namespace; per-shape reveal order is encoded as inline animation-delay.
	const svgMarkup = $derived(
		`<svg viewBox="0 0 ${placeholder.fw} ${placeholder.fh}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
			`<rect width="${placeholder.fw}" height="${placeholder.fh}" fill="${placeholder.bg}"/>` +
			placeholder.s.map((frag, i) => `<g style="animation-delay:${i * stagger}ms">${frag}</g>`).join('') +
			`</svg>`
	);
</script>

<div
	class="geometrize {className}"
	style:aspect-ratio="{placeholder.w} / {placeholder.h}"
	style:--geometrize-shape-ms="{shapeDuration}ms"
>
	{@html svgMarkup}
	{#if src}
		<!-- on error the img stays transparent, so the placeholder persists
		     instead of the browser's broken-image icon and alt text -->
		<img
			bind:this={img}
			{...rest}
			{src}
			{alt}
			class:loaded
			style:transition-duration="{fadeDuration}ms"
			decoding="async"
			onload={() => (loaded = true)}
		/>
	{/if}
</div>

<style>
	.geometrize {
		position: relative;
		display: block;
		width: 100%;
		overflow: hidden;
	}

	.geometrize :global(svg) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}

	.geometrize :global(svg g) {
		animation: geometrize-shape-in var(--geometrize-shape-ms, 400ms) ease-out both;
		/* inline animation-delay on each <g> survives this shorthand (inline wins) */
	}

	@keyframes -global-geometrize-shape-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition-property: opacity;
		transition-timing-function: ease-out;
	}

	img.loaded {
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.geometrize :global(svg g) {
			animation: none;
		}
		img {
			transition-duration: 0ms !important;
		}
	}
</style>
