export type { GeometrizePlaceholder, GeometrizeOptions, ShapeKind } from './core/types.js';
export { placeholderToSvg, placeholderToDataUri } from './core/svg.js';
export {
	default as GeometrizedImage,
	type GeometrizeSource,
	type GeometrizeReveal,
	type GeometrizeObjectFit
} from './components/GeometrizedImage.svelte';
