# @nomideusz/svelte-geometrize

Geometric image placeholders for Svelte 5 — instead of a blur, triangles resolve into the photo while it loads, [geometrize.co.uk](https://www.geometrize.co.uk/)-style.

**[Live demo → svelte-geometrize.vercel.app](https://svelte-geometrize.vercel.app/)**

The expensive shape fitting (hill-climbing, via [geometrizejs](https://www.npmjs.com/package/geometrizejs)) runs **at build time** and emits a small ordered shape list (~1–10 KB raw, far less gzipped). Because geometrize is iterative — shape 1 is the dominant region, shape 100 is fine detail — replaying the shapes in fit order makes the placeholder visibly *sharpen* until the real image crossfades in. The runtime component is tiny and dependency-free.

## Usage

Register the Vite plugin (build-time half):

```ts
// vite.config.ts
import { geometrize } from '@nomideusz/svelte-geometrize/vite';

export default defineConfig({
	plugins: [geometrize(), sveltekit()]
});
```

Then in a component:

```svelte
<script lang="ts">
	import { GeometrizedImage } from '@nomideusz/svelte-geometrize';
	import placeholder from './photo.jpg?geometrize';
	import src from './photo.jpg';
</script>

<GeometrizedImage {placeholder} {src} alt="Sunset over mountains" loading="lazy" />
```

For typed `?geometrize` imports, add to your `app.d.ts`:

```ts
declare module '*?geometrize' {
	const placeholder: import('@nomideusz/svelte-geometrize').GeometrizePlaceholder;
	export default placeholder;
}

// when combining with query params, put `geometrize` last (see below)
declare module '*&geometrize' {
	const placeholder: import('@nomideusz/svelte-geometrize').GeometrizePlaceholder;
	export default placeholder;
}
```

## Options

Plugin-wide defaults via `geometrize({ ... })`, per-image overrides via query params:

```
./photo.jpg?shapes=150&alpha=160&maxSize=160&shapeTypes=triangle,ellipse&geometrize
```

Param order doesn't matter to the plugin, but keeping `geometrize` last lets the `*&geometrize` module declaration above type these imports.

| Option | Default | Meaning |
| --- | --- | --- |
| `shapes` | `100` | Shapes to fit — more detail, bigger payload |
| `shapeTypes` | `['triangle']` | Any of `rectangle`, `rotated-rectangle`, `triangle`, `ellipse`, `rotated-ellipse`, `circle`, `line`, `quadratic-bezier` |
| `alpha` | `128` | Shape opacity, 0–255 |
| `maxSize` | `128` | Longest edge the image is downscaled to before fitting (the SVG scales back up losslessly) |
| `candidateShapesPerStep` | `50` | Fit quality vs. build speed |
| `shapeMutationsPerStep` | `100` | Fit quality vs. build speed |

Component props beyond `placeholder` / `src` / `alt`: `stagger` (ms between shapes, default 15), `shapeDuration` (per-shape fade, default 400), `fadeDuration` (crossfade to the real image, default 350). All other props are forwarded to the `<img>`. The reveal is pure CSS animation, so it plays with SSR before hydration and respects `prefers-reduced-motion`.

## Node API

```ts
import { generatePlaceholder, placeholderToSvg, placeholderToDataUri } from '@nomideusz/svelte-geometrize/node';

const placeholder = await generatePlaceholder('photo.jpg', { shapes: 80 });
const svg = placeholderToSvg(placeholder); // standalone SVG string
```

`placeholderToSvg` / `placeholderToDataUri` are also exported from the root entry (browser-safe, no geometrize/sharp dependency) for CSS backgrounds or og-images.

## Demo

```bash
pnpm install
pnpm dev
```
