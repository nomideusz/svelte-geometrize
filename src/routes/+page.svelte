<script lang="ts">
	import { GeometrizedImage } from '$lib/index.js';
	import VariantCard from './VariantCard.svelte';

	import placeholder from './demo-photo.jpg?geometrize';
	import photo from './demo-photo.jpg';
	import lakePlaceholder from './demo-lake.jpg?shapes=70&shapeTypes=ellipse&geometrize';
	import lakePhoto from './demo-lake.jpg';
	import dunesPlaceholder from './demo-dunes.jpg?shapes=70&shapeTypes=rotated-rectangle&geometrize';
	import dunesPhoto from './demo-dunes.jpg';
	import auroraPlaceholder from './demo-aurora.jpg?shapes=80&shapeTypes=rotated-ellipse&geometrize';
	import auroraPhoto from './demo-aurora.jpg';

	const INSTALL = 'pnpm add @nomideusz/svelte-geometrize';
	const USAGE = `import { GeometrizedImage } from '@nomideusz/svelte-geometrize';
import placeholder from './photo.jpg?geometrize';
import src from './photo.jpg';

<GeometrizedImage {placeholder} {src} alt="Sunset over mountains" />`;

	let run = $state(0);
	let delayMs = $state(2500);
	let stagger = $state(15);
	let src = $state('');
	let copied = $state(false);

	// simulate a slow network: hand the real src to the component after a delay
	$effect(() => {
		void run;
		const delay = delayMs;
		src = '';
		const t = setTimeout(() => (src = photo), delay);
		return () => clearTimeout(t);
	});

	function copyInstall() {
		navigator.clipboard.writeText(INSTALL);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	const payloadKb = (JSON.stringify(placeholder).length / 1024).toFixed(1);
</script>

<svelte:head>
	<title>svelte-geometrize — triangles first, then the photo</title>
	<meta
		name="description"
		content="Geometric image placeholders for Svelte 5. Triangles resolve into the real photo while it loads — build-time shape fitting, tiny runtime."
	/>
</svelte:head>

<div class="page">
	<header>
		<span class="wordmark"><span class="tri" aria-hidden="true">▲</span>svelte-geometrize</span>
		<nav>
			<a href="https://www.npmjs.com/package/@nomideusz/svelte-geometrize">npm</a>
			<a href="https://github.com/nomideusz/svelte-geometrize">github</a>
		</nav>
	</header>

	<section class="hero">
		<p class="eyebrow">image placeholders for svelte 5</p>
		<h1>Triangles first.<br /><em>Then the photo.</em></h1>
		<p class="lede">
			No blur. The placeholder is the image, approximated by geometric shapes fitted at build
			time — and because they're stored in fit order, replaying them makes the picture visibly
			sharpen until the real photo crossfades in.
		</p>
		<button class="install" onclick={copyInstall}>
			<span class="prompt" aria-hidden="true">$</span>
			{INSTALL}
			<span class="copy">{copied ? 'copied ✓' : 'copy'}</span>
		</button>
	</section>

	<section class="demo">
		<div class="frame">
			{#key run}
				<GeometrizedImage {placeholder} {src} alt="Sunset over mountains" {stagger} />
			{/key}
		</div>

		<div class="controls">
			<button class="replay" onclick={() => run++}>↻ replay</button>
			<label>
				photo arrives in
				<select bind:value={delayMs}>
					<option value={1000}>1s</option>
					<option value={2500}>2.5s</option>
					<option value={5000}>5s</option>
				</select>
			</label>
			<label>
				stagger <input type="range" min="2" max="60" bind:value={stagger} />
				<span class="val">{stagger}ms</span>
			</label>
		</div>

		<dl class="stats">
			<div><dt>shapes</dt><dd>{placeholder.s.length}</dd></div>
			<div><dt>payload</dt><dd>{payloadKb} KB</dd></div>
			<div><dt>fit canvas</dt><dd>{placeholder.fw}×{placeholder.fh}</dd></div>
			<div><dt>source</dt><dd>{placeholder.w}×{placeholder.h}</dd></div>
		</dl>
	</section>

	<section class="variants">
		<h2>Not just triangles</h2>
		<p class="section-lede">
			Eight shape primitives, configurable per image straight from the import query. Click a card
			to replay.
		</p>
		<div class="grid">
			<VariantCard
				placeholder={lakePlaceholder}
				photo={lakePhoto}
				title="Ellipses"
				query="shapes=70&shapeTypes=ellipse&geometrize"
			/>
			<VariantCard
				placeholder={dunesPlaceholder}
				photo={dunesPhoto}
				title="Rotated rectangles"
				query="shapes=70&shapeTypes=rotated-rectangle&geometrize"
			/>
			<VariantCard
				placeholder={auroraPlaceholder}
				photo={auroraPhoto}
				title="Rotated ellipses"
				query="shapes=80&shapeTypes=rotated-ellipse&geometrize"
			/>
		</div>
	</section>

	<section class="how">
		<h2>How it works</h2>
		<ol>
			<li>
				<span class="num">01</span>
				<h3>Fit at build time</h3>
				<p>
					A Vite plugin runs geometrize's hill-climbing fitter on each <code
						>?geometrize</code
					> import — the expensive part never ships to the browser.
				</p>
			</li>
			<li>
				<span class="num">02</span>
				<h3>Ship ordered shapes</h3>
				<p>
					The placeholder is a few KB of SVG shapes in fit order: shape one is the dominant
					region, shape one hundred is fine detail.
				</p>
			</li>
			<li>
				<span class="num">03</span>
				<h3>Reveal &amp; crossfade</h3>
				<p>
					Pure CSS staggers each shape in — it runs before hydration and respects reduced
					motion — then the real image fades over the top.
				</p>
			</li>
		</ol>
	</section>

	<section class="usage">
		<h2>Usage</h2>
		<pre><code>{USAGE}</code></pre>
	</section>

	<footer>
		<span>MIT</span>
		<span class="dot" aria-hidden="true">▲</span>
		<a href="https://github.com/nomideusz/svelte-geometrize">nomideusz/svelte-geometrize</a>
		<span class="dot" aria-hidden="true">▲</span>
		<span>built on <a href="https://github.com/Tw1ddle/geometrize-haxe">geometrize</a></span>
	</footer>
</div>

<style>
	.page {
		max-width: 880px;
		margin: 0 auto;
		padding: 0 1.25rem 4rem;
		background-image: radial-gradient(
			ellipse 60% 38% at 50% 22rem,
			rgba(255, 107, 157, 0.09),
			transparent
		);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 0;
	}

	.wordmark {
		font-family: var(--geo-mono);
		font-size: 0.85rem;
		letter-spacing: 0.04em;
	}

	.tri {
		color: var(--geo-accent);
		margin-right: 0.5rem;
	}

	nav {
		display: flex;
		gap: 1.5rem;
	}

	nav a,
	footer a {
		font-family: var(--geo-mono);
		font-size: 0.8rem;
		color: var(--geo-muted);
		text-decoration: none;
		border-bottom: 1px solid transparent;
	}

	nav a:hover,
	footer a:hover {
		color: var(--geo-accent);
		border-bottom-color: var(--geo-accent);
	}

	/* ---- hero ---- */

	.hero {
		padding: 4rem 0 3rem;
		text-align: center;
	}

	.eyebrow {
		font-family: var(--geo-mono);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.25em;
		color: var(--geo-accent-2);
		margin: 0 0 1.25rem;
	}

	h1 {
		font-size: clamp(2.4rem, 7vw, 4.2rem);
		font-weight: 800;
		font-stretch: 125%;
		line-height: 1.02;
		text-transform: uppercase;
		letter-spacing: -0.01em;
		margin: 0 0 1.5rem;
	}

	h1 em {
		font-style: normal;
		background: linear-gradient(100deg, var(--geo-accent-2), var(--geo-accent));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.lede {
		max-width: 34rem;
		margin: 0 auto 2.25rem;
		color: var(--geo-muted);
		font-size: 1.05rem;
	}

	.install {
		font-family: var(--geo-mono);
		font-size: 0.85rem;
		color: var(--geo-text);
		background: var(--geo-surface);
		border: 1px solid var(--geo-line);
		padding: 0.8rem 1.1rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		clip-path: polygon(
			0 0,
			calc(100% - 12px) 0,
			100% 12px,
			100% 100%,
			12px 100%,
			0 calc(100% - 12px)
		);
		transition: border-color 150ms ease-out;
	}

	.install:hover {
		border-color: var(--geo-accent);
	}

	.prompt {
		color: var(--geo-accent);
	}

	.copy {
		color: var(--geo-muted);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding-left: 0.75rem;
		border-left: 1px solid var(--geo-line);
	}

	/* ---- demo ---- */

	.frame {
		border: 1px solid var(--geo-line);
		padding: 0.5rem;
		background: var(--geo-surface);
		clip-path: polygon(
			0 0,
			calc(100% - 22px) 0,
			100% 22px,
			100% 100%,
			22px 100%,
			0 calc(100% - 22px)
		);
	}

	.controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2rem;
		flex-wrap: wrap;
		margin: 1.25rem 0;
		font-family: var(--geo-mono);
		font-size: 0.78rem;
		color: var(--geo-muted);
	}

	.controls label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.replay {
		font-family: var(--geo-mono);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--geo-bg);
		background: var(--geo-accent);
		border: none;
		padding: 0.6rem 1.2rem;
		cursor: pointer;
		clip-path: polygon(
			0 0,
			calc(100% - 10px) 0,
			100% 10px,
			100% 100%,
			10px 100%,
			0 calc(100% - 10px)
		);
		transition: background 150ms ease-out;
	}

	.replay:hover {
		background: var(--geo-accent-2);
	}

	select {
		font-family: var(--geo-mono);
		font-size: 0.78rem;
		background: var(--geo-surface);
		color: var(--geo-text);
		border: 1px solid var(--geo-line);
		padding: 0.3rem 0.5rem;
	}

	input[type='range'] {
		accent-color: var(--geo-accent);
		width: 110px;
	}

	.val {
		min-width: 3.2ch;
		color: var(--geo-text);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		background: var(--geo-line);
		border: 1px solid var(--geo-line);
		margin: 0;
	}

	.stats div {
		background: var(--geo-bg);
		padding: 0.8rem 1rem;
		text-align: center;
	}

	dt {
		font-family: var(--geo-mono);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: var(--geo-muted);
	}

	dd {
		margin: 0.25rem 0 0;
		font-size: 1.15rem;
		font-weight: 700;
		font-stretch: 110%;
	}

	/* ---- sections ---- */

	section {
		margin-top: 4.5rem;
	}

	h2 {
		font-size: 1.6rem;
		font-weight: 800;
		font-stretch: 120%;
		text-transform: uppercase;
		margin: 0 0 0.5rem;
	}

	h2::before {
		content: '▲ ';
		color: var(--geo-accent);
		font-size: 0.7em;
		vertical-align: 0.15em;
	}

	.section-lede {
		color: var(--geo-muted);
		margin: 0 0 1.75rem;
		max-width: 36rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.25rem;
	}

	/* ---- how it works ---- */

	.how ol {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.25rem;
		padding: 0;
		margin: 1.75rem 0 0;
	}

	.how li {
		border: 1px solid var(--geo-line);
		background: var(--geo-surface);
		padding: 1.4rem 1.3rem;
		clip-path: polygon(
			0 0,
			calc(100% - 14px) 0,
			100% 14px,
			100% 100%,
			14px 100%,
			0 calc(100% - 14px)
		);
	}

	.num {
		font-family: var(--geo-mono);
		font-size: 0.75rem;
		color: var(--geo-accent);
	}

	.how h3 {
		font-size: 1rem;
		font-weight: 700;
		font-stretch: 115%;
		margin: 0.5rem 0;
	}

	.how p {
		font-size: 0.875rem;
		color: var(--geo-muted);
		margin: 0;
	}

	code {
		font-family: var(--geo-mono);
		font-size: 0.85em;
		color: var(--geo-accent-2);
	}

	/* ---- usage ---- */

	pre {
		font-family: var(--geo-mono);
		font-size: 0.82rem;
		line-height: 1.7;
		color: var(--geo-text);
		background: var(--geo-surface);
		border: 1px solid var(--geo-line);
		padding: 1.25rem 1.5rem;
		overflow-x: auto;
		margin: 1.25rem 0 0;
		clip-path: polygon(
			0 0,
			calc(100% - 16px) 0,
			100% 16px,
			100% 100%,
			16px 100%,
			0 calc(100% - 16px)
		);
	}

	pre code {
		color: inherit;
		font-size: inherit;
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-top: 5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--geo-line);
		font-family: var(--geo-mono);
		font-size: 0.75rem;
		color: var(--geo-muted);
	}

	.dot {
		color: var(--geo-accent);
		font-size: 0.5rem;
	}

	@media (max-width: 720px) {
		.grid,
		.how ol {
			grid-template-columns: 1fr;
		}

		.stats {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
