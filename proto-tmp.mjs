import sharp from 'sharp';
import { generatePlaceholder, placeholderToSvg } from './dist/node/index.js';
const W = 480, H = 320, S = process.argv[2];
const p = await generatePlaceholder('src/routes/photos/medusa.webp');
const svg = placeholderToSvg(p).replace('<svg ', `<svg width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" `);
const shapes = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer();
const photoImg = sharp('src/routes/photos/medusa.webp').resize(W, H, { fit: 'cover' }).removeAlpha();
const photo = await photoImg.clone().raw().toBuffer();
const blurred = async (sigma) => sigma < 0.3 ? photo : sharp(photo, { raw: { width: W, height: H, channels: 3 } }).blur(sigma).raw().toBuffer();
const mix = (a, b, t) => { const o = Buffer.alloc(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.round(a[i] + (b[i] - a[i]) * t); return o; };
const ease = (t) => 1 - (1 - t) ** 2, clamp = (t) => Math.min(1, Math.max(0, t));
const recipes = {
  // today: opacity only, standard curve
  fade: async (t) => mix(shapes, photo, ease(t)),
  // focus pull: opacity done by 45%, blur 2% of width → 0 over the whole run
  focus: async (t) => mix(shapes, await blurred(0.02 * W * (1 - ease(t))), ease(clamp(t / 0.45))),
};
const ts = [0.1, 0.25, 0.4, 0.6, 0.8];
const rows = [];
for (const [name, fn] of Object.entries(recipes)) for (const t of ts) rows.push(await sharp(await fn(t), { raw: { width: W, height: H, channels: 3 } }).png().toBuffer());
const tw = W, th = H, cols = ts.length;
await sharp({ create: { width: cols * (tw + 4), height: Object.keys(recipes).length * (th + 4), channels: 3, background: '#222' } })
  .composite(rows.map((input, i) => ({ input, left: (i % cols) * (tw + 4), top: Math.floor(i / cols) * (th + 4) })))
  .png().toBuffer().then((b) => sharp(b).resize(cols * 260).toFile(`${S}/proto.png`));
