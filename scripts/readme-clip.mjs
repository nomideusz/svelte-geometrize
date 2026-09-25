// Renders media/reveal.webp — the README's animated clip — from a demo photo:
// the shapes come in on the component's own stagger curve, then the photo opens
// through them the way the component hands off. Frame-by-frame with sharp, so it
// is reproducible (needs ffmpeg on PATH):
//   pnpm package && node scripts/readme-clip.mjs
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generatePlaceholder } from '../dist/node/index.js';
import { shapeFragments, shapeGroupOpen } from '../dist/core/svg.js';

const PHOTO = 'src/routes/photos/medusa.webp';
const OUT = 'media/reveal.webp';
const W = 640;
const H = 427;
const FRAME = 40; // ms — 25 fps
const REVEAL = 1100; // until the last shape starts (the component's revealMs)
const SHAPE = 400; // each shape's fade (shapeDuration)
const PHOTO_AT = 1900; // the handoff starts…
const PHOTO_MS = 800; // …and lasts (fadeDuration)
const HOLD = 1600; // the photo, still
const OUT_MS = 400; // back to the bare background, where the loop starts

const placeholder = await generatePlaceholder(PHOTO);
const frags = shapeFragments(placeholder);
const last = Math.max(frags.length - 1, 1);
const gap = REVEAL / last;
const delays = frags.map((_, i) => (i / last) ** 1.6 * last * gap);
const easeOut = (t) => 1 - (1 - t) ** 2;
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.min(1, Math.max(0, t));

async function shapesAt(ms) {
	const shapes = frags
		.map((frag, i) => [frag, easeOut(clamp((ms - delays[i]) / SHAPE))])
		.filter(([, o]) => o > 0)
		.map(([frag, o]) => (o < 1 ? `<g opacity="${o.toFixed(3)}">${frag}</g>` : frag))
		.join('');
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${placeholder.fw} ${placeholder.fh}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">` +
		`<rect width="${placeholder.fw}" height="${placeholder.fh}" fill="${placeholder.bg}"/>` +
		`${shapeGroupOpen(placeholder)}${shapes}</g></svg>`;
	return sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer();
}

const photo = await sharp(PHOTO).resize(W, H, { fit: 'cover' }).removeAlpha().raw().toBuffer();
const bare = await shapesAt(-1);
const mix = (a, b, t) => {
	const out = Buffer.alloc(a.length);
	for (let i = 0; i < a.length; i++) out[i] = Math.round(a[i] + (b[i] - a[i]) * t);
	return out;
};
const png = (raw) => sharp(raw, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();

const frames = [];
const durations = [];
// The handoff's mask: every shape white and opaque, grown from its centre, the
// last fitted first, across 70% of the run; then the gaps fill in.
const white = (frag) => frag.replace(/(fill|stroke)="#[0-9a-f]+"/gi, '$1="#fff"');
const group = shapeGroupOpen(placeholder).replace(/(fill|stroke)-opacity="[^"]*"/g, '$1-opacity="1"');
const centre = (frag) => {
	const num = (name) => Number(frag.match(new RegExp(` ${name}="([-\\d.]+)"`))?.[1] ?? 0);
	if (frag.startsWith('<rect')) return [num('x') + num('width') / 2, num('y') + num('height') / 2];
	if (frag.startsWith('<line')) return [(num('x1') + num('x2')) / 2, (num('y1') + num('y2')) / 2];
	if (/^<(ellipse|circle)/.test(frag)) return [num('cx'), num('cy')];
	const xy = (frag.match(/(?:points|d)="([^"]*)"/)?.[1] ?? '').match(/-?[\d.]+/g).map(Number);
	const xs = xy.filter((_, i) => i % 2 === 0), ys = xy.filter((_, i) => i % 2 === 1);
	return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};
const centres = frags.map(centre);
async function maskAt(ms) {
	const windows = frags
		.map((frag, i) => [frag, i, easeOut(clamp((ms - (1 - i / last) * 0.7 * PHOTO_MS) / (0.3 * PHOTO_MS)))])
		.filter(([, , k]) => k > 0)
		.map(([frag, i, k]) => {
			const [x, y] = centres[i];
			return `<g transform="translate(${x} ${y}) scale(${k.toFixed(4)}) translate(${-x} ${-y})">${white(frag)}</g>`;
		})
		.join('');
	const gaps = easeOut(clamp((ms - 0.7 * PHOTO_MS) / (0.3 * PHOTO_MS)));
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${placeholder.fw} ${placeholder.fh}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">` +
		`<rect width="${placeholder.fw}" height="${placeholder.fh}" fill="#000"/>` +
		`${group}${windows}</g>` +
		`<rect width="${placeholder.fw}" height="${placeholder.fh}" fill="#fff" opacity="${gaps.toFixed(4)}"/></svg>`;
	return sharp(Buffer.from(svg)).greyscale().raw().toBuffer();
}
const through = (under, over, mask) => {
	const out = Buffer.alloc(under.length);
	for (let i = 0; i < under.length; i++) {
		const m = mask[Math.floor(i / 3)] / 255;
		out[i] = Math.round(under[i] + (over[i] - under[i]) * m);
	}
	return out;
};
const push = async (raw, ms) => {
	frames.push(await png(raw));
	durations.push(ms);
};

await push(bare, 200);
const full = await shapesAt(PHOTO_AT);
for (let ms = 0; ms < PHOTO_AT; ms += FRAME) await push(await shapesAt(ms), FRAME);
for (let ms = 0; ms < PHOTO_MS; ms += FRAME) await push(through(full, photo, await maskAt(ms)), FRAME);
await push(photo, HOLD);
for (let ms = FRAME; ms < OUT_MS; ms += FRAME) await push(mix(photo, bare, smooth(ms / OUT_MS)), FRAME);

// libwebp's animation encoder codes each frame as a lossy patch over the last,
// and on these flat blues the patch edges pile up into visible seams. ffmpeg's
// plain libwebp encoder keeps every frame whole: ~2× the bytes, no seams.
const tmp = await mkdtemp(join(tmpdir(), 'geometrize-clip-'));
let list = '';
for (const [i, frame] of frames.entries()) {
	const file = join(tmp, `${String(i).padStart(3, '0')}.png`);
	await writeFile(file, frame);
	list += `file '${file}'\nduration ${durations[i] / 1000}\n`;
}
await writeFile(join(tmp, 'list.txt'), list + `file '${join(tmp, `${String(frames.length - 1).padStart(3, '0')}.png`)}'\n`);
await mkdir('media', { recursive: true });
execFileSync('ffmpeg', [
	'-loglevel', 'error', '-y',
	'-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'),
	'-fps_mode', 'passthrough',
	'-c:v', 'libwebp', '-lossless', '0', '-q:v', '60', '-compression_level', '6', '-loop', '0',
	OUT
]);
await rm(tmp, { recursive: true });
const { size } = await stat(OUT);
console.log(`${OUT}: ${frames.length} frames, ${Math.round(size / 1024)} KB`);
