import { ImageRunner, Bitmap, ShapeTypes } from 'geometrizejs';
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

export const DEFAULT_OPTIONS: Required<
	Omit<GeometrizeOptions, 'maxSize' | 'seed' | 'targetScore'>
> & {
	maxSize: number;
	seed: number | false;
	targetScore: number | undefined;
} = {
	shapes: 100,
	shapeTypes: ['triangle'],
	alpha: 128,
	candidateShapesPerStep: 50,
	shapeMutationsPerStep: 100,
	maxSize: 128,
	seed: 1,
	targetScore: undefined
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

/** Mulberry32 — small, fast, good enough for reproducible hill-climbing. */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function withSeededRandom<T>(seed: number | false, fn: () => T): T {
	if (seed === false) return fn();
	const next = mulberry32(seed === 0 ? 1 : seed);
	const original = Math.random;
	Math.random = next;
	try {
		return fn();
	} finally {
		Math.random = original;
	}
}

/**
 * Fits geometric shapes to raw RGBA pixel data. Pure CPU work — no I/O, no DOM.
 * Safe to call from a Web Worker (no Node / sharp dependency).
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

	return withSeededRandom(opts.seed, () => {
		// geometrizejs accepts number[] | Buffer; copy once into a plain array
		const bytes = Array.from(rgba as ArrayLike<number>);
		const bitmap = Bitmap.createFromByteArray(width, height, bytes);
		const runner = new ImageRunner(bitmap);
		const runnerOptions = {
			shapeTypes: resolveShapeTypes(opts.shapeTypes),
			alpha: opts.alpha,
			candidateShapesPerStep: opts.candidateShapesPerStep,
			shapeMutationsPerStep: opts.shapeMutationsPerStep
		};

		const entries: string[] = [];
		const done = () => buildPlaceholder(rgba, width, height, sourceWidth, sourceHeight, entries, opts.alpha);
		while (entries.length < opts.shapes) {
			const results = runner.step(runnerOptions);
			if (!results.length) break;
			for (const result of results) {
				entries.push(encodeShape(result));
				if (opts.targetScore !== undefined && result.score <= opts.targetScore) return done();
			}
		}
		return done();
	});
}

function buildPlaceholder(
	rgba: Uint8Array | Uint8ClampedArray,
	width: number,
	height: number,
	sourceWidth: number,
	sourceHeight: number,
	entries: string[],
	alpha: number
): GeometrizePlaceholder {
	return {
		v: 2,
		w: sourceWidth,
		h: sourceHeight,
		fw: width,
		fh: height,
		bg: averageColor(rgba),
		a: Math.round((alpha / 255) * 1000) / 1000,
		s: entries.join(';')
	};
}

type StepResult = { color: number; shape: { getType(): number; getRawShapeData(): number[] } };

/**
 * One fitted shape → its v2 entry: kind letter, integer parameters, colour.
 * Rectangles come from geometrize as two corners; stored as x,y,w,h so the
 * decoder is a straight `<rect>`.
 */
function encodeShape(result: StepResult): string {
	const type = result.shape.getType();
	const d = result.shape.getRawShapeData().map(Math.round);
	const c = result.color;
	const hex = toHex((c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255).slice(1);
	const rect = () => {
		const [x1, y1, x2, y2] = d;
		return [Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)];
	};
	let kind: string;
	let values: number[];
	switch (type) {
		case ShapeTypes.RECTANGLE:
			kind = 'r';
			values = rect();
			break;
		case ShapeTypes.ROTATED_RECTANGLE:
			kind = 'R';
			values = [...rect(), d[4]];
			break;
		case ShapeTypes.TRIANGLE:
			kind = 'p';
			values = d;
			break;
		case ShapeTypes.ELLIPSE:
			kind = 'e';
			values = d;
			break;
		case ShapeTypes.ROTATED_ELLIPSE:
			kind = 'E';
			values = d;
			break;
		case ShapeTypes.CIRCLE:
			kind = 'c';
			values = d;
			break;
		case ShapeTypes.LINE:
			kind = 'l';
			values = d;
			break;
		case ShapeTypes.QUADRATIC_BEZIER:
			kind = 'q';
			values = d;
			break;
		default:
			throw new Error(`svelte-geometrize: unexpected shape type ${type}`);
	}
	return `${kind}${values.join(',')},${hex}`;
}

function toHex(r: number, g: number, b: number): string {
	return (
		'#' +
		((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
	);
}

/** Stable serialization of options for cache keys (sorted keys, defaults applied). */
export function optionsCacheKey(options: GeometrizeOptions = {}): string {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const normalized = {
		shapes: opts.shapes,
		shapeTypes: [...opts.shapeTypes].sort(),
		alpha: opts.alpha,
		candidateShapesPerStep: opts.candidateShapesPerStep,
		shapeMutationsPerStep: opts.shapeMutationsPerStep,
		maxSize: opts.maxSize,
		seed: opts.seed,
		targetScore: opts.targetScore ?? null
	};
	return JSON.stringify(normalized);
}

// Alpha-weighted so fully transparent pixels (RGB usually 0,0,0 after ensureAlpha)
// don't drag the background toward black on cutouts/logos.
function averageColor(rgba: Uint8Array | Uint8ClampedArray): string {
	let r = 0;
	let g = 0;
	let b = 0;
	let a = 0;
	for (let i = 0; i < rgba.length; i += 4) {
		const w = rgba[i + 3];
		r += rgba[i] * w;
		g += rgba[i + 1] * w;
		b += rgba[i + 2] * w;
		a += w;
	}
	if (a === 0) return '#000000';
	return toHex(Math.round(r / a), Math.round(g / a), Math.round(b / a));
}
