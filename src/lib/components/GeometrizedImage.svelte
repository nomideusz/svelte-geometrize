<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import type { GeometrizePlaceholder } from '../core/types.js';

	export interface GeometrizeSource {
		srcset: string;
		type?: string;
		media?: string;
		sizes?: string;
	}

	export type GeometrizeReveal = 'fade' | 'pop' | 'scatter';

	interface Props extends Omit<HTMLImgAttributes, 'src' | 'alt' | 'class' | 'placeholder'> {
		placeholder: GeometrizePlaceholder;
		src?: string;
		srcset?: string;
		sources?: GeometrizeSource[];
		alt: string;
		/** Class applied to the wrapper element. */
		class?: string;
		/** How each shape animates in: plain fade, scale-in pop, or fly-in scatter. Default 'fade'. */
		reveal?: GeometrizeReveal;
		/** Delay between consecutive shapes appearing, in ms. Default 15. */
		stagger?: number;
		/** Fade-in duration of each individual shape, in ms. Default 400. */
		shapeDuration?: number;
		/** Crossfade duration of the photo once loaded, in ms. Default 600. */
		fadeDuration?: number;
	}

	let {
		placeholder,
		src,
		srcset,
		sources = [],
		alt,
		class: className = '',
		reveal: revealKind = 'fade',
		stagger = 15,
		shapeDuration = 400,
		fadeDuration = 600,
		...rest
	}: Props = $props();

	let img: HTMLImageElement | undefined = $state();
	let loaded = $state(false);
	let revealToken = 0; // bumped on every src/sources change to cancel a stale pending reveal

	function reveal() {
		const el = img;
		if (!el || !el.complete || el.naturalWidth === 0) return; // not ready / broken → keep placeholder
		const token = revealToken;
		const flip = () => {
			const e2 = img;
			if (token !== revealToken || !e2 || !e2.complete || e2.naturalWidth === 0) return;
			requestAnimationFrame(() =>
				requestAnimationFrame(() => {
					if (token === revealToken) loaded = true;
				})
			);
		};
		if (el.decode) el.decode().then(flip, flip);
		else flip();
	}

	$effect(() => {
		void src;
		void srcset;
		void sources;
		revealToken++;
		loaded = false;
		if (src || srcset || (sources && sources.length > 0)) reveal();
	});

	const svgMarkup = $derived.by(() => {
		const last = Math.max(placeholder.s.length - 1, 1);
		const dist = placeholder.fw * 0.1; // scatter fly-in distance, in viewBox units
		return (
			`<svg viewBox="0 0 ${placeholder.fw} ${placeholder.fh}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
			`<rect width="${placeholder.fw}" height="${placeholder.fh}" fill="${placeholder.bg}"/>` +
			placeholder.s
				.map((frag, i) => {
					const delay = Math.round((i / last) ** 1.6 * last * stagger);
					let style = `animation-delay:${delay}ms`;
					if (revealKind === 'scatter') {
						// deterministic pseudo-random direction per shape (golden angle)
						const a = (i * 2.39996) % (Math.PI * 2);
						style += `;--gdx:${(Math.cos(a) * dist).toFixed(1)}px;--gdy:${(Math.sin(a) * dist).toFixed(1)}px`;
					}
					return `<g style="${style}">${frag}</g>`;
				})
				.join('') +
			`</svg>`
		);
	});
</script>

<div
	class="geometrize reveal-{revealKind} {className}"
	style:aspect-ratio="{placeholder.w} / {placeholder.h}"
	style:--geometrize-shape-ms="{shapeDuration}ms"
	style:--geometrize-fade-ms="{fadeDuration}ms"
>
	{@html svgMarkup}
	{#if src || srcset || sources.length > 0}
		{#if sources.length > 0}
			<picture>
				{#each sources as source}
					<source
						srcset={source.srcset}
						type={source.type}
						media={source.media}
						sizes={source.sizes}
					/>
				{/each}
				<img
					bind:this={img}
					{...rest}
					{src}
					{srcset}
					{alt}
					class:loaded
					decoding="async"
					onload={reveal}
				/>
			</picture>
		{:else}
			<img
				bind:this={img}
				{...rest}
				{src}
				{srcset}
				{alt}
				class:loaded
				decoding="async"
				onload={reveal}
			/>
		{/if}
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
		transform-box: fill-box; /* scale/translate around each shape's own center, not the SVG origin */
		transform-origin: center;
		animation: geometrize-shape-in var(--geometrize-shape-ms, 400ms) ease-out both;
	}
	.reveal-pop :global(svg g) {
		animation-name: geometrize-shape-pop;
	}
	.reveal-scatter :global(svg g) {
		animation-name: geometrize-shape-scatter;
	}

	@keyframes -global-geometrize-shape-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes -global-geometrize-shape-pop {
		from {
			opacity: 0;
			transform: scale(0.5);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@keyframes -global-geometrize-shape-scatter {
		from {
			opacity: 0;
			transform: translate(var(--gdx, 0), var(--gdy, 0)) scale(0.7);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	picture {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}

	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity var(--geometrize-fade-ms, 600ms) cubic-bezier(0.4, 0, 0.2, 1);
		will-change: opacity;
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
