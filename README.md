# @nomideusz/svelte-geometrize

Geometric image placeholders for Svelte 5 — instead of a blur, triangles resolve into the photo while it loads, [geometrize.co.uk](https://www.geometrize.co.uk/)-style.

**[Live demo → svelte-geometrize.vercel.app](https://svelte-geometrize.vercel.app/)** · In production on [szkolyjogi.pl](https://szkolyjogi.pl), where 700+ listing heroes paint an instant geometric preview of the photo while it loads (open any school page, e.g. [this one](https://szkolyjogi.pl/krakow/szkola-jogi-na-debnikach-w-krakowie) — hard-refresh to replay), and on [kurcz.pl](https://kurcz.pl).

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

Component props beyond `placeholder` / `src` / `alt`: `reveal` (`'fade' | 'pop' | 'scatter'`, default `'fade'` — shapes fade in, scale in, or fly in from a per-shape direction), `stagger` (ms between shapes, default 15), `shapeDuration` (per-shape fade, default 400), `fadeDuration` (crossfade to the real image, default 600). All other props are forwarded to the `<img>`. The reveal is pure CSS animation, so it plays with SSR before hydration and respects `prefers-reduced-motion`.

Shapes are revealed coarse-first and decelerate into the fine detail, and the photo hands off with a plain dissolve on top — the placeholder never moves, blurs, or scales. Because the shapes are fitted to that exact photo, the fade reads as the final refinement step (fine detail arriving over the same structure), not as two different images swapping. The reveal runs on its own clock, so to keep it flowing right up to when the photo arrives, pace it to your expected load time with `stagger` / `shapeDuration` (a longer reveal leaves less of a gap before the handoff on slow connections).

## Node API

```ts
import { generatePlaceholder, placeholderToSvg, placeholderToDataUri } from '@nomideusz/svelte-geometrize/node';

const placeholder = await generatePlaceholder('photo.jpg', { shapes: 80 });
const svg = placeholderToSvg(placeholder); // standalone SVG string
```

`placeholderToSvg` / `placeholderToDataUri` are also exported from the root entry (browser-safe, no geometrize/sharp dependency) for CSS backgrounds or og-images.

## Dynamic images (runtime srcs, DB-stored placeholders)

The Vite plugin covers images known at build time. For photos that live behind an API — CMS content, user uploads, scraped listings — generate the placeholder once at ingest (or in a backfill script) with the Node API, store the JSON next to the record, and pass it straight to the component. This is how [szkolyjogi.pl](https://szkolyjogi.pl) does its listing heroes:

```ts
// ingest/backfill script — one placeholder per photo, stored as JSON
import { generatePlaceholder } from '@nomideusz/svelte-geometrize/node';

const bytes = Buffer.from(await (await fetch(photoUrl)).arrayBuffer());
const placeholder = await generatePlaceholder(bytes);
await db.update(listings)
	.set({ photoPlaceholder: JSON.stringify(placeholder) })
	.where(eq(listings.id, id));
```

```svelte
<!-- listing page — placeholder comes from the DB with the rest of the row -->
<GeometrizedImage
	placeholder={listing.photoPlaceholder}
	src="/api/photo/{listing.id}"
	alt={listing.name}
/>
```

A placeholder is ~2–10 KB raw (a few KB gzipped), so inlining it in server-rendered HTML is cheap — the geometric preview paints before the photo's first byte arrives, no layout shift, and `sharp` stays a server-side ingest dependency, never shipped to the client.

## Demo

```bash
pnpm install
pnpm dev
```
