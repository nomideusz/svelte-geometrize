import sharp from 'sharp';
import { fitShapes, DEFAULT_OPTIONS } from '../core/fit.js';
import type { GeometrizeOptions, GeometrizePlaceholder } from '../core/types.js';

export { fitShapes, DEFAULT_OPTIONS } from '../core/fit.js';
export { placeholderToSvg, placeholderToDataUri } from '../core/svg.js';
export type { GeometrizeOptions, GeometrizePlaceholder, ShapeKind } from '../core/types.js';

/**
 * Generates a placeholder from an image file or buffer. Decodes with sharp,
 * downscales to `maxSize` (fitting cost scales with pixel count; the SVG
 * scales back up losslessly), then fits shapes.
 */
export async function generatePlaceholder(
	input: string | Buffer,
	options: GeometrizeOptions = {}
): Promise<GeometrizePlaceholder> {
	const maxSize = options.maxSize ?? DEFAULT_OPTIONS.maxSize;
	const image = sharp(input).rotate(); // apply EXIF orientation
	const meta = await image.metadata();
	if (!meta.width || !meta.height) {
		throw new Error('svelte-geometrize: could not read image dimensions');
	}
	// metadata() reports pre-rotation dimensions; swap for sideways EXIF orientations
	const sideways = meta.orientation !== undefined && meta.orientation >= 5;
	const sourceWidth = sideways ? meta.height : meta.width;
	const sourceHeight = sideways ? meta.width : meta.height;

	const { data, info } = await image
		.resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	return fitShapes(
		new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
		info.width,
		info.height,
		sourceWidth,
		sourceHeight,
		options
	);
}
