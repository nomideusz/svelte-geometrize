import { describe, expect, it } from 'vitest';
import { fitShapes } from './fit.js';
import { placeholderToSvg, placeholderToDataUri } from './svg.js';

function gradientRgba(w: number, h: number): Uint8Array {
	const data = new Uint8Array(w * h * 4);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			data[i] = Math.round((x / (w - 1)) * 255);
			data[i + 1] = 40;
			data[i + 2] = Math.round((y / (h - 1)) * 255);
			data[i + 3] = 255;
		}
	}
	return data;
}

describe('fitShapes', () => {
	it('produces the requested number of ordered SVG fragments', () => {
		const placeholder = fitShapes(gradientRgba(32, 32), 32, 32, 640, 640, { shapes: 12 });
		expect(placeholder.v).toBe(1);
		expect(placeholder.s).toHaveLength(12);
		expect(placeholder.w).toBe(640);
		expect(placeholder.h).toBe(640);
		expect(placeholder.fw).toBe(32);
		expect(placeholder.fh).toBe(32);
		for (const frag of placeholder.s) {
			expect(frag).toMatch(/^<polygon /);
			expect(frag).toMatch(/fill="rgb\(\d+,\d+,\d+\)"/);
		}
	});

	it('computes the average color as background', () => {
		const flat = new Uint8Array(16 * 16 * 4);
		for (let i = 0; i < flat.length; i += 4) {
			flat[i] = 200;
			flat[i + 1] = 100;
			flat[i + 2] = 50;
			flat[i + 3] = 255;
		}
		const placeholder = fitShapes(flat, 16, 16, 16, 16, { shapes: 1 });
		expect(placeholder.bg).toBe('rgb(200,100,50)');
	});

	it('ignores transparent pixels when averaging the background', () => {
		// Half opaque red-ish, half fully transparent (0,0,0,0). A naive mean would
		// halve the channels toward black; alpha weighting must yield the opaque color.
		const data = new Uint8Array(16 * 16 * 4);
		for (let i = 0; i < data.length; i += 4) {
			const opaque = i < data.length / 2;
			data[i] = 200;
			data[i + 1] = 100;
			data[i + 2] = 50;
			data[i + 3] = opaque ? 255 : 0;
		}
		const placeholder = fitShapes(data, 16, 16, 16, 16, { shapes: 1 });
		expect(placeholder.bg).toBe('rgb(200,100,50)');
	});

	it('supports other shape types', () => {
		const placeholder = fitShapes(gradientRgba(24, 24), 24, 24, 24, 24, {
			shapes: 4,
			shapeTypes: ['ellipse']
		});
		for (const frag of placeholder.s) expect(frag).toMatch(/^<ellipse /);
	});

	it('rejects mismatched pixel data', () => {
		expect(() => fitShapes(new Uint8Array(10), 32, 32)).toThrow(/does not match/);
	});

	it('rejects unknown shape types', () => {
		expect(() =>
			fitShapes(gradientRgba(8, 8), 8, 8, 8, 8, {
				shapes: 1,
				shapeTypes: ['hexagon' as never]
			})
		).toThrow(/Unknown shape type/);
	});
});

describe('placeholderToSvg', () => {
	it('wraps fragments in a viewBox-scaled svg with background', () => {
		const placeholder = fitShapes(gradientRgba(16, 16), 16, 16, 320, 320, { shapes: 3 });
		const svg = placeholderToSvg(placeholder);
		expect(svg).toContain('viewBox="0 0 16 16"');
		expect(svg).toContain(`fill="${placeholder.bg}"`);
		for (const frag of placeholder.s) expect(svg).toContain(frag);
	});

	it('encodes a usable data URI', () => {
		const placeholder = fitShapes(gradientRgba(8, 8), 8, 8, 8, 8, { shapes: 1 });
		const uri = placeholderToDataUri(placeholder);
		expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
		expect(uri).not.toContain('<');
		expect(uri).not.toContain('"');
	});
});
