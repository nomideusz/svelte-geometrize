import { describe, expect, it } from 'vitest';
import { fitShapes, fitSteps, optionsCacheKey } from './fit.js';
import {
	placeholderToSvg,
	placeholderToDataUri,
	shapeFragments,
	shapeCount,
	takeShapes,
	compactPlaceholder
} from './svg.js';
import type { GeometrizePlaceholderV1 } from './types.js';

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
	it('produces the requested number of ordered v2 shape entries', () => {
		const placeholder = fitShapes(gradientRgba(32, 32), 32, 32, 640, 640, { shapes: 12 });
		expect(placeholder.v).toBe(2);
		expect(shapeCount(placeholder)).toBe(12);
		expect(placeholder.w).toBe(640);
		expect(placeholder.h).toBe(640);
		expect(placeholder.fw).toBe(32);
		expect(placeholder.fh).toBe(32);
		if (placeholder.v !== 2) throw new Error('v2 expected');
		expect(placeholder.a).toBe(0.502);
		for (const entry of placeholder.s.split(';')) expect(entry).toMatch(/^p(-?\d+,){6}[0-9a-f]{6}$/);
		for (const frag of shapeFragments(placeholder)) {
			expect(frag).toMatch(/^<polygon points="-?\d+,-?\d+ -?\d+,-?\d+ -?\d+,-?\d+" fill="#[0-9a-f]{6}"\/>$/);
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
		expect(placeholder.bg).toBe('#c86432');
	});

	it('fits over the background it renders on, not black', () => {
		// a flat image over its own average needs no correction: the shape colour
		// is the image colour (from a black start it would come out doubled)
		const flat = new Uint8Array(16 * 16 * 4).map((_, i) => [100, 50, 25, 255][i % 4]);
		const placeholder = fitShapes(flat, 16, 16, 16, 16, { shapes: 1 });
		if (placeholder.v !== 2) throw new Error('v2 expected');
		expect(placeholder.s.endsWith(',643219')).toBe(true);
	});

	it('leaves the clear area of a cutout to the background', () => {
		// transparent half is fitted as the bg, not as black: every shape lands on
		// the opaque half (x < 16 in this 32×16 image)
		const data = new Uint8Array(32 * 16 * 4).map((_, i) => (i % 128 < 64 ? [200, 100, 50, 255][i % 4] : 0));
		const placeholder = fitShapes(data, 32, 16, 32, 16, { shapes: 5 });
		if (placeholder.v !== 2) throw new Error('v2 expected');
		expect(placeholder.bg).toBe('#c86432');
		for (const entry of placeholder.s.split(';')) expect(entry.endsWith(',000000')).toBe(false);
	});

	it('ignores transparent pixels when averaging the background', () => {
		const data = new Uint8Array(16 * 16 * 4);
		for (let i = 0; i < data.length; i += 4) {
			const opaque = i < data.length / 2;
			data[i] = 200;
			data[i + 1] = 100;
			data[i + 2] = 50;
			data[i + 3] = opaque ? 255 : 0;
		}
		const placeholder = fitShapes(data, 16, 16, 16, 16, { shapes: 1 });
		expect(placeholder.bg).toBe('#c86432');
	});

	it('supports other shape types', () => {
		const placeholder = fitShapes(gradientRgba(24, 24), 24, 24, 24, 24, {
			shapes: 4,
			shapeTypes: ['ellipse']
		});
		for (const frag of shapeFragments(placeholder)) expect(frag).toMatch(/^<ellipse /);
	});

	it('is deterministic with the default seed', () => {
		const a = fitShapes(gradientRgba(24, 24), 24, 24, 24, 24, { shapes: 8, seed: 1 });
		const b = fitShapes(gradientRgba(24, 24), 24, 24, 24, 24, { shapes: 8, seed: 1 });
		expect(a.s).toEqual(b.s);
		expect(a.bg).toBe(b.bg);
	});

	it('diverges with different seeds', () => {
		const a = fitShapes(gradientRgba(24, 24), 24, 24, 24, 24, { shapes: 8, seed: 1 });
		const b = fitShapes(gradientRgba(24, 24), 24, 24, 24, 24, { shapes: 8, seed: 99 });
		expect(a.s).not.toEqual(b.s);
		const zero = fitShapes(gradientRgba(24, 24), 24, 24, 24, 24, { shapes: 8, seed: 0 });
		expect(zero.s).not.toEqual(a.s);
	});

	it('stays reproducible when fits interleave step by step', () => {
		const alone = fitShapes(gradientRgba(24, 24), 24, 24, 24, 24, { shapes: 8, seed: 3 });
		const a = fitSteps(gradientRgba(24, 24), 24, 24, 24, 24, { shapes: 8, seed: 3 });
		const b = fitSteps(gradientRgba(24, 24), 24, 24, 24, 24, { shapes: 8, seed: 7 });
		let stepA = a.next();
		while (!stepA.done) {
			b.next();
			Math.random();
			stepA = a.next();
		}
		expect(stepA.value).toEqual(alone);
	});

	it('takes its look from a preset, and explicit options over it', () => {
		const soft = fitShapes(gradientRgba(16, 16), 16, 16, 16, 16, { shapes: 3, preset: 'soft' });
		expect(soft.v === 2 && soft.a).toBe(0.376);
		for (const frag of shapeFragments(soft)) expect(frag).toMatch(/^<ellipse .*rotate/);
		const mine = fitShapes(gradientRgba(16, 16), 16, 16, 16, 16, { shapes: 3, preset: 'soft', alpha: 255 });
		expect(mine.v === 2 && mine.a).toBe(1);
		expect(() => fitShapes(gradientRgba(8, 8), 8, 8, 8, 8, { preset: 'nope' as never })).toThrow(/Unknown preset/);
		expect(optionsCacheKey({ preset: 'mosaic' })).toBe(optionsCacheKey({ shapeTypes: ['rectangle'], alpha: 255 }));
	});

	it('stops early when targetScore is reached', () => {
		const capped = fitShapes(gradientRgba(24, 24), 24, 24, 24, 24, {
			shapes: 50,
			targetScore: 0.5,
			seed: 1
		});
		expect(shapeCount(capped)).toBeLessThan(50);
		expect(shapeCount(capped)).toBeGreaterThan(0);
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

describe('optionsCacheKey', () => {
	it('is stable regardless of shapeTypes order', () => {
		expect(
			optionsCacheKey({ shapeTypes: ['triangle', 'ellipse'], shapes: 10 })
		).toBe(optionsCacheKey({ shapeTypes: ['ellipse', 'triangle'], shapes: 10 }));
	});

	it('changes when options change', () => {
		expect(optionsCacheKey({ shapes: 10 })).not.toBe(optionsCacheKey({ shapes: 20 }));
	});
});

describe('placeholderToSvg', () => {
	it('wraps fragments in a viewBox-scaled svg with background', () => {
		const placeholder = fitShapes(gradientRgba(16, 16), 16, 16, 320, 320, { shapes: 3 });
		const svg = placeholderToSvg(placeholder);
		expect(svg).toContain('viewBox="0 0 16 16"');
		expect(svg).toContain(`fill="${placeholder.bg}"`);
		// 16/15: the fit's last pixel centre (15) stretched to the viewBox edge (16)
		expect(svg).toContain('<g transform="scale(1.0667 1.0667)" fill-opacity="0.502" stroke-opacity="0.502">');
		for (const frag of shapeFragments(placeholder)) expect(svg).toContain(frag);
	});

	it('renders every v2 shape kind', () => {
		const svg = placeholderToSvg({
			v: 2, w: 10, h: 10, fw: 10, fh: 10, bg: '#000000', a: 0.5,
			s: 'p0,0,5,0,0,5,ff0000;r1,1,2,3,00ff00;R1,1,2,4,30,0000ff;e5,5,2,1,111111;E5,5,2,1,45,222222;c3,3,1,333333;l0,0,9,9,444444;q0,9,5,0,9,9,555555'
		});
		expect(svg).toContain('<polygon points="0,0 5,0 0,5" fill="#ff0000"/>');
		expect(svg).toContain('<rect x="1" y="1" width="2" height="3" fill="#00ff00"/>');
		expect(svg).toContain('<rect x="1" y="1" width="2" height="4" transform="rotate(30 2 3)" fill="#0000ff"/>');
		expect(svg).toContain('<ellipse cx="5" cy="5" rx="2" ry="1" fill="#111111"/>');
		expect(svg).toContain('<ellipse cx="5" cy="5" rx="2" ry="1" transform="rotate(45 5 5)" fill="#222222"/>');
		expect(svg).toContain('<circle cx="3" cy="3" r="1" fill="#333333"/>');
		expect(svg).toContain('<line x1="0" y1="0" x2="9" y2="9" stroke="#444444" stroke-width="1" fill="none"/>');
		expect(svg).toContain('<path d="M0 9Q5 0 9 9" stroke="#555555" stroke-width="1" fill="none"/>');
	});

	it('encodes a usable data URI', () => {
		const placeholder = fitShapes(gradientRgba(8, 8), 8, 8, 8, 8, { shapes: 1 });
		const uri = placeholderToDataUri(placeholder);
		expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
		expect(uri).not.toContain('<');
		expect(uri).not.toContain('"');
	});
});

describe('takeShapes', () => {
	it('keeps the first n shapes of either format', () => {
		const v2 = fitShapes(gradientRgba(16, 16), 16, 16, 16, 16, { shapes: 10 });
		expect(shapeCount(takeShapes(v2, 4))).toBe(4);
		expect(shapeCount(takeShapes(v2, 99))).toBe(10);
		const v1: GeometrizePlaceholderV1 = { v: 1, w: 1, h: 1, fw: 1, fh: 1, bg: '#000', s: ['<a/>', '<b/>', '<c/>'] };
		expect(takeShapes(v1, 2).s).toEqual(['<a/>', '<b/>']);
	});
});

describe('compactPlaceholder', () => {
	const v1: GeometrizePlaceholderV1 = {
		v: 1, w: 800, h: 600, fw: 128, fh: 96, bg: '#695346',
		s: [
			'<polygon points="25,0 24,49 0,37" fill="#f29157" fill-opacity=".501"/>',
			'<polygon points="3 4 5 6 7 8 9 10" fill="rgb(255,0,16)" fill-opacity=".501"/>',
			'<rect x="1" y="2" width="3" height="4" fill="#00ff00" fill-opacity=".501"/>',
			'<ellipse cx="5" cy="5" rx="2" ry="1" fill="#111111" fill-opacity=".501"/>',
			'<circle cx="3" cy="3" r="1" fill="#333333" fill-opacity=".501"/>',
			'<line x1="0" y1="0" x2="9" y2="9" stroke="#444444" stroke-width="1" fill="none" stroke-opacity=".501"/>',
			'<path d="M0 9 Q 5 0 9 9" stroke="#555555" stroke-width="1" fill="none" stroke-opacity=".501"/>',
			'<g transform="translate(5 6) rotate(45) scale(2 1)"><ellipse cx="0" cy="0" rx="1" ry="1" fill="#222222" fill-opacity=".501"/></g>'
		]
	};

	it('re-encodes every v1 fragment the fitter produces, a third of the bytes', () => {
		const v2 = compactPlaceholder(v1);
		expect(v2.v).toBe(2);
		if (v2.v !== 2) throw new Error('v2 expected');
		expect(v2.a).toBe(0.501);
		expect(v2.s).toBe(
			'p25,0,24,49,0,37,f29157;p3,4,5,6,7,8,9,10,ff0010;r1,2,3,4,00ff00;e5,5,2,1,111111;c3,3,1,333333;l0,0,9,9,444444;q0,9,5,0,9,9,555555;E5,6,2,1,45,222222'
		);
		expect(JSON.stringify(v2).length * 2.5).toBeLessThan(JSON.stringify(v1).length);
		// the shapes come back as the same markup, minus the per-shape opacity
		expect(shapeFragments(v2)[0]).toBe('<polygon points="25,0 24,49 0,37" fill="#f29157"/>');
	});

	it('leaves a placeholder alone when a fragment is not one it knows', () => {
		const odd: GeometrizePlaceholderV1 = { ...v1, s: [...v1.s, '<text>hi</text>'] };
		expect(compactPlaceholder(odd)).toBe(odd);
		const mixed: GeometrizePlaceholderV1 = { ...v1, s: [v1.s[0], v1.s[0].replace('.501', '.8')] };
		expect(compactPlaceholder(mixed)).toBe(mixed);
	});
});
