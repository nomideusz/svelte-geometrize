import sharp from 'sharp';
import { readdirSync } from 'node:fs';
const [dir, from = '-600', step = '40'] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const raw = await Promise.all(files.map((f) => sharp(`${dir}/${f}`).resize(240).removeAlpha().raw().toBuffer()));
let line = '';
for (let i = 1; i < raw.length; i++) {
	let sum = 0;
	for (let j = 0; j < raw[i].length; j++) sum += Math.abs(raw[i][j] - raw[i - 1][j]);
	const d = sum / raw[i].length;
	line += `${String(+from + i * +step).padStart(5)} ${d.toFixed(2).padStart(6)} ${'#'.repeat(Math.round(d * 3))}\n`;
}
console.log(line);
