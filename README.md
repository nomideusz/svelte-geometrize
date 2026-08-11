# @nomideusz/svelte-geometrize

[![npm](https://badgen.net/npm/v/@nomideusz/svelte-geometrize)](https://www.npmjs.com/package/@nomideusz/svelte-geometrize) [![license](https://badgen.net/badge/license/MIT/blue)](https://github.com/nomideusz/svelte-geometrize/blob/main/LICENSE)

Geometric image placeholders for Svelte 5 — instead of a blur, triangles resolve into the photo while it loads, [geometrize.co.uk](https://www.geometrize.co.uk/)-style.

**[Live demo → svelte-geometrize.vercel.app](https://svelte-geometrize.vercel.app/)** · In production on [szkolyjogi.pl](https://szkolyjogi.pl), where 700+ listing heroes paint an instant geometric preview of the photo while it loads (open any school page, e.g. [this one](https://szkolyjogi.pl/krakow/szkola-jogi-na-debnikach-w-krakowie) — hard-refresh to replay), and on [kurcz.pl](https://kurcz.pl).

The expensive shape fitting (hill-climbing, via [geometrizejs](https://www.npmjs.com/package/geometrizejs)) runs **at build time** and emits a small ordered shape list (~1–10 KB raw, far less gzipped). Because geometrize is iterative — shape 1 is the dominant region, shape 100 is fine detail — replaying the shapes in fit order makes the placeholder visibly *sharpen* until the real image crossfades in. The runtime component is tiny and dependency-free (`sharp` is an optional peer for the Node / Vite / CLI half only).

## Usage

```bash
pnpm add @nomideusz/svelte-geometrize
# only needed for the Vite plugin, Node API, or CLI:
pnpm add -D sharp
```

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

<GeometrizedImage {placeholder} {src} alt="Sunset over mountains" revealMs={850} loading="lazy" />
```

For typed `?geometrize` imports, either copy the declarations into `app.d.ts` or reference the shipped ambient types:

```ts
/// <reference types="@nomideusz/svelte-geometrize/client" />
```

## Options

Plugin-wide defaults via `geometrize({ ... })`, per-image overrides via query params:

```
./photo.jpg?shapes=150&alpha=160&maxSize=160&shapeTypes=triangle,ellipse&seed=1&geometrize
```

Param order doesn't matter to the plugin, but keeping `geometrize` last lets the `*&geometrize` module declaration type these imports.

| Option | Default | Meaning |
| --- | --- | --- |
| `shapes` | `100` | Max shapes to fit — more detail, bigger payload |
| `shapeTypes` | `['triangle']` | Any of `rectangle`, `rotated-rectangle`, `triangle`, `ellipse`, `rotated-ellipse`, `circle`, `line`, `quadratic-bezier` |
| `alpha` | `128` | Shape opacity, 0–255 |
| `maxSize` | `128` | Longest edge the image is downscaled to before fitting (the SVG scales back up losslessly) |
| `candidateShapesPerStep` | `50` | Fit quality vs. build speed |
| `shapeMutationsPerStep` | `100` | Fit quality vs. build speed |
| `seed` | `1` | PRNG seed for reproducible fits (`false` = non-deterministic) |
| `targetScore` | — | Stop early once approximation score ≤ this (lower = closer) |
| `cacheDir` | `node_modules/.cache/svelte-geometrize` | Persistent disk cache (plugin only); `false` disables |

Fits are cached on disk by **file content hash + resolved options**, so clean rebuilds skip already-fitted images. Concurrent loads of the same key coalesce.

Component props beyond `placeholder` / `src` / `alt`: `reveal` (`'fade' | 'pop' | 'scatter'`, default `'fade'`), `revealMs` (total ms until the last shape starts — preferred over raw `stagger`), `stagger` (ms between shapes, default 15), `shapeDuration` (per-shape fade, default 400), `fadeDuration` (crossfade to the real image, default 600), `objectFit` (`cover` \| `contain` \| `fill` \| …, default `cover`), `objectPosition` (default `center`). `onload` / `onerror` are forwarded (chained after the internal reveal). All other props go to the `<img>`. Width/height default from the placeholder. The reveal is pure CSS, plays with SSR before hydration, and respects `prefers-reduced-motion`.

## Node API

```ts
import {
	generatePlaceholder,
	generatePlaceholderFromUrl,
	placeholderToSvg,
	placeholderToDataUri
} from '@nomideusz/svelte-geometrize/node';

const placeholder = await generatePlaceholder('photo.jpg', { shapes: 80, seed: 1 });
const fromCms = await generatePlaceholderFromUrl('https://cdn.example/hero.jpg');
const svg = placeholderToSvg(placeholder);
```

Requires the optional peer `sharp`.

### Browser / worker fitter

```ts
import { fitShapes } from '@nomideusz/svelte-geometrize/fit';

// rgba from canvas getImageData / a worker — no sharp
const placeholder = fitShapes(rgba, width, height, sourceW, sourceH, { shapes: 60 });
```

`placeholderToSvg` / `placeholderToDataUri` are also exported from the root entry (no geometrize/sharp) for CSS backgrounds or og-images.

## CLI

```bash
npx svelte-geometrize photo.jpg -o photo.json
npx svelte-geometrize ./photos --out ./placeholders --shapes 80 --target-score 0.12
```

## Dynamic images (runtime srcs, DB-stored placeholders)

The Vite plugin covers images known at build time. For photos that live behind an API — CMS content, user uploads, scraped listings — generate the placeholder once at ingest (or in a backfill script) with the Node API / CLI, store the JSON next to the record, and pass it straight to the component. This is how [szkolyjogi.pl](https://szkolyjogi.pl) does its listing heroes:

```ts
import { generatePlaceholder } from '@nomideusz/svelte-geometrize/node';

const bytes = Buffer.from(await (await fetch(photoUrl)).arrayBuffer());
const placeholder = await generatePlaceholder(bytes);
await db.update(listings)
	.set({ photoPlaceholder: JSON.stringify(placeholder) })
	.where(eq(listings.id, id));
```

```svelte
<GeometrizedImage
	placeholder={listing.photoPlaceholder}
	src="/api/photo/{listing.id}"
	alt={listing.name}
	revealMs={900}
/>
```

A placeholder is ~2–10 KB raw (a few KB gzipped), so inlining it in server-rendered HTML is cheap — the geometric preview paints before the photo's first byte arrives, no layout shift, and `sharp` stays a server-side ingest dependency, never shipped to the client.

## Demo

```bash
pnpm install
pnpm dev
```
