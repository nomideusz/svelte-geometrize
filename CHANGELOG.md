# Changelog

## 0.8.0 — 2026-09-25

### Fixed
- **Early shapes are fitted to the canvas the SVG actually paints.** geometrize started every fit from black while the SVG starts from the average colour, so the first shapes were tuned to brighten a canvas nobody sees. Seeding the fit with the average colour puts the first 5–20 shapes 15–30% closer to the photo (four test images) — the frames a reveal shows first and a `takeShapes` prefix keeps. New fits differ from 0.7's; stored placeholders keep rendering as before, and the Vite cache re-fits once.
- **No more flat band along the right and bottom edges.** Shapes are fitted in pixel-centre space and never reach the last column and row, which stayed bare background — about 1/128 of the box, 9 px on a 1200 px hero. The shape group is now stretched to the full viewBox (every placeholder, old or new, v1 or v2).
- **The placeholder crops like the photo.** It took the box's centre whatever the photo did; now it follows `objectPosition` (keywords, percentages, lengths) and `objectFit` — including `none` and `scale-down`, which rendered as `cover` — so there is no jump or double image at the handoff when the box isn't the photo's shape.
- **Transparent images:** the placeholder is hidden once the photo has faded in, instead of showing through a transparent PNG forever, and a cutout's clear area is fitted as background rather than as black.
- **The CLI did nothing when run as `npx svelte-geometrize`** (a symlinked bin failed its "run directly?" check and exited 0 silently). Numeric flags now reject non-numbers instead of fitting with `NaN`.
- Without JavaScript the photo stayed at `opacity: 0`; `@media (scripting: none)` shows it.
- A placeholder rendered without `src` is announced as an image with its `alt`.
- Vite plugin: every importer of an image watches it for HMR, not just the first; `?seed=false` works.
- An unknown shape kind is skipped instead of throwing during render; `sources` with the same `srcset` no longer crash the keyed `{#each}`.
- **`generatePlaceholder` no longer holds the event loop for the whole fit.** It yields between geometrize steps, so a server fitting an upload keeps answering — the longest stall on a 60-shape fit drops from ~530 ms to one step. Output is identical to `fitShapes`, and fits running side by side (the Vite plugin's) stay reproducible.
- `seed: 0` was the same fit as `seed: 1`; it is its own seed now.

### Added
- **Presets** — `preset: 'triangles' | 'low-poly' | 'soft' | 'mosaic' | 'bubbles'`, a named look (shape types + opacity) on every fitter, `?preset=soft&geometrize` on the Vite plugin, `--preset` on the CLI. Explicit `shapeTypes` / `alpha` still win. `PRESETS` and the `GeometrizePreset` type are exported.
- The README opens with a clip of a reveal (`scripts/readme-clip.mjs` renders it); the demo shows real photos, a gallery that loads at its own pace, the presets side by side, and a slider that replays any prefix of the fit via `takeShapes`.

### Changed
- **Lighter inline SVG.** Each shape carries only its index (`style="--i:7"`); the stagger curve and the scatter direction are computed in CSS (`pow()`, `cos()`, `sin()`). The rendered SVG is ~24% smaller (100 shapes, fade), more with `scatter`. Custom CSS aimed at the old per-shape wrapper (`svg > g > g`) should target `svg > g > *`. A browser without CSS exponential/trig functions shows the shapes all at once instead of staggered.

## 0.7.0 — 2026-09-10

### Changed
- **Placeholder format v2 — numbers, not markup.** `fitShapes` / `generatePlaceholder` now emit `{ v: 2, a, s: "p25,0,24,49,0,37,f29157;…" }`: a kind letter, integer parameters and a colour per shape, one shared opacity. About a third of the bytes of 0.6's SVG-fragment list, and the rendered SVG drops the per-shape opacity too. Everything still reads v1 placeholders unchanged.
- `GeometrizePlaceholder` is now the union `GeometrizePlaceholderV1 | GeometrizePlaceholderV2`; code that reached into `placeholder.s` as an array should use the helpers below.

### Added
- `shapeCount(p)`, `takeShapes(p, n)` — count and trim shapes of either format at render time (the fit is ordered, so a prefix is a coarser preview: store 100, send 30 on a list page).
- `shapeFragments(p)` / `shapeGroupOpen(p)` — the SVG fragments and their opacity group, for custom renderers.
- `compactPlaceholder(p)` — re-encode a stored v1 placeholder as v2 without re-fitting; returns the input untouched when a fragment is not one the fitter produces.

## 0.6.0 — 2026-08-11

### Added
- **`revealMs`** on `GeometrizedImage` — pace the whole shape reveal across a fixed time budget (derives stagger from shape count). Preferred over hand-tuning `stagger`.
- **`objectFit` / `objectPosition`** — photo + SVG `preserveAspectRatio` stay in sync (`cover` default, `contain`, `fill`, …).
- **`seed`** fit option (default `1`) for reproducible placeholders; pass `false` for non-deterministic fits.
- **`targetScore`** — stop early once the approximation score is good enough.
- **`@nomideusz/svelte-geometrize/fit`** — browser/worker-safe `fitShapes` export (no `sharp`).
- **`generatePlaceholderFromUrl`** on the Node API.
- **CLI** `svelte-geometrize` for batch ingest (`npx svelte-geometrize ./photos --out ./placeholders`).
- **Persistent Vite disk cache** keyed by file content hash + resolved options (`cacheDir`, default `node_modules/.cache/svelte-geometrize`). Concurrent identical loads coalesce.
- Ambient types via `@nomideusz/svelte-geometrize/client`.

### Changed
- **`sharp` is an optional peer dependency** — runtime / DB-placeholder consumers no longer pull a native binary. Install `sharp` only for the Vite plugin, Node API, or CLI.
- Tighter SVG payloads: `#rrggbb` fills, shorter opacity / float compaction.
- `onload` / `onerror` are chained (no longer swallowed by the reveal handler).
- `<img width/height>` default from `placeholder.w/h`; `aria-busy` while loading.
- Removed always-on `will-change: opacity`.

### Fixed
- Plugin cache now invalidates when option defaults change (options are part of the key).

## 0.5.2 — 2026-08-02

### Changed
- `sideEffects: false` in package.json, so bundlers can tree-shake unused
  exports. Every module here is pure; without the declaration a consumer
  importing one helper had to ship the whole library.

## 0.5.1 — 2026-07-07

### Fixed
- Shipped `.svelte` files are now transpiled to plain JavaScript (`vitePreprocess({ script: true })` at package time), so toolchains without a TypeScript preprocessor — `svelte-loader`, bundlephobia, plain rollup — can compile the package. No change for Vite/SvelteKit consumers.

## 0.5.0 — 2026-07-06

### Added
- **`reveal` prop** on `GeometrizedImage`: `'fade'` (default, unchanged), `'pop'` (each shape scales in from 0.5), or `'scatter'` (each shape flies in from a deterministic per-shape direction — golden-angle by index, so SSR and client markup always match). All variants are pure CSS: they play before hydration and are disabled by `prefers-reduced-motion`. Exported `GeometrizeReveal` type.
- Demo: Fade / Pop / Scatter toggle in the playground.

### Docs
- README/demo: kurcz.pl joins szkolyjogi.pl as a production deployment.

## 0.4.1 — 2026-07-02

### Docs
- README: link the production deployment ([szkolyjogi.pl](https://szkolyjogi.pl), 700+ listing heroes) and add a "Dynamic images" section documenting the runtime pattern — generate placeholders at ingest with the Node API, store the JSON in the DB, pass it to the component. No code changes.

## 0.4.0 — 2026-07-02

### Changed
- The photo handoff is now a plain dissolve: the placeholder never moves, blurs, or scales, and the sharp photo simply fades in on top. Measured frame-by-frame, the old crossfade moved both layers at once — the incoming photo lost most of its blur while still ~40% transparent, while the placeholder blurred out underneath it, so mid-fade the viewer saw a half-sharp ghost photo over mush, then the photo popped opaque: the perceived "jump". Blur-based fixes (soft dissolve, then focus-pull) were tried and rejected — any blur reads as the crisp geometry suddenly going soft, and the blur collapse reads as a zoom. Since the shapes are fitted to the exact photo, the plain dissolve reads as the final refinement step: fine detail arriving over the same structure.
- **Removed the `revealBlur` prop** along with all blur in the handoff. If you passed it, drop it (it would now be forwarded to the `<img>` as an unknown attribute).
- Pending shapes no longer snap to fully visible when the photo arrives — they keep trickling in under the dissolve (barely visible there), so a fast/cached load stays in motion instead of popping to a finished placeholder first.
- Removed the internal `is-loaded` class from the wrapper; the loaded state lives on the `<img>` only.

## 0.3.1 — 2026-06-29

### Security
- Bump vulnerable devDependencies to clear npm High CVE alerts: `vite` ^7.3.1 → ^7.3.5, `vitest` ^4.0.18 → ^4.1.0, `@sveltejs/kit` ^2.50.2 → ^2.60.1. No runtime deps affected.

## 0.3.0 — 2026-06-26

### Changed
- More natural placeholder → photo handoff. The moment the photo is ready, any still-pending shapes snap to fully visible instead of trickling in *under* the crossfade — previously the long ease-in tail kept revealing detail during the swap, which read as "the reveal slows down, then the photo replaces it." The photo now also emerges from blur (resolving *into focus*) rather than fading in already sharp over a blurred placeholder.
- `revealBlur` default raised 8 → 12px for a stronger focus-pull during the handoff.

### Fixed
- Background color (`bg`) is now alpha-weighted, so fully transparent pixels no longer drag the average toward black. Transparent PNGs / logos / cutouts now get the correct opaque background instead of a dark one. (Changes generated placeholder output for images with transparency.)

## 0.2.1 — 2026-06-17

### Changed
- Add `homepage` field pointing to the live demo (now shown as Homepage on npm).

## 0.2.0

- Smoother placeholder → photo transition: the shape reveal now decelerates (coarse shapes land fast, fine detail trickles in) instead of stopping abruptly, and during the handoff the placeholder eases back and softens while the real image fades in on top — so the photo resolves *into focus* instead of two sharp-but-different pictures swapping. The placeholder stays crisp the whole time it's the loading state; the blur applies only during the sub-second crossfade and is tunable via the new `revealBlur` prop (px, default 8; `0` restores a hard-edged crossfade). The bitmap is decoded before the crossfade starts so the first frame is paint-ready. `fadeDuration` default raised 350 → 600ms; `prefers-reduced-motion` still gets an instant swap.
- Fix: a **cached or already-decoded** image now crossfades instead of cutting in. Previously, if the photo was already complete when `src` was assigned (cache, or `src` swapped on an existing component), `loaded` flipped before the browser painted the `opacity: 0` state, so the transition had nothing to animate from and the image popped. The reveal is now deferred a frame so the crossfade always runs.

## 0.1.1

- Fix: no more browser broken-image icon / alt text flash — the `<img>` is not rendered while `src` is empty, the loaded state resets whenever `src` changes, and on load error the placeholder persists instead of the broken-image icon.

## 0.1.0

- Initial release: build-time geometrize shape fitting (`generatePlaceholder`, `fitShapes`), Vite plugin with `?geometrize` imports, `<GeometrizedImage>` runtime component with staggered shape reveal and crossfade, `placeholderToSvg` / `placeholderToDataUri` helpers.
