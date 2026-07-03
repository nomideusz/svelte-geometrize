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
		/** Crossfade duration of the photo once loaded, in ms. Default 600. */
		fadeDuration?: number;
	}

	let {
		placeholder,
		src,
		alt,
		class: className = '',
		stagger = 15,
		shapeDuration = 400,
		fadeDuration = 600,
		...rest
	}: Props = $props();

	let img: HTMLImageElement | undefined = $state();
	let loaded = $state(false);
	let revealToken = 0; // bumped on every src change to cancel a stale pending reveal

	// Flip `loaded` (which triggers the crossfade) only after the browser has painted the
	// img at opacity:0 — otherwise a cached/already-complete image jumps straight to
	// opacity:1 with no transition to animate from, i.e. a hard cut instead of a crossfade.
	function reveal() {
		const el = img;
		if (!el || !el.complete || el.naturalWidth === 0) return; // not ready / broken → keep placeholder
		const token = revealToken;
		const flip = () => {
			const e2 = img;
			if (token !== revealToken || !e2 || !e2.complete || e2.naturalWidth === 0) return;
			// two frames guarantees the opacity:0 state was committed before transitioning to 1
			requestAnimationFrame(() =>
				requestAnimationFrame(() => {
					if (token === revealToken) loaded = true;
				})
			);
		};
		// decode first so the first crossfade frame is paint-ready, then flip on a later frame
		if (el.decode) el.decode().then(flip, flip);
		else flip();
	}

	// On every src change: restart hidden, then reveal once the bitmap is ready. The call
	// here covers images already complete before the onload handler binds (cache, hydration);
	// the onload handler covers the normal over-the-network case.
	$effect(() => {
		void src;
		revealToken++;
		loaded = false;
		if (src) reveal();
	});

	// Built as one string (not Svelte-templated shapes) so the fragments live in a
	// real SVG namespace; per-shape reveal order is encoded as inline animation-delay.
	// Delays are spaced ease-in (i**1.6), keeping the same end time as a linear ramp
	// but landing the coarse shapes fast and trickling the fine detail, so the reveal
	// decelerates into stillness instead of stopping abruptly while the photo loads.
	const svgMarkup = $derived.by(() => {
		const last = Math.max(placeholder.s.length - 1, 1);
		return (
			`<svg viewBox="0 0 ${placeholder.fw} ${placeholder.fh}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
			`<rect width="${placeholder.fw}" height="${placeholder.fh}" fill="${placeholder.bg}"/>` +
			placeholder.s
				.map((frag, i) => {
					const delay = Math.round((i / last) ** 1.6 * last * stagger);
					return `<g style="animation-delay:${delay}ms">${frag}</g>`;
				})
				.join('') +
			`</svg>`
		);
	});
</script>

<div
	class="geometrize {className}"
	style:aspect-ratio="{placeholder.w} / {placeholder.h}"
	style:--geometrize-shape-ms="{shapeDuration}ms"
	style:--geometrize-fade-ms="{fadeDuration}ms"
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
			decoding="async"
			onload={reveal}
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

	/* The placeholder never moves or blurs — it's the viewer's anchor. Any pending
	   shapes just keep trickling in during the handoff: under the dissolving photo
	   they're barely visible, and the continued motion smooths a fast (cached) load
	   instead of snapping to a finished placeholder. */
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
		/* A plain dissolve — no blur, no scale, and the placeholder never moves.
		   The shapes are fitted to this exact photo, so the sharp photo fading in
		   reads as the final refinement step (fine detail arriving over the same
		   structure), not as two different images swapping. Blur was tried here and
		   read as the crisp geometry suddenly going soft. */
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
