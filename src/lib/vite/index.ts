import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { generatePlaceholder } from '../node/index.js';
import { optionsCacheKey } from '../core/fit.js';
import type { GeometrizeOptions, ShapeKind } from '../core/types.js';

export interface GeometrizePluginOptions extends GeometrizeOptions {
	/**
	 * Directory for persistent fit cache (content-hash + options keyed).
	 * Default: `node_modules/.cache/svelte-geometrize`.
	 * Set `false` to disable disk cache (memory only).
	 */
	cacheDir?: string | false;
}

/**
 * Vite plugin: `import placeholder from './photo.jpg?geometrize'` resolves to
 * a GeometrizePlaceholder object, fitted at build time.
 *
 * Per-import overrides via query params:
 * `./photo.jpg?geometrize&shapes=150&alpha=160&maxSize=160&shapeTypes=triangle,ellipse`
 *
 * Fits are cached on disk by file content hash + resolved options, so clean
 * rebuilds skip already-fitted images. Concurrent loads of the same key coalesce.
 */
export function geometrize(defaults: GeometrizePluginOptions = {}): Plugin {
	const { cacheDir: cacheDirOpt, ...optionDefaults } = defaults;
	const memory = new Map<string, { code: string }>();
	const inflight = new Map<string, Promise<string>>();
	let cacheDir: string | false =
		cacheDirOpt === false
			? false
			: cacheDirOpt ?? join(process.cwd(), 'node_modules/.cache/svelte-geometrize');

	return {
		name: 'svelte-geometrize',
		enforce: 'pre',
		configResolved(config) {
			if (cacheDirOpt === undefined) {
				cacheDir = join(config.root, 'node_modules/.cache/svelte-geometrize');
			} else if (cacheDirOpt === false) {
				cacheDir = false;
			} else {
				cacheDir = cacheDirOpt;
			}
		},
		async load(id) {
			const [path, rawQuery] = id.split('?', 2);
			if (!rawQuery) return null;
			const query = new URLSearchParams(rawQuery);
			if (!query.has('geometrize')) return null;

			const options = { ...optionDefaults, ...parseQueryOptions(query) };
			const key = await contentKey(path, options);

			const hit = memory.get(key);
			if (hit) return hit.code;

			const pending = inflight.get(key);
			if (pending) return pending;

			const work = (async () => {
				// Always watch so HMR re-runs when the source image changes
				this.addWatchFile(path);

				if (cacheDir) {
					const disk = await readDiskCache(cacheDir, key);
					if (disk) {
						memory.set(key, { code: disk });
						return disk;
					}
				}

				const placeholder = await generatePlaceholder(path, options);
				const code = `export default ${JSON.stringify(placeholder)};`;
				memory.set(key, { code });
				if (cacheDir) await writeDiskCache(cacheDir, key, code);
				return code;
			})().finally(() => inflight.delete(key));

			inflight.set(key, work);
			return work;
		}
	};
}

async function contentKey(path: string, options: GeometrizeOptions): Promise<string> {
	const buf = await readFile(path);
	return createHash('sha256')
		.update(buf)
		.update('\0')
		.update(optionsCacheKey(options))
		.digest('hex')
		.slice(0, 40);
}

async function readDiskCache(dir: string, key: string): Promise<string | null> {
	try {
		return await readFile(join(dir, `${key}.js`), 'utf8');
	} catch {
		return null;
	}
}

async function writeDiskCache(dir: string, key: string, code: string): Promise<void> {
	try {
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, `${key}.js`), code, 'utf8');
	} catch {
		// cache is best-effort — never fail the build over it
	}
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
	const float = (name: string): number | undefined => {
		const raw = query.get(name);
		if (raw === null) return undefined;
		const value = Number.parseFloat(raw);
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
	const seed = int('seed');
	if (seed !== undefined) options.seed = seed;
	const targetScore = float('targetScore');
	if (targetScore !== undefined) options.targetScore = targetScore;
	const shapeTypes = query.get('shapeTypes');
	if (shapeTypes) options.shapeTypes = shapeTypes.split(',') as ShapeKind[];
	return options;
}
