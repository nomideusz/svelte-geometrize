import { stat } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { generatePlaceholder } from '../node/index.js';
import type { GeometrizeOptions, ShapeKind } from '../core/types.js';

/**
 * Vite plugin: `import placeholder from './photo.jpg?geometrize'` resolves to
 * a GeometrizePlaceholder object, fitted at build time.
 *
 * Per-import overrides via query params:
 * `./photo.jpg?geometrize&shapes=150&alpha=160&maxSize=160&shapeTypes=triangle,ellipse`
 */
export function geometrize(defaults: GeometrizeOptions = {}): Plugin {
	const cache = new Map<string, { mtimeMs: number; code: string }>();

	return {
		name: 'svelte-geometrize',
		enforce: 'pre',
		async load(id) {
			const [path, rawQuery] = id.split('?', 2);
			if (!rawQuery) return null;
			const query = new URLSearchParams(rawQuery);
			if (!query.has('geometrize')) return null;

			const options = { ...defaults, ...parseQueryOptions(query) };
			const { mtimeMs } = await stat(path);
			const cached = cache.get(id);
			if (cached && cached.mtimeMs === mtimeMs) return cached.code;

			this.addWatchFile(path);
			const placeholder = await generatePlaceholder(path, options);
			const code = `export default ${JSON.stringify(placeholder)};`;
			cache.set(id, { mtimeMs, code });
			return code;
		}
	};
}

function parseQueryOptions(query: URLSearchParams): GeometrizeOptions {
	const options: GeometrizeOptions = {};
	const int = (name: string): number | undefined => {
		const raw = query.get(name);
		if (raw === null) return undefined;
		const value = Number.parseInt(raw, 10);
		if (Number.isNaN(value)) throw new Error(`svelte-geometrize: invalid ?${name}=${raw}`);
		return value;
	};
	const shapes = int('shapes');
	if (shapes !== undefined) options.shapes = shapes;
	const alpha = int('alpha');
	if (alpha !== undefined) options.alpha = alpha;
	const maxSize = int('maxSize');
	if (maxSize !== undefined) options.maxSize = maxSize;
	const candidates = int('candidateShapesPerStep');
	if (candidates !== undefined) options.candidateShapesPerStep = candidates;
	const mutations = int('shapeMutationsPerStep');
	if (mutations !== undefined) options.shapeMutationsPerStep = mutations;
	const shapeTypes = query.get('shapeTypes');
	if (shapeTypes) options.shapeTypes = shapeTypes.split(',') as ShapeKind[];
	return options;
}
