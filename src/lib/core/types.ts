/**
 * Shape primitives supported by the fitter. Maps to geometrize's ShapeTypes enum.
 */
export type ShapeKind =
	| 'rectangle'
	| 'rotated-rectangle'
	| 'triangle'
	| 'ellipse'
	| 'rotated-ellipse'
	| 'circle'
	| 'line'
	| 'quadratic-bezier';

export interface GeometrizeOptions {
	/** Number of shapes to fit. More shapes = more detail, bigger payload. Default 100. */
	shapes?: number;
	/** Shape primitives to fit. Default ['triangle']. */
	shapeTypes?: ShapeKind[];
	/** Shape opacity 0–255. Default 128. */
	alpha?: number;
	/** Candidate shapes tried per step. Higher = better fit, slower build. Default 50. */
	candidateShapesPerStep?: number;
	/** Mutations tried per candidate. Higher = better fit, slower build. Default 100. */
	shapeMutationsPerStep?: number;
	/**
	 * Longest edge the image is downscaled to before fitting (node generator only).
	 * Fitting works in this coordinate space; the SVG scales back up losslessly. Default 128.
	 */
	maxSize?: number;
}

export interface GeometrizePlaceholder {
	/** Format version. */
	v: 1;
	/** Intrinsic width of the source image (for aspect ratio / layout). */
	w: number;
	/** Intrinsic height of the source image. */
	h: number;
	/** Width of the fitted (downscaled) canvas — the SVG viewBox space. */
	fw: number;
	/** Height of the fitted canvas. */
	fh: number;
	/** Average image color, e.g. 'rgb(120,90,60)' — painted before any shape. */
	bg: string;
	/** SVG shape fragments in fit order: each one refines the approximation. */
	s: string[];
}
