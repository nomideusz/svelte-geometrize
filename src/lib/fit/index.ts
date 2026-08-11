/**
 * Browser- and worker-safe fitter — no sharp / Node I/O.
 * Pass pre-decoded RGBA (e.g. from canvas `getImageData` or a worker).
 */
export { fitShapes, DEFAULT_OPTIONS, optionsCacheKey } from '../core/fit.js';
export { placeholderToSvg, placeholderToDataUri } from '../core/svg.js';
export type { GeometrizeOptions, GeometrizePlaceholder, ShapeKind } from '../core/types.js';
