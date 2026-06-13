<script lang="ts">
	import '@fontsource-variable/archivo';
	import '@fontsource-variable/jetbrains-mono';

	let { children } = $props();
</script>

{@render children()}

<style>
	:global(:root) {
		--geo-bg: #0e0c12;
		--geo-surface: #16131e;
		--geo-line: rgba(244, 238, 233, 0.1);
		--geo-text: #f4eee9;
		--geo-muted: #9d92a6;
		--geo-accent: #ff6b9d;
		--geo-accent-2: #ff9a56;
		--geo-display: 'Archivo Variable', sans-serif;
		--geo-mono: 'JetBrains Mono Variable', monospace;
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		background: var(--geo-bg);
		color: var(--geo-text);
		font-family: var(--geo-display);
		line-height: 1.55;
		-webkit-font-smoothing: antialiased;
	}

	:global(::selection) {
		background: var(--geo-accent);
		color: var(--geo-bg);
	}
</style>
