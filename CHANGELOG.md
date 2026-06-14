# Changelog

## Unreleased

- Smoother placeholder → photo transition: the shape reveal now decelerates (coarse shapes land fast, fine detail trickles in) instead of stopping abruptly, and during the handoff the placeholder eases back and softens while the real image fades in on top — so the photo resolves *into focus* instead of two sharp-but-different pictures swapping. The placeholder stays crisp the whole time it's the loading state; the blur applies only during the sub-second crossfade and is tunable via the new `revealBlur` prop (px, default 8; `0` restores a hard-edged crossfade). The bitmap is decoded before the crossfade starts so the first frame is paint-ready. `fadeDuration` default raised 350 → 600ms; `prefers-reduced-motion` still gets an instant swap.
- Fix: a **cached or already-decoded** image now crossfades instead of cutting in. Previously, if the photo was already complete when `src` was assigned (cache, or `src` swapped on an existing component), `loaded` flipped before the browser painted the `opacity: 0` state, so the transition had nothing to animate from and the image popped. The reveal is now deferred a frame so the crossfade always runs.

## 0.1.1

- Fix: no more browser broken-image icon / alt text flash — the `<img>` is not rendered while `src` is empty, the loaded state resets whenever `src` changes, and on load error the placeholder persists instead of the broken-image icon.

## 0.1.0

- Initial release: build-time geometrize shape fitting (`generatePlaceholder`, `fitShapes`), Vite plugin with `?geometrize` imports, `<GeometrizedImage>` runtime component with staggered shape reveal and crossfade, `placeholderToSvg` / `placeholderToDataUri` helpers.
