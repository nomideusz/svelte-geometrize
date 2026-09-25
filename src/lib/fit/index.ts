/**
 * Browser- and worker-safe fitter — no sharp / Node I/O.
 * Pass pre-decoded RGBA (e.g. from canvas `getImageData` or a worker).
 */
export { fitShapes, DEFAULT_OPTIONS, optionsCacheKey } from '../core/fit.js';
export { PRESETS } from '../core/presets.js';
export { placeholderToSvg, placeholderToDataUri, shapeCount, takeShapes, shapeFragments, shapeGroupOpen, compactPlaceholder } from '../core/svg.js';
export type { GeometrizeOptions, GeometrizePlaceholder, GeometrizePlaceholderV1, GeometrizePlaceholderV2, GeometrizePreset, ShapeKind } from '../core/types.js';
