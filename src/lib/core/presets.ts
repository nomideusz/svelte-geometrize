import type { GeometrizePreset, ShapeKind } from './types.js';

/** Named looks for the `preset` option: shape kinds and their opacity. */
export const PRESETS: Record<GeometrizePreset, { shapeTypes: ShapeKind[]; alpha: number }> = {
	triangles: { shapeTypes: ['triangle'], alpha: 128 },
	'low-poly': { shapeTypes: ['triangle'], alpha: 255 },
	soft: { shapeTypes: ['rotated-ellipse'], alpha: 96 },
	mosaic: { shapeTypes: ['rectangle'], alpha: 255 },
	bubbles: { shapeTypes: ['circle'], alpha: 200 }
};
