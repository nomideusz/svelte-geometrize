import sharp from 'sharp';
const [,, out, x, y, w, h, ...files] = process.argv;
const tiles = await Promise.all(files.map((f) => sharp(f).extract({ left: +x, top: +y, width: +w, height: +h }).resize(Math.round(w / 2)).toBuffer()));
const tw = Math.round(w / 2), th = Math.round(h / 2);
await sharp({ create: { width: tw * 2 + 6, height: th * Math.ceil(tiles.length / 2) + 6 * (Math.ceil(tiles.length / 2) - 1), channels: 3, background: '#222' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % 2) * (tw + 6), top: Math.floor(i / 2) * (th + 6) })))
  .png().toFile(out);
