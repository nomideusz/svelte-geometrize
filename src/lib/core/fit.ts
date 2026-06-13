import { ImageRunner, Bitmap, ShapeTypes, SvgExporter } from 'geometrizejs';
import type { GeometrizeOptions, GeometrizePlaceholder, ShapeKind } from './types.js';

const SHAPE_TYPE_MAP: Record<ShapeKind, number> = {
	rectangle: ShapeTypes.RECTANGLE,
	'rotated-rectangle': ShapeTypes.ROTATED_RECTANGLE,
	triangle: ShapeTypes.TRIANGLE,
	ellipse: ShapeTypes.ELLIPSE,
	'rotated-ellipse': ShapeTypes.ROTATED_ELLIPSE,
	circle: ShapeTypes.CIRCLE,
	line: ShapeTypes.LINE,
	'quadratic-bezier': ShapeTypes.QUADRATIC_BEZIER
};

export const DEFAULT_OPTIONS: Required<Omit<GeometrizeOptions, 'maxSize'>> & { maxSize: number } = {
	shapes: 100,
	shapeTypes: ['triangle'],
	alpha: 128,
	candidateShapesPerStep: 50,
	shapeMutationsPerStep: 100,
	maxSize: 128
};

function resolveShapeTypes(kinds: ShapeKind[]): number[] {
	return kinds.map((kind) => {
		const type = SHAPE_TYPE_MAP[kind];
		if (type === undefined) {
			throw new Error(
				`Unknown shape type "${kind}". Valid: ${Object.keys(SHAPE_TYPE_MAP).join(', ')}`
			);
		}
		return type;
	});
}

/**
 * Fits geometric shapes to raw RGBA pixel data. Pure CPU work — no I/O, no DOM.
 *
 * @param rgba RGBA pixel data, length must be width * height * 4
 * @param width pixel width of the data
 * @param height pixel height of the data
 * @param sourceWidth intrinsic width of the original (pre-downscale) image
 * @param sourceHeight intrinsic height of the original image
 */
export function fitShapes(
	rgba: Uint8Array | Uint8ClampedArray,
	width: number,
	height: number,
	sourceWidth = width,
	sourceHeight = height,
	options: GeometrizeOptions = {}
): GeometrizePlaceholder {
	if (rgba.length !== width * height * 4) {
		throw new Error(
			`Pixel data length ${rgba.length} does not match ${width}x${height} RGBA (${width * height * 4})`
		);
	}
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const bitmap = Bitmap.createFromByteArray(width, height, Array.from(rgba));
	const runner = new ImageRunner(bitmap);
	const runnerOptions = {
		shapeTypes: resolveShapeTypes(opts.shapeTypes),
		alpha: opts.alpha,
		candidateShapesPerStep: opts.candidateShapesPerStep,
		shapeMutationsPerStep: opts.shapeMutationsPerStep
	};

	const fragments: string[] = [];
	while (fragments.length < opts.shapes) {
		const results = runner.step(runnerOptions);
		if (!results.length) break;
		for (const result of results) {
			fragments.push(compactFragment(SvgExporter.exportShape(result)));
		}
	}

	return {
		v: 1,
		w: sourceWidth,
		h: sourceHeight,
		fw: width,
		fh: height,
		bg: averageColor(rgba),
		s: fragments
	};
}

/** Shortens verbose float attributes, e.g. fill-opacity="0.5019607843137255" -> "0.5". */
function compactFragment(fragment: string): string {
	return fragment.replace(/(\d+\.\d{3})\d+/g, '$1').replace(/(\.\d*?)0+(?=")/g, '$1');
}

function averageColor(rgba: Uint8Array | Uint8ClampedArray): string {
	let r = 0;
	let g = 0;
	let b = 0;
	const pixels = rgba.length / 4;
	for (let i = 0; i < rgba.length; i += 4) {
		r += rgba[i];
		g += rgba[i + 1];
		b += rgba[i + 2];
	}
	return `rgb(${Math.round(r / pixels)},${Math.round(g / pixels)},${Math.round(b / pixels)})`;
}
