# @nomideusz/svelte-geometrize

[![npm](https://img.shields.io/npm/v/@nomideusz/svelte-geometrize)](https://www.npmjs.com/package/@nomideusz/svelte-geometrize) [![license](https://img.shields.io/npm/l/@nomideusz/svelte-geometrize)](https://github.com/nomideusz/svelte-geometrize/blob/main/LICENSE)

![A photo's shapes sharpening in fit order, then the photo crossfading in](https://raw.githubusercontent.com/nomideusz/svelte-geometrize/main/media/reveal.webp)

Geometric image placeholders for Svelte 5 — instead of a blur, triangles resolve into the photo while it loads, [geometrize.co.uk](https://www.geometrize.co.uk/)-style.

**[Live demo → svelte-geometrize.vercel.app](https://svelte-geometrize.vercel.app/)** · In production on [szkolyjogi.pl](https://szkolyjogi.pl), where 700+ listing heroes paint an instant geometric preview of the photo while it loads (open any school page, e.g. [this one](https://szkolyjogi.pl/krakow/szkola-jogi-na-debnikach-w-krakowie) — hard-refresh to replay), and on [kurcz.pl](https://kurcz.pl).

The expensive shape fitting (hill-climbing, via [geometrizejs](https://www.npmjs.com/package/geometrizejs)) runs **at build time** and emits a small ordered shape list (~1–3 KB raw, far less gzipped). Because geometrize is iterative — shape 1 is the dominant region, shape 100 is fine detail — replaying the shapes in fit order makes the placeholder visibly *sharpen* until the real image takes over, cut into the same shapes. The runtime component is tiny and dependency-free (`sharp` is an optional peer for the Node / Vite / CLI half only).

## Install

```bash
pnpm add @nomideusz/svelte-geometrize
# only needed for the Vite plugin, Node API, or CLI:
pnpm add -D sharp
```

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

A **preset** is a named look — its shape types and opacity — for when you'd rather pick one than tune two knobs:

```
./photo.jpg?preset=soft&geometrize
```

| Preset | Shapes | Alpha |
| --- | --- | --- |
| `triangles` | triangle | 128 — the default look |
| `low-poly` | triangle | 255 |
| `soft` | rotated-ellipse | 96 |
| `mosaic` | rectangle | 255 |
| `bubbles` | circle | 200 |

A preset named on the import beats the plugin-wide `shapeTypes` / `alpha`; set either on the import itself and yours wins. `PRESETS` is exported from every entry.

| Option | Default | Meaning |
| --- | --- | --- |
| `shapes` | `100` | Max shapes to fit — more detail, bigger payload |
| `shapeTypes` | `['triangle']` | Any of `rectangle`, `rotated-rectangle`, `triangle`, `ellipse`, `rotated-ellipse`, `circle`, `line`, `quadratic-bezier` |
| `alpha` | `128` | Shape opacity, 0–255 |
| `preset` | — | A named look: `triangles`, `low-poly`, `soft`, `mosaic`, `bubbles` (see above) |
| `maxSize` | `128` | Longest edge the image is downscaled to before fitting (the SVG scales back up losslessly) |
| `candidateShapesPerStep` | `50` | Fit quality vs. build speed |
| `shapeMutationsPerStep` | `100` | Fit quality vs. build speed |
| `seed` | `1` | PRNG seed for reproducible fits (`false` = non-deterministic) |
| `targetScore` | — | Stop early once approximation score ≤ this (lower = closer) |
| `cacheDir` | `node_modules/.cache/svelte-geometrize` | Persistent disk cache (plugin only); `false` disables |

Fits are cached on disk by **file content hash + resolved options**, so clean rebuilds skip already-fitted images. Concurrent loads of the same key coalesce.

Component props beyond `placeholder` / `src` / `alt`: `reveal` (`'fade' | 'pop' | 'scatter'`, default `'fade'`), `revealMs` (total ms until the last shape starts — preferred over raw `stagger`), `stagger` (ms between shapes, default 15), `shapeDuration` (per-shape fade, default 400), `fadeDuration` (the handoff, default 800: the photo opens through the shapes, biggest first, then fills the gaps between them — no crossfade, no blur), `objectFit` (`cover` \| `contain` \| `fill` \| …, default `cover`), `objectPosition` (default `center`; keywords, percentages or lengths, not `var()`) — the placeholder crops exactly like the photo, so a box that isn't the photo's shape hands off without a jump. `onload` / `onerror` are forwarded (chained after the internal reveal). All other props go to the `<img>`. Width/height default from the placeholder. The reveal is pure CSS, plays with SSR before hydration, and respects `prefers-reduced-motion`; a photo that is ready before it has played waits for the last shape to start, so a fast load still shows the picture sharpening.

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
npx svelte-geometrize hero.jpg --preset soft
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

A placeholder is numbers, not markup: 30 shapes ≈ 800 B raw, 100 ≈ 2.5 KB (a fraction of that gzipped), so inlining it in server-rendered HTML is cheap even for a gallery — the geometric preview paints before the photo's first byte arrives, no layout shift, and `sharp` stays a server-side ingest dependency, never shipped to the client.

### The placeholder format

```json
{ "v": 2, "w": 1600, "h": 1067, "fw": 128, "fh": 85, "bg": "#695346", "a": 0.502,
  "s": "p25,0,24,49,0,37,f29157;p0,12,15,49,0,41,ff9402;…" }
```

`s` lists the shapes in fit order, `;`-separated: a kind letter, integer parameters in the `fw × fh` space, and a 6-hex colour (`p` polygon, `r`/`R` rectangle / rotated, `e`/`E` ellipse / rotated, `c` circle, `l` line, `q` quadratic bézier). `a` is the shared opacity. Helpers for stored placeholders, all browser-safe:

- `shapeCount(p)` — how many shapes it holds.
- `takeShapes(p, n)` — the first `n` shapes: a coarser preview for less bytes, no re-fit (the fit is ordered, so the big regions come first). Store 100, send 30 on a list page and 100 on the detail page.
- `compactPlaceholder(p)` — re-encodes a pre-0.7 placeholder (one SVG string per shape, about 3× the bytes) in this format, for a one-off migration of what you already have stored. Everything still accepts the old format as-is.

## Demo

```bash
pnpm install
pnpm dev
```
