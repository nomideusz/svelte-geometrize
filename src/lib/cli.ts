#!/usr/bin/env node
/**
 * Batch-generate geometrize placeholders for ingest / backfill scripts.
 *
 *   npx svelte-geometrize photo.jpg
 *   npx svelte-geometrize ./photos --out ./placeholders --shapes 80
 *   npx svelte-geometrize photo.jpg -o photo.json --target-score 0.15
 */
import { mkdir, readdir, writeFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.avif']);

function printHelp(): void {
	console.log(`Usage: svelte-geometrize <file-or-dir> [options]

Options:
  -o, --out <path>       Output JSON file (single input) or directory (batch)
  --shapes <n>           Shape count (default 100)
  --max-size <n>         Longest edge before fitting (default 128)
  --alpha <n>            Shape opacity 0–255 (default 128)
  --shape-types <list>   Comma-separated types (default triangle)
  --seed <n>             PRNG seed (default 1; use "false" for random)
  --target-score <n>     Stop early when score ≤ n
  --candidates <n>       candidateShapesPerStep
  --mutations <n>        shapeMutationsPerStep
  -h, --help             Show this help

Requires peer dependency: sharp
`);
}

function argValue(args: string[], i: number): string {
	const v = args[i + 1];
	if (v === undefined || v.startsWith('-')) {
		throw new Error(`Missing value for ${args[i]}`);
	}
	return v;
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
		printHelp();
		process.exit(args.length === 0 ? 1 : 0);
	}

	let input = '';
	let out: string | undefined;
	const options: Record<string, unknown> = {};

	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		switch (a) {
			case '-o':
			case '--out':
				out = argValue(args, i);
				i++;
				break;
			case '--shapes':
				options.shapes = Number.parseInt(argValue(args, i), 10);
				i++;
				break;
			case '--max-size':
				options.maxSize = Number.parseInt(argValue(args, i), 10);
				i++;
				break;
			case '--alpha':
				options.alpha = Number.parseInt(argValue(args, i), 10);
				i++;
				break;
			case '--shape-types':
				options.shapeTypes = argValue(args, i).split(',');
				i++;
				break;
			case '--seed': {
				const raw = argValue(args, i);
				options.seed = raw === 'false' ? false : Number.parseInt(raw, 10);
				i++;
				break;
			}
			case '--target-score':
				options.targetScore = Number.parseFloat(argValue(args, i));
				i++;
				break;
			case '--candidates':
				options.candidateShapesPerStep = Number.parseInt(argValue(args, i), 10);
				i++;
				break;
			case '--mutations':
				options.shapeMutationsPerStep = Number.parseInt(argValue(args, i), 10);
				i++;
				break;
			default:
				if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
				if (input) throw new Error('Only one input path is supported');
				input = a;
		}
	}

	if (!input) {
		printHelp();
		process.exit(1);
	}

	// Dynamic import so --help works even without sharp installed
	let generatePlaceholder: (
		input: string | Buffer,
		options?: Record<string, unknown>
	) => Promise<unknown>;
	try {
		const mod = await import('./node/index.js');
		generatePlaceholder = mod.generatePlaceholder as typeof generatePlaceholder;
	} catch (err) {
		console.error(
			'svelte-geometrize: failed to load the Node API. Install the optional peer dependency:\n  npm i sharp\n',
			err instanceof Error ? err.message : err
		);
		process.exit(1);
	}

	const abs = resolve(input);
	const info = await stat(abs);
	const files: string[] = [];

	if (info.isDirectory()) {
		for (const name of await readdir(abs)) {
			if (IMAGE_EXT.has(extname(name).toLowerCase())) files.push(join(abs, name));
		}
		files.sort();
		if (files.length === 0) {
			console.error(`No images found in ${abs}`);
			process.exit(1);
		}
	} else {
		files.push(abs);
	}

	const batch = files.length > 1 || info.isDirectory();
	const outDir = batch ? resolve(out ?? join(abs, info.isDirectory() ? '' : dirname(abs), 'placeholders')) : undefined;

	if (outDir) await mkdir(outDir, { recursive: true });

	for (const file of files) {
		const started = performance.now();
		const placeholder = await generatePlaceholder(file, options);
		const json = JSON.stringify(placeholder);
		const dest = batch
			? join(outDir!, `${basename(file, extname(file))}.json`)
			: resolve(out ?? `${file}.geometrize.json`);
		await mkdir(dirname(dest), { recursive: true });
		await writeFile(dest, json, 'utf8');
		const ms = Math.round(performance.now() - started);
		const shapes = (placeholder as { s: string[] }).s.length;
		console.log(`${basename(file)} → ${dest} (${shapes} shapes, ${json.length} B, ${ms} ms)`);
	}
}

// Only run when executed directly (not when imported in tests)
const isDirect =
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirect) {
	main().catch((err) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	});
}

export { main };
