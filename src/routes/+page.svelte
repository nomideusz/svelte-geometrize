<script lang="ts">
	import { GeometrizedImage } from '$lib/index.js';
	import placeholder from './demo-photo.jpg?geometrize';
	import photo from './demo-photo.jpg';

	let run = $state(0);
	let delayMs = $state(2500);
	let stagger = $state(15);
	let src = $state('');

	// simulate a slow network: hand the real src to the component after a delay
	$effect(() => {
		void run;
		const delay = delayMs;
		src = '';
		const t = setTimeout(() => (src = photo), delay);
		return () => clearTimeout(t);
	});

	const payloadBytes = JSON.stringify(placeholder).length;
</script>

<main>
	<h1>svelte-geometrize</h1>
	<p>
		{placeholder.s.length} triangles, {(payloadBytes / 1024).toFixed(1)} KB placeholder for a
		{placeholder.w}×{placeholder.h} photo. Shapes resolve in fit order, then the real image fades
		in.
	</p>

	<div class="controls">
		<button onclick={() => run++}>Replay</button>
		<label>
			image arrives after
			<select bind:value={delayMs}>
				<option value={1000}>1s</option>
				<option value={2500}>2.5s</option>
				<option value={5000}>5s</option>
			</select>
		</label>
		<label>
			stagger
			<input type="range" min="2" max="60" bind:value={stagger} />
			{stagger}ms/shape
		</label>
	</div>

	{#key run}
		<GeometrizedImage {placeholder} {src} alt="Sunset over mountains" {stagger} class="demo-img" />
	{/key}
</main>

<style>
	main {
		max-width: 760px;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	main :global(.demo-img) {
		border-radius: 8px;
	}
</style>
