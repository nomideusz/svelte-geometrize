// Renders media/reveal.webp — the README's animated clip — from a demo photo:
// the shapes come in on the component's own stagger curve, then the photo comes
// into focus over them the way the component does it. Frame-by-frame with sharp, so it is reproducible
// (needs ffmpeg on PATH):
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
const PHOTO_AT = 1900; // the photo's focus pull starts…
const PHOTO_MS = 800; // …and lasts (fadeDuration)
const FOCUS = 0.02 * W; // its starting blur (--geometrize-focus: 2cqw)
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
const push = async (raw, ms) => {
	frames.push(await png(raw));
	durations.push(ms);
};

await push(bare, 200);
const full = await shapesAt(PHOTO_AT);
for (let ms = 0; ms < PHOTO_AT; ms += FRAME) await push(await shapesAt(ms), FRAME);
const focus = async (sigma) =>
	sigma < 0.3 ? photo : sharp(photo, { raw: { width: W, height: H, channels: 3 } }).blur(sigma).raw().toBuffer();
// opaque by 45% of the run, sharp by the end — the component's two transitions
for (let ms = 0; ms < PHOTO_MS; ms += FRAME) {
	const t = ms / PHOTO_MS;
	await push(mix(full, await focus(FOCUS * (1 - easeOut(t))), easeOut(clamp(t / 0.45))), FRAME);
}
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
