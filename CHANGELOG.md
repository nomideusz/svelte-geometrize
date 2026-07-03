# Changelog

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
