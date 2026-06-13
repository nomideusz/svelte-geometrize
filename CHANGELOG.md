# Changelog

## Unreleased

- Fix: no more browser broken-image icon / alt text flash — the `<img>` is not rendered while `src` is empty, the loaded state resets whenever `src` changes, and on load error the placeholder persists instead of the broken-image icon.

## 0.1.0

- Initial release: build-time geometrize shape fitting (`generatePlaceholder`, `fitShapes`), Vite plugin with `?geometrize` imports, `<GeometrizedImage>` runtime component with staggered shape reveal and crossfade, `placeholderToSvg` / `placeholderToDataUri` helpers.
