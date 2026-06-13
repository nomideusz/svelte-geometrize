import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { generatePlaceholder } from './index.js';

async function makeJpeg(width: number, height: number): Promise<Buffer> {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
		<rect width="${width}" height="${height}" fill="#1c4587"/>
		<circle cx="${width * 0.7}" cy="${height * 0.3}" r="${Math.min(width, height) * 0.25}" fill="#ffd966"/>
	</svg>`;
	return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

describe('generatePlaceholder', () => {
	it('decodes, downscales and fits an image buffer', async () => {
		const jpeg = await makeJpeg(800, 600);
		const placeholder = await generatePlaceholder(jpeg, { shapes: 20, maxSize: 64 });
		expect(placeholder.w).toBe(800);
		expect(placeholder.h).toBe(600);
		expect(placeholder.fw).toBe(64);
		expect(placeholder.fh).toBe(48);
		expect(placeholder.s).toHaveLength(20);
	});

	it('does not upscale images smaller than maxSize', async () => {
		const jpeg = await makeJpeg(40, 30);
		const placeholder = await generatePlaceholder(jpeg, { shapes: 5, maxSize: 128 });
		expect(placeholder.fw).toBe(40);
		expect(placeholder.fh).toBe(30);
	});

	it('keeps the payload small', async () => {
		const jpeg = await makeJpeg(1200, 800);
		const placeholder = await generatePlaceholder(jpeg, { shapes: 100 });
		expect(JSON.stringify(placeholder).length).toBeLessThan(12_000);
	});
});
