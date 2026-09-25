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

/** A named look — see `PRESETS`. */
export type GeometrizePreset = 'triangles' | 'low-poly' | 'soft' | 'mosaic' | 'bubbles';

export interface GeometrizeOptions {
	/**
	 * A named look: its `shapeTypes` and `alpha`. Set either yourself and yours
	 * wins. Default: none (triangles at 128).
	 */
	preset?: GeometrizePreset;
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
	/**
	 * PRNG seed for reproducible fits. Default `1`.
	 * Pass `false` for non-deterministic (Math.random) output.
	 */
	seed?: number | false;
	/**
	 * Stop early once the approximation score is at or below this value
	 * (lower = closer to the source). Useful instead of (or with) a high `shapes` cap.
	 */
	targetScore?: number;
}

interface PlaceholderBase {
	/** Intrinsic width of the source image (for aspect ratio / layout). */
	w: number;
	/** Intrinsic height of the source image. */
	h: number;
	/** Width of the fitted (downscaled) canvas — the SVG viewBox space. */
	fw: number;
	/** Height of the fitted canvas. */
	fh: number;
	/** Average image color, e.g. '#785a3c' — painted before any shape. */
	bg: string;
}

/** Format 1 (svelte-geometrize ≤ 0.6): one SVG fragment string per shape. */
export interface GeometrizePlaceholderV1 extends PlaceholderBase {
	v: 1;
	/** SVG shape fragments in fit order: each one refines the approximation. */
	s: string[];
}

/**
 * Format 2 (svelte-geometrize ≥ 0.7): numbers, not markup — about a third
 * of the bytes. `s` holds the shapes in fit order, `;`-separated; each is a
 * kind letter, its integer parameters and a 6-hex colour, comma-joined:
 *
 *   p x1,y1,x2,y2,...   polygon (triangles, rotated rectangles)
 *   r x,y,w,h           rectangle          R x,y,w,h,angle  rotated rectangle
 *   e cx,cy,rx,ry       ellipse            E cx,cy,rx,ry,angle  rotated ellipse
 *   c cx,cy,r           circle
 *   l x1,y1,x2,y2       line (stroked)     q x1,y1,cx,cy,x2,y2  quadratic bézier (stroked)
 *
 * e.g. `p25,0,24,49,0,37,f29157;e12,30,5,8,aabbcc`. The alpha is shared.
 */
export interface GeometrizePlaceholderV2 extends PlaceholderBase {
	v: 2;
	/** Opacity of every shape, 0–1. */
	a: number;
	/** Encoded shapes in fit order, `;`-separated. */
	s: string;
}

export type GeometrizePlaceholder = GeometrizePlaceholderV1 | GeometrizePlaceholderV2;
