export type { GeometrizePlaceholder, GeometrizePlaceholderV1, GeometrizePlaceholderV2, GeometrizeOptions, ShapeKind } from './core/types.js';
export { placeholderToSvg, placeholderToDataUri, shapeCount, takeShapes, shapeFragments, shapeGroupOpen, compactPlaceholder } from './core/svg.js';
export {
	default as GeometrizedImage,
	type GeometrizeSource,
	type GeometrizeReveal,
	type GeometrizeObjectFit
} from './components/GeometrizedImage.svelte';
