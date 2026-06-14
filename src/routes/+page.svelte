<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { GeometrizedImage } from '$lib/index.js';
	import type { ShapeKind, GeometrizeOptions, GeometrizePlaceholder } from '$lib/index.js';
	import FitWorker from './fit.worker.ts?worker';

	// Build-time placeholder for the first paint — the real product. Matches the
	// default controls below (triangles, 100 shapes); changing anything re-fits live.
	import initialPlaceholder from './demo-photo.jpg?geometrize';
	import demoPhoto from './demo-photo.jpg';

	const INSTALL = 'pnpm add @nomideusz/svelte-geometrize';
	const USAGE = `import { GeometrizedImage } from '@nomideusz/svelte-geometrize';
import placeholder from './photo.jpg?geometrize';
import src from './photo.jpg';

<GeometrizedImage {placeholder} {src} alt="Sunset over mountains" />`;

	const SHAPE_KINDS: { key: ShapeKind; label: string }[] = [
		{ key: 'triangle', label: 'Triangles' },
		{ key: 'ellipse', label: 'Ellipses' },
		{ key: 'rotated-ellipse', label: 'Rotated ellipses' },
		{ key: 'rectangle', label: 'Rectangles' },
		{ key: 'rotated-rectangle', label: 'Rotated rectangles' },
		{ key: 'circle', label: 'Circles' },
		{ key: 'line', label: 'Lines' },
		{ key: 'quadratic-bezier', label: 'Béziers' }
	];

	const MAX_SIZE = 128; // longest edge the fitter works in — keeps it fast at any upload size
	// Reveal pacing: spread all the shapes across ~SHAPE_REVEAL_MS regardless of how many
	// there are, then hand off to the photo a beat after they land — so changing the shape
	// count never cuts the build-up short or jumps to the photo early.
	const SHAPE_REVEAL_MS = 850; // target time for the staggered shapes to finish appearing
	const SHAPE_DURATION = 400; // per-shape fade (matches what we pass to the component)
	const HANDOFF_PAUSE = 250; // beat between the last shape and the photo crossfade

	// ── Image source ────────────────────────────────────
	let mode = $state<'sample' | 'upload'>('sample');
	let uploadUrl = $state('');
	let uploadName = $state('');
	let uploadBytes = $state(0);
	let sampleBytes = $state(0);
	let fileInput = $state<HTMLInputElement>();

	const imageSrc = $derived(mode === 'upload' && uploadUrl ? uploadUrl : demoPhoto);
	const photoBytes = $derived(mode === 'upload' ? uploadBytes : sampleBytes);

	// ── Fit options ─────────────────────────────────────
	let selectedTypes = $state<ShapeKind[]>(['triangle']);
	let shapeCount = $state(100);
	let alpha = $state(128);

	// ── Result + reveal state ───────────────────────────
	let placeholder = $state<GeometrizePlaceholder>(initialPlaceholder);
	let fitting = $state(false);
	let fitMs = $state(0);
	let run = $state(0);
	let revealSrc = $state('');
	let copied = $state(false);

	// ── Live byte numbers, measured not guessed ─────────
	const rawBytes = $derived(new TextEncoder().encode(JSON.stringify(placeholder)).length);
	let gzipBytes = $state(0);
	const inlineBytes = $derived(gzipBytes || rawBytes);
	const lighter = $derived(photoBytes && inlineBytes ? Math.round(photoBytes / inlineBytes) : 0);

	// ── Reveal timing, scaled to the shape count ────────
	// Per-shape gap so the whole reveal lasts ~SHAPE_REVEAL_MS no matter the count
	// (clamped so few shapes aren't sluggish and many aren't a blur).
	const revealStagger = $derived(
		Math.min(40, Math.max(4, Math.round(SHAPE_REVEAL_MS / Math.max(placeholder.s.length - 1, 1))))
	);
	// When the last shape has finished fading in — used to time the photo handoff.
	const revealEndMs = $derived((placeholder.s.length - 1) * revealStagger + SHAPE_DURATION);

	// Lean fit settings for the live demo — full quality runs at build time; here we
	// trade a little fidelity for snappy, interactive re-fitting at 128px.
	const LIVE_TUNING = { candidateShapesPerStep: 30, shapeMutationsPerStep: 50 };
	const WORKER_TIMEOUT = 2000; // ms before assuming the worker is dead and fitting on the main thread

	// ── Worker plumbing ─────────────────────────────────
	let worker: Worker | undefined;
	let workerOk = true;
	let latestToken = 0;
	let fitStart = 0;
	let watchdog: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		try {
			worker = new FitWorker();
			worker.onmessage = (e: MessageEvent) => {
				const msg = e.data as
					| { token: number; ok: true; placeholder: GeometrizePlaceholder }
					| { token: number; ok: false; error: string };
				if (msg.token !== latestToken) return; // a newer request superseded this one
				clearTimeout(watchdog);
				if (msg.ok) applyResult(msg.token, msg.placeholder);
				else {
					fitting = false;
					console.error('svelte-geometrize: fit failed —', msg.error);
				}
			};
			worker.onerror = (e) => {
				console.warn('svelte-geometrize: worker failed, fitting on the main thread —', e.message);
				workerOk = false;
			};
		} catch {
			workerOk = false;
		}

		// measure the sample photo's transfer size once
		fetch(demoPhoto)
			.then((r) => r.blob())
			.then((b) => (sampleBytes = b.size))
			.catch(() => {});

		return () => {
			clearTimeout(watchdog);
			worker?.terminate();
			if (uploadUrl) URL.revokeObjectURL(uploadUrl);
		};
	});

	// Re-fit (debounced) whenever the image or any option changes. The first run is
	// skipped so the build-time placeholder stays until the user actually changes something.
	let primed = false;
	$effect(() => {
		const types = selectedTypes;
		const n = shapeCount;
		const a = alpha;
		const url = imageSrc;
		if (!primed) {
			primed = true;
			return;
		}
		fitting = true;
		const token = ++latestToken;
		// `types` is a reactive $state proxy — spread to a plain array so the options
		// object can be structured-cloned across to the worker (a Proxy cannot).
		const options: GeometrizeOptions = { shapeTypes: [...types], shapes: n, alpha: a, ...LIVE_TUNING };
		const t = setTimeout(() => void runFit(token, url, options), 280);
		return () => clearTimeout(t);
	});

	function applyResult(token: number, result: GeometrizePlaceholder) {
		if (token !== latestToken) return;
		fitting = false;
		fitMs = Math.round(performance.now() - fitStart);
		placeholder = result;
		playReveal();
	}

	async function runFit(token: number, url: string, options: GeometrizeOptions) {
		try {
			const { rgba, w, h, sw, sh } = await rgbaFor(url);
			if (token !== latestToken) return; // superseded while decoding
			fitStart = performance.now();
			if (worker && workerOk) {
				try {
					worker.postMessage({ token, rgba, w, h, sw, sh, options }, [rgba.buffer]);
				} catch (postErr) {
					// e.g. a value that can't be structured-cloned — fit on the main thread instead
					console.warn('svelte-geometrize: worker postMessage failed, using main thread —', postErr);
					workerOk = false;
					await fitOnMainThread(token, url, options);
					return;
				}
				// if the worker never answers (e.g. it died loading deps), fit on the main thread
				clearTimeout(watchdog);
				watchdog = setTimeout(() => {
					if (token !== latestToken || !fitting) return;
					workerOk = false;
					void fitOnMainThread(token, url, options);
				}, WORKER_TIMEOUT);
			} else {
				await fitOnMainThread(token, url, options);
			}
		} catch (err) {
			if (token === latestToken) fitting = false;
			console.error('svelte-geometrize: could not read image —', err);
		}
	}

	// Fallback: the same fitter, on the main thread. ~0.5s of work, so it only runs
	// when the worker is unavailable. Re-decodes because the worker took the pixels.
	async function fitOnMainThread(token: number, url: string, options: GeometrizeOptions) {
		const { fitShapes } = await import('$lib/core/fit.js');
		const { rgba, w, h, sw, sh } = await rgbaFor(url);
		if (token !== latestToken) return;
		await new Promise((r) => requestAnimationFrame(r)); // let "Fitting…" paint first
		if (token !== latestToken) return;
		applyResult(token, fitShapes(rgba, w, h, sw, sh, options));
	}

	// Decode + downscale the image to MAX_SIZE and read its pixels (the browser's
	// stand-in for sharp). Object URLs and bundled assets are same-origin, so the
	// canvas never taints.
	async function rgbaFor(url: string) {
		const im = new Image();
		im.decoding = 'async';
		im.src = url;
		await im.decode();
		const sw = im.naturalWidth;
		const sh = im.naturalHeight;
		const scale = Math.min(1, MAX_SIZE / Math.max(sw, sh));
		const w = Math.max(1, Math.round(sw * scale));
		const h = Math.max(1, Math.round(sh * scale));
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) throw new Error('no 2d canvas context');
		ctx.drawImage(im, 0, 0, w, h);
		return { rgba: ctx.getImageData(0, 0, w, h).data, w, h, sw, sh };
	}

	// Replay the reveal. Resetting revealSrc *in the same update* as the key bump is
	// what makes Replay match a fresh load: otherwise {#key} recreates the component
	// while src is still the loaded photo, so it flashes the photo before resetting.
	function playReveal() {
		revealSrc = '';
		run += 1;
	}

	$effect(() => {
		void run;
		revealSrc = '';
		// read untracked: this should re-fire only on replay/refit (run), not when the
		// derived timing values change on their own
		const url = untrack(() => imageSrc);
		const delay = untrack(() => revealEndMs) + HANDOFF_PAUSE;
		const t = setTimeout(() => (revealSrc = url), delay);
		return () => clearTimeout(t);
	});

	// gzip the placeholder JSON — its real over-the-wire cost — whenever it changes
	$effect(() => {
		const json = JSON.stringify(placeholder);
		let cancelled = false;
		gzipSize(json).then((b) => {
			if (!cancelled) gzipBytes = b;
		});
		return () => {
			cancelled = true;
		};
	});

	async function gzipSize(text: string): Promise<number> {
		const CS = (globalThis as { CompressionStream?: new (f: string) => unknown }).CompressionStream;
		if (!CS) return 0;
		try {
			const stream = new Blob([text]).stream().pipeThrough(new CS('gzip') as ReadableWritablePair);
			return (await new Response(stream).arrayBuffer()).byteLength;
		} catch {
			return 0;
		}
	}

	// ── Control handlers ────────────────────────────────
	function toggleType(key: ShapeKind) {
		if (selectedTypes.includes(key)) {
			if (selectedTypes.length === 1) return; // keep at least one
			selectedTypes = selectedTypes.filter((k) => k !== key);
		} else {
			selectedTypes = [...selectedTypes, key];
		}
	}

	function onFile(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (uploadUrl) URL.revokeObjectURL(uploadUrl);
		uploadUrl = URL.createObjectURL(file);
		uploadName = file.name;
		uploadBytes = file.size;
		mode = 'upload';
		(e.currentTarget as HTMLInputElement).value = ''; // allow re-picking the same file
	}

	function useSample() {
		mode = 'sample';
	}

	function copyInstall() {
		navigator.clipboard.writeText(INSTALL);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	const kb = (bytes: number) => {
		const v = bytes / 1024;
		return v >= 100 ? String(Math.round(v)) : v.toFixed(1);
	};
</script>

<svelte:head>
	<title>svelte-geometrize — Demo</title>
	<meta
		name="description"
		content="Geometric image placeholders for Svelte 5. Triangles resolve into the real photo while it loads — build-time shape fitting, tiny runtime."
	/>
</svelte:head>

<main>
	<section class="hero">
		<h1>Geometric image placeholders for Svelte 5</h1>
		<p class="lead">
			No blur. The placeholder <em>is</em> the image, approximated by geometric shapes fitted at
			build time — and because they're stored in fit order, replaying them makes the picture
			visibly sharpen until the real photo crossfades in.
		</p>
		<button class="install" onclick={copyInstall}>
			<span class="prompt" aria-hidden="true">$</span>
			<code>{INSTALL}</code>
			<span class="copy">{copied ? 'copied ✓' : 'copy'}</span>
		</button>
	</section>

	<!-- ═══ Playground ═════════════════════════════════════ -->
	<section class="card">
		<header class="card-hd">
			<h2>Playground</h2>
			<span class="hd-meta">fitted live in your browser — in production this runs at build time</span>
		</header>

		<div class="playground">
			<div class="preview">
				<div class="frame">
					{#key run}
						<GeometrizedImage
							{placeholder}
							src={revealSrc}
							stagger={revealStagger}
							shapeDuration={SHAPE_DURATION}
							alt="Geometrized preview"
						/>
					{/key}
					{#if fitting}
						<div class="fitting" aria-live="polite">Fitting…</div>
					{/if}
				</div>

				<div class="preview-actions">
					<button class="replay" onclick={playReveal}>↻ Replay reveal</button>
					<span class="dims">{placeholder.w}×{placeholder.h}</span>
				</div>

				<dl class="stats">
					<div class="stat stat--accent">
						<dt>Inline placeholder</dt>
						<dd>{kb(inlineBytes)} KB</dd>
						<span class="stat-sub">{gzipBytes ? 'gzipped' : `${kb(rawBytes)} raw`}</span>
					</div>
					<div class="stat stat--accent">
						<dt>Lighter first paint</dt>
						<dd>{lighter ? `${lighter}×` : '—'}</dd>
						<span class="stat-sub">vs. the photo</span>
					</div>
					<div class="stat">
						<dt>Shapes</dt>
						<dd>{placeholder.s.length}</dd>
						<span class="stat-sub">in fit order</span>
					</div>
					<div class="stat">
						<dt>Fit time</dt>
						<dd>{fitMs ? `${fitMs} ms` : 'build'}</dd>
						<span class="stat-sub">{fitMs ? 'in-browser' : 'prebuilt'}</span>
					</div>
				</dl>
			</div>

			<div class="controls">
				<div class="control">
					<span class="control-label">Image</span>
					<div class="seg">
						<button class="seg-btn" class:seg-btn--on={mode === 'sample'} onclick={useSample}>
							Sample
						</button>
						<button
							class="seg-btn"
							class:seg-btn--on={mode === 'upload'}
							onclick={() => fileInput?.click()}
						>
							Upload…
						</button>
					</div>
					<input
						bind:this={fileInput}
						type="file"
						accept="image/*"
						onchange={onFile}
						hidden
					/>
					{#if mode === 'upload' && uploadName}
						<span class="img-name" title={uploadName}>{uploadName}</span>
					{:else}
						<span class="img-hint">Pick any photo — it's geometrized on your device, nothing is uploaded.</span>
					{/if}
				</div>

				<div class="control">
					<span class="control-label">Shape types</span>
					<div class="chips">
						{#each SHAPE_KINDS as s}
							<button
								class="chip"
								class:chip--on={selectedTypes.includes(s.key)}
								onclick={() => toggleType(s.key)}
								aria-pressed={selectedTypes.includes(s.key)}
							>
								{s.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="control">
					<label class="control-label" for="c-shapes">Shapes <code>{shapeCount}</code></label>
					<input id="c-shapes" type="range" min="20" max="200" step="5" bind:value={shapeCount} />
					<span class="control-hint">more shapes = more detail, bigger payload</span>
				</div>

				<div class="control">
					<label class="control-label" for="c-alpha">Shape opacity <code>{alpha}</code></label>
					<input id="c-alpha" type="range" min="32" max="255" step="1" bind:value={alpha} />
					<span class="control-hint">lower = more layered, translucent shapes</span>
				</div>
			</div>
		</div>
	</section>

	<!-- ═══ How it works ═══════════════════════════════════ -->
	<section class="card">
		<header class="card-hd">
			<h2>How it works</h2>
			<span class="hd-meta">a real preview in a couple of KB — no blank box, no layout shift, no blur</span>
		</header>

		<ol class="steps">
			<li>
				<span class="num">01</span>
				<h3>Fit at build time</h3>
				<p>
					A Vite plugin fits geometric shapes to each <code>?geometrize</code> import. The
					expensive part never ships — the browser just gets a few KB of ordered SVG shapes,
					and the runtime stays tiny and dependency-free.
				</p>
			</li>
			<li>
				<span class="num">02</span>
				<h3>Paint instantly, no layout shift</h3>
				<p>
					The placeholder is inline in the server-rendered HTML, so a real preview fills the box
					before the photo's first byte arrives — and because its aspect ratio is reserved,
					nothing below it ever jumps.
				</p>
			</li>
			<li>
				<span class="num">03</span>
				<h3>Reveal, then crossfade</h3>
				<p>
					Pure CSS sharpens the shapes in — before hydration, respecting reduced motion — then
					the real photo resolves over the top. Content-aware, so it's the picture coming into
					focus, not a blur.
				</p>
			</li>
		</ol>
	</section>

	<!-- ═══ Usage ══════════════════════════════════════════ -->
	<section class="card">
		<header class="card-hd">
			<h2>Use it</h2>
			<span class="hd-meta">register the Vite plugin, then import with <code>?geometrize</code></span>
		</header>

		<pre class="snippet">{USAGE}</pre>
	</section>

	<section class="cta">
		<p>Full options and the Node API are in the <a href="/docs">docs</a>.</p>
	</section>
</main>

<style>
	main {
		max-width: 1000px;
		margin: 0 auto;
		padding: 24px 24px 80px;
	}
	@media (max-width: 600px) {
		main {
			padding: 16px 16px 48px;
		}
	}

	/* ─── Hero ─────────────────────────────────────────── */
	.hero {
		text-align: center;
		padding: 40px 0 48px;
		background-image: radial-gradient(ellipse 56% 60% at 50% 30%, var(--accent-dim), transparent);
	}
	.hero h1 {
		font: 700 clamp(30px, 5vw, 40px)/1.12 'Outfit', system-ui, sans-serif;
		letter-spacing: -0.02em;
		margin: 0 0 16px;
		color: var(--text);
	}
	.hero .lead {
		font: 400 15px/1.65 'Outfit', system-ui, sans-serif;
		color: var(--text-2);
		max-width: 560px;
		margin: 0 auto 28px;
	}
	.hero .lead em {
		font-style: italic;
		color: var(--text);
	}
	.install {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		background: var(--surface);
		cursor: pointer;
		transition: border-color 120ms;
	}
	.install:hover {
		border-color: var(--accent);
	}
	.install .prompt {
		color: var(--accent);
		font: 500 13px/1 ui-monospace, 'Cascadia Code', monospace;
	}
	.install code {
		font: 400 13px/1 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text);
	}
	.install .copy {
		font: 600 9.5px/1 'Outfit', system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-3);
		padding-left: 10px;
		border-left: 1px solid var(--border);
	}
	@media (max-width: 600px) {
		.hero {
			padding: 16px 0 28px;
		}
		.hero h1 {
			font-size: 28px;
		}
	}

	/* ─── Card ─────────────────────────────────────────── */
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 20px;
		margin-bottom: 20px;
	}
	.card-hd {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 14px;
		margin-bottom: 18px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--border);
	}
	.card-hd h2 {
		font: 600 16px/1.3 'Outfit', system-ui, sans-serif;
		margin: 0;
		color: var(--text);
	}
	.hd-meta {
		font: 400 11px/1.4 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text-3);
	}
	.hd-meta code {
		font: 500 11px/1.3 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text-2);
		background: var(--surface-2);
		padding: 1px 5px;
		border-radius: 3px;
	}

	/* ─── Playground layout ────────────────────────────── */
	.playground {
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: 24px;
	}
	@media (max-width: 760px) {
		.playground {
			grid-template-columns: 1fr;
		}
	}

	.preview {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.frame {
		position: relative;
		border: 1px solid var(--border-strong);
		border-radius: 10px;
		overflow: hidden;
		background: var(--surface-2);
	}
	.fitting {
		position: absolute;
		top: 10px;
		right: 10px;
		padding: 4px 10px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--bg) 70%, transparent);
		border: 1px solid var(--border-strong);
		font: 600 10px/1 'Outfit', system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent);
		backdrop-filter: blur(4px);
	}

	.preview-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.replay {
		font: 600 11px/1 'Outfit', system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #fff;
		background: var(--accent);
		border: none;
		padding: 9px 16px;
		border-radius: 6px;
		cursor: pointer;
		transition: background 120ms;
	}
	.replay:hover {
		background: var(--accent-2);
	}
	.dims {
		font: 500 12px/1 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text-3);
	}

	/* ─── Stats ────────────────────────────────────────── */
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: 8px;
		margin: 0;
	}
	.stat {
		padding: 12px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: center;
	}
	.stat--accent {
		border-color: var(--accent-glow);
		background: var(--accent-dim);
	}
	.stat dt {
		font: 600 9.5px/1.2 'Outfit', system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-3);
	}
	.stat dd {
		margin: 0;
		font: 700 18px/1.1 'Outfit', system-ui, sans-serif;
		color: var(--text);
	}
	.stat--accent dd {
		color: var(--accent);
	}
	.stat-sub {
		font: 400 10px/1.2 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text-3);
	}

	/* ─── Controls ─────────────────────────────────────── */
	.controls {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.control {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.control-label {
		font: 600 10px/1.2 'Outfit', system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--text-3);
	}
	.control-label code {
		font: 500 11px/1 ui-monospace, 'Cascadia Code', monospace;
		color: var(--accent);
		background: var(--accent-dim);
		padding: 1px 6px;
		border-radius: 4px;
		text-transform: none;
		letter-spacing: 0;
		margin-left: 4px;
	}
	.control-hint {
		font: 400 11px/1.3 'Outfit', system-ui, sans-serif;
		color: var(--text-3);
	}
	.control input[type='range'] {
		width: 100%;
		accent-color: var(--accent);
	}

	.seg {
		display: inline-flex;
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: 6px;
		overflow: hidden;
		width: max-content;
	}
	.seg-btn {
		padding: 8px 16px;
		background: transparent;
		border: none;
		color: var(--text-2);
		font: 600 11px/1 'Outfit', system-ui, sans-serif;
		cursor: pointer;
		transition: color 120ms, background 120ms;
	}
	.seg-btn:hover {
		color: var(--text);
	}
	.seg-btn--on {
		background: var(--accent-dim);
		color: var(--accent);
	}
	.img-name {
		font: 500 11.5px/1.3 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.img-hint {
		font: 400 11px/1.4 'Outfit', system-ui, sans-serif;
		color: var(--text-3);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		padding: 5px 10px;
		border: 1px solid var(--border-strong);
		border-radius: 20px;
		background: transparent;
		color: var(--text-2);
		font: 500 11px/1 'Outfit', system-ui, sans-serif;
		cursor: pointer;
		transition: color 120ms, border-color 120ms, background 120ms;
	}
	.chip:hover {
		color: var(--text);
		border-color: var(--accent);
	}
	.chip--on {
		background: var(--accent-dim);
		border-color: var(--accent-glow);
		color: var(--accent);
	}

	/* ─── How it works ─────────────────────────────────── */
	.steps {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
		padding: 0;
		margin: 0;
	}
	.steps li {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 16px;
	}
	.num {
		font: 600 11px/1 ui-monospace, 'Cascadia Code', monospace;
		color: var(--accent);
	}
	.steps h3 {
		font: 600 14px/1.3 'Outfit', system-ui, sans-serif;
		margin: 8px 0 6px;
		color: var(--text);
	}
	.steps p {
		font: 400 13px/1.55 'Outfit', system-ui, sans-serif;
		color: var(--text-2);
		margin: 0;
	}
	code {
		font: 500 12px/1 ui-monospace, 'Cascadia Code', monospace;
		color: var(--accent);
		background: var(--accent-dim);
		padding: 1px 5px;
		border-radius: 3px;
	}

	/* ─── Usage snippet ────────────────────────────────── */
	.snippet {
		margin: 0;
		padding: 14px 16px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 8px;
		font: 400 12.5px/1.6 ui-monospace, 'Cascadia Code', monospace;
		color: var(--text);
		overflow-x: auto;
		white-space: pre;
	}

	/* ─── CTA ──────────────────────────────────────────── */
	.cta {
		text-align: center;
		padding: 16px 0 0;
		font: 400 14px/1.5 'Outfit', system-ui, sans-serif;
		color: var(--text-2);
	}
	.cta a {
		color: var(--accent);
		border-bottom: 1px solid var(--accent-glow);
		transition: border-color 120ms;
	}
	.cta a:hover {
		border-bottom-color: var(--accent);
	}

	@media (max-width: 720px) {
		.steps {
			grid-template-columns: 1fr;
		}
	}
</style>
