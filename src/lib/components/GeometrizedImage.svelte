<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';
	import type { GeometrizePlaceholder } from '../core/types.js';
	import { shapeFragments, shapeGroupOpen } from '../core/svg.js';

	export interface GeometrizeSource {
		srcset: string;
		type?: string;
		media?: string;
		sizes?: string;
	}

	export type GeometrizeReveal = 'fade' | 'pop' | 'scatter';

	export type GeometrizeObjectFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

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
		/**
		 * Total time (ms) until the last shape starts appearing. Derives per-shape
		 * stagger from the shape count so the reveal spans a fixed budget.
		 * Overrides `stagger` when set.
		 */
		revealMs?: number;
		/** Delay between consecutive shapes appearing, in ms. Default 15. Ignored when `revealMs` is set. */
		stagger?: number;
		/** Fade-in duration of each individual shape, in ms. Default 400. */
		shapeDuration?: number;
		/** How long the photo takes to come into focus once loaded, in ms. Default 800. */
		fadeDuration?: number;
		/** object-fit for the photo (and matching SVG preserveAspectRatio). Default 'cover'. */
		objectFit?: GeometrizeObjectFit;
		/**
		 * object-position for the photo, and the placeholder follows it. Keywords,
		 * percentages or lengths (`'top'`, `'30% 70%'`); not `var()`. Default 'center'.
		 */
		objectPosition?: string;
	}

	let {
		placeholder,
		src,
		srcset,
		sources = [],
		alt,
		class: className = '',
		reveal: revealKind = 'fade',
		revealMs,
		stagger = 15,
		shapeDuration = 400,
		fadeDuration = 800,
		objectFit = 'cover',
		objectPosition = 'center',
		onload,
		onerror,
		width,
		height,
		...rest
	}: Props = $props();

	let img: HTMLImageElement | undefined = $state();
	let loaded = $state(false);
	let revealToken = 0; // bumped on every src/sources change to cancel a stale pending reveal

	const fragments = $derived(shapeFragments(placeholder));

	const effectiveStagger = $derived(
		revealMs !== undefined
			? Math.max(0, Math.round(revealMs / Math.max(fragments.length - 1, 1)))
			: stagger
	);

	// object-position as the svg's left/top plus a translate by the same percentage
	// of its own size: offset = p·(box − svg), exactly how object-position places the
	// photo. A length offsets as-is (no translate). Centre is the CSS fallback, so
	// it emits nothing.
	const KEYWORD: Record<string, string> = { left: '0%', top: '0%', center: '50%', right: '100%', bottom: '100%' };
	const position = $derived.by(() => {
		let [x = 'center', y = 'center'] = objectPosition.trim().split(/\s+/);
		if (x === 'top' || x === 'bottom' || y === 'left' || y === 'right') [x, y] = [y, x];
		return [x, y].map((v) => {
			const at = KEYWORD[v] ?? v;
			return at === '50%' ? [] : [at, at.endsWith('%') ? `calc(-1 * ${at})` : '0px'];
		});
	});

	const preserveAspectRatio = $derived(
		objectFit === 'contain'
			? 'xMidYMid meet'
			: objectFit === 'fill'
				? 'none'
				: 'xMidYMid slice'
	);

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

	function handleLoad(e: Event) {
		reveal();
		onload?.(e as unknown as Parameters<NonNullable<typeof onload>>[0]);
	}

	function handleError(e: Event) {
		loaded = false;
		onerror?.(e as unknown as Parameters<NonNullable<typeof onerror>>[0]);
	}

	$effect(() => {
		void src;
		void srcset;
		void sources;
		revealToken++;
		loaded = false;
		if (src || srcset || (sources && sources.length > 0)) reveal();
	});

	// Each shape carries only its index; the stagger and the scatter direction are
	// worked out in CSS from it, so the inline markup stays the shapes themselves.
	const svgMarkup = $derived(
		`<svg viewBox="0 0 ${placeholder.fw} ${placeholder.fh}" preserveAspectRatio="${preserveAspectRatio}" aria-hidden="true">` +
			`<rect width="${placeholder.fw}" height="${placeholder.fh}" fill="${placeholder.bg}"/>` +
			shapeGroupOpen(placeholder) +
			fragments
				.map((frag, i) =>
					// a rotated shape keeps a wrapper: the reveal's CSS transform would
					// replace its own transform attribute
					frag.includes(' transform=')
						? `<g style="--i:${i}">${frag}</g>`
						: frag.replace(/^<\w+/, `$& style="--i:${i}"`)
				)
				.join('') +
			`</g></svg>`
	);

	const intrinsic = $derived(objectFit === 'none' || objectFit === 'scale-down');
	const hasSrc = $derived(!!(src || srcset || sources.length));
	const imgWidth = $derived(width ?? placeholder.w);
	const imgHeight = $derived(height ?? placeholder.h);
</script>

<div
	class="geometrize reveal-{revealKind} fit-{objectFit} {className}"
	class:loaded
	style:aspect-ratio="{placeholder.w} / {placeholder.h}"
	style:--geometrize-shape-ms="{shapeDuration}ms"
	style:--geometrize-fade-ms="{fadeDuration}ms"
	style:--geometrize-last={Math.max(fragments.length - 1, 1)}
	style:--geometrize-gap={effectiveStagger}
	style:--geometrize-dist={revealKind === 'scatter' ? `${placeholder.fw * 0.1}px` : undefined}
	style:--geometrize-object-fit={objectFit}
	style:--geometrize-object-position={objectPosition}
	style:--geometrize-ratio={placeholder.w / placeholder.h}
	style:--geometrize-w={intrinsic ? `${placeholder.w}px` : undefined}
	style:--geometrize-h={intrinsic ? `${placeholder.h}px` : undefined}
	style:--geometrize-x={position[0][0]}
	style:--geometrize-y={position[1][0]}
	style:--geometrize-tx={position[0][1]}
	style:--geometrize-ty={position[1][1]}
	role={hasSrc ? undefined : 'img'}
	aria-label={hasSrc ? undefined : alt}
	aria-busy={!loaded && hasSrc}
>
	{@html svgMarkup}
	{#if hasSrc}
		{#if sources.length > 0}
			<picture>
				{#each sources as source (`${source.media}|${source.type}|${source.srcset}`)}
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
					width={imgWidth}
					height={imgHeight}
					class:loaded
					decoding="async"
					onload={handleLoad}
					onerror={handleError}
				/>
			</picture>
		{:else}
			<img
				bind:this={img}
				{...rest}
				{src}
				{srcset}
				{alt}
				width={imgWidth}
				height={imgHeight}
				class:loaded
				decoding="async"
				onload={handleLoad}
				onerror={handleError}
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
		container-type: size; /* cq units below: the svg takes the box the photo takes */
	}

	/* The placeholder takes the photo's box under object-fit / object-position, so a
	   box that isn't the photo's shape crops both the same way. 100% × 100% is `fill`,
	   and the fallback where cq units don't exist. */
	.geometrize :global(svg) {
		position: absolute;
		left: var(--geometrize-x, 50%);
		top: var(--geometrize-y, 50%);
		translate: var(--geometrize-tx, -50%) var(--geometrize-ty, -50%);
		width: 100%;
		height: 100%;
		display: block;
	}
	.fit-cover :global(svg) {
		width: max(100cqw, 100cqh * var(--geometrize-ratio));
		height: max(100cqh, 100cqw / var(--geometrize-ratio));
	}
	.fit-contain :global(svg) {
		width: min(100cqw, 100cqh * var(--geometrize-ratio));
		height: min(100cqh, 100cqw / var(--geometrize-ratio));
	}
	.fit-none :global(svg) {
		width: var(--geometrize-w);
		height: var(--geometrize-h);
	}
	.fit-scale-down :global(svg) {
		width: min(100cqw, 100cqh * var(--geometrize-ratio), var(--geometrize-w));
		height: min(100cqh, 100cqw / var(--geometrize-ratio), var(--geometrize-h));
	}
	/* Once the photo has faded in, stop painting the placeholder under it — a
	   transparent PNG would otherwise show the shapes through forever. */
	.loaded :global(svg) {
		visibility: hidden;
		transition: visibility 0s var(--geometrize-fade-ms, 800ms);
	}

	/* Shape i starts at (i/last)^1.6 · last · gap ms: quick through the big shapes,
	   slowing into the detail. */
	.geometrize :global(svg > g > *) {
		transform-box: fill-box; /* scale/translate around each shape's own center, not the SVG origin */
		transform-origin: center;
		animation: geometrize-shape-in var(--geometrize-shape-ms, 400ms) ease-out both;
		animation-delay: calc(
			pow(var(--i) / var(--geometrize-last), 1.6) * var(--geometrize-last) * var(--geometrize-gap) *
				1ms
		);
	}
	.reveal-pop :global(svg > g > *) {
		animation-name: geometrize-shape-pop;
	}
	/* each shape flies in from its own direction, a golden angle past the last one's */
	.reveal-scatter :global(svg > g > *) {
		animation-name: geometrize-shape-scatter;
		--gdx: calc(cos(var(--i) * 2.39996rad) * var(--geometrize-dist));
		--gdy: calc(sin(var(--i) * 2.39996rad) * var(--geometrize-dist));
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

	/* The handoff is a focus pull, not a crossfade: the photo comes in out of focus
	   — about as coarse as the shapes, so they melt into it instead of ghosting
	   through — is opaque by 45% of the fade, and sharpens for the rest, the way the
	   shapes did. `--geometrize-focus: 0px` makes it a plain fade. */
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: var(--geometrize-object-fit, cover);
		object-position: var(--geometrize-object-position, center);
		opacity: 0;
		filter: blur(var(--geometrize-focus, 2cqw));
		transition:
			opacity calc(var(--geometrize-fade-ms, 800ms) * 0.45) ease-out,
			filter var(--geometrize-fade-ms, 800ms) ease-out;
	}

	img.loaded {
		opacity: 1;
		filter: none;
	}

	/* nothing will ever add .loaded without JS — show the photo as it arrives */
	@media (scripting: none) {
		img {
			opacity: 1;
			filter: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.geometrize :global(svg > g > *) {
			animation: none;
		}
		img {
			transition-duration: 0ms !important;
		}
	}
</style>
