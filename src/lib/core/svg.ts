import type { GeometrizePlaceholder, GeometrizePlaceholderV2 } from './types.js';

/** Number of shapes in a placeholder of either format. */
export function shapeCount(placeholder: GeometrizePlaceholder): number {
	if (placeholder.v === 1) return placeholder.s.length;
	return placeholder.s ? placeholder.s.split(';').length : 0;
}

/**
 * The first `n` shapes of a placeholder — the fit is ordered, so this is a
 * coarser preview, not a random subset. Trim at render time to trade
 * detail for bytes without re-fitting.
 */
export function takeShapes<P extends GeometrizePlaceholder>(placeholder: P, n: number): P {
	if (placeholder.v === 1) return { ...placeholder, s: placeholder.s.slice(0, n) };
	return { ...placeholder, s: placeholder.s.split(';').slice(0, n).join(';') };
}

const stroke = (hex: string) => `stroke="#${hex}" stroke-width="1" fill="none"`;

/** One v2 shape entry → an SVG fragment (opacity comes from the enclosing group). */
function decodeShape(entry: string): string {
	const kind = entry[0];
	const parts = entry.slice(1).split(',');
	const hex = parts.pop()!;
	const n = parts.map(Number);
	const fill = `fill="#${hex}"`;
	switch (kind) {
		case 'p': {
			let points = '';
			for (let i = 0; i < n.length; i += 2) points += `${i ? ' ' : ''}${n[i]},${n[i + 1]}`;
			return `<polygon points="${points}" ${fill}/>`;
		}
		case 'r':
			return `<rect x="${n[0]}" y="${n[1]}" width="${n[2]}" height="${n[3]}" ${fill}/>`;
		case 'R':
			return `<rect x="${n[0]}" y="${n[1]}" width="${n[2]}" height="${n[3]}" transform="rotate(${n[4]} ${n[0] + n[2] / 2} ${n[1] + n[3] / 2})" ${fill}/>`;
		case 'e':
			return `<ellipse cx="${n[0]}" cy="${n[1]}" rx="${n[2]}" ry="${n[3]}" ${fill}/>`;
		case 'E':
			return `<ellipse cx="${n[0]}" cy="${n[1]}" rx="${n[2]}" ry="${n[3]}" transform="rotate(${n[4]} ${n[0]} ${n[1]})" ${fill}/>`;
		case 'c':
			return `<circle cx="${n[0]}" cy="${n[1]}" r="${n[2]}" ${fill}/>`;
		case 'l':
			return `<line x1="${n[0]}" y1="${n[1]}" x2="${n[2]}" y2="${n[3]}" ${stroke(hex)}/>`;
		case 'q':
			return `<path d="M${n[0]} ${n[1]}Q${n[2]} ${n[3]} ${n[4]} ${n[5]}" ${stroke(hex)}/>`;
		default:
			throw new Error(`svelte-geometrize: unknown shape kind "${kind}"`);
	}
}

/**
 * The placeholder's shapes as SVG fragments in fit order. v1 fragments carry
 * their own opacity; v2 fragments do not — wrap them in `shapeGroupOpen()`.
 */
export function shapeFragments(placeholder: GeometrizePlaceholder): string[] {
	if (placeholder.v === 1) return placeholder.s;
	return placeholder.s ? placeholder.s.split(';').map(decodeShape) : [];
}

/** Opening `<g>` that gives v2 shapes their shared opacity (a bare `<g>` for v1). */
export function shapeGroupOpen(placeholder: GeometrizePlaceholder): string {
	if (placeholder.v === 1) return '<g>';
	return `<g fill-opacity="${placeholder.a}" stroke-opacity="${placeholder.a}">`;
}

/**
 * Serializes a placeholder to a standalone SVG string — useful for SSR,
 * emails, og-images, or a CSS background via data URI. No geometrize
 * dependency: safe to import in the browser.
 */
export function placeholderToSvg(placeholder: GeometrizePlaceholder): string {
	const { fw, fh, bg } = placeholder;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fw} ${fh}">` +
		`<rect width="${fw}" height="${fh}" fill="${bg}"/>` +
		shapeGroupOpen(placeholder) +
		shapeFragments(placeholder).join('') +
		`</g></svg>`
	);
}

/** Placeholder as a data URI, usable in `background-image` or `<img src>`. */
export function placeholderToDataUri(placeholder: GeometrizePlaceholder): string {
	const svg = placeholderToSvg(placeholder)
		.replace(/"/g, "'")
		.replace(/#/g, '%23')
		.replace(/</g, '%3C')
		.replace(/>/g, '%3E');
	return `data:image/svg+xml,${svg}`;
}

// ── v1 → v2 ────────────────────────────────────────────────────────────────

const hexOf = (color: string): string | null => {
	const hex = /^#([0-9a-f]{6})$/i.exec(color);
	if (hex) return hex[1].toLowerCase();
	const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color);
	if (!rgb) return null;
	return ((1 << 24) | (+rgb[1] << 16) | (+rgb[2] << 8) | +rgb[3]).toString(16).slice(1);
};
const attr = (frag: string, name: string): string | null =>
	new RegExp(`\\b${name}="([^"]*)"`).exec(frag)?.[1] ?? null;
const nums = (s: string): number[] => s.trim().split(/[\s,]+/).map((v) => Math.round(Number(v)));

/** One v1 fragment → [v2 entry, alpha], or null when it is not a shape we know. */
function encodeFragment(frag: string): [string, number] | null {
	const tag = /^<(\w+)/.exec(frag)?.[1];
	const fill = attr(frag, 'fill');
	const paint = fill && fill !== 'none' ? fill : attr(frag, 'stroke');
	const opacity = attr(frag, 'fill-opacity') ?? attr(frag, 'stroke-opacity') ?? '1';
	const hex = paint && hexOf(paint);
	if (!hex) return null;
	const alpha = Number(opacity);
	const entry = (kind: string, values: number[]) =>
		[`${kind}${values.join(',')},${hex}`, alpha] as [string, number];
	const a = (name: string) => Number(attr(frag, name));
	switch (tag) {
		case 'polygon':
			return entry('p', nums(attr(frag, 'points') ?? ''));
		case 'rect':
			return entry('r', [a('x'), a('y'), a('width'), a('height')]);
		case 'ellipse':
			return entry('e', [a('cx'), a('cy'), a('rx'), a('ry')]);
		case 'circle':
			return entry('c', [a('cx'), a('cy'), a('r')]);
		case 'line':
			return entry('l', [a('x1'), a('y1'), a('x2'), a('y2')]);
		case 'path': {
			const m = /^M\s*([\d.-]+)[\s,]+([\d.-]+)\s*Q\s*([\d.-]+)[\s,]+([\d.-]+)[\s,]+([\d.-]+)[\s,]+([\d.-]+)$/.exec(attr(frag, 'd') ?? '');
			return m ? entry('q', nums(m.slice(1).join(' '))) : null;
		}
		case 'g': {
			// v1 rotated ellipse: <g transform="translate(x y) rotate(a) scale(rx ry)"><ellipse cx="0" cy="0" rx="1" ry="1" …/></g>
			const t = /translate\(([\d.-]+)\s+([\d.-]+)\)\s*rotate\(([\d.-]+)\)\s*scale\(([\d.-]+)\s+([\d.-]+)\)/.exec(attr(frag, 'transform') ?? '');
			return t ? entry('E', nums(`${t[1]} ${t[2]} ${t[4]} ${t[5]} ${t[3]}`)) : null;
		}
		default:
			return null;
	}
}

/**
 * Re-encodes a v1 placeholder in the v2 format (about a third of the bytes),
 * for migrating stored placeholders without re-fitting. Returns the input
 * unchanged when it is already v2, or when a fragment is not one the fitter
 * produces (hand-edited markup, several opacities) — nothing is ever lost.
 */
export function compactPlaceholder(placeholder: GeometrizePlaceholder): GeometrizePlaceholder {
	if (placeholder.v !== 1) return placeholder;
	const entries: string[] = [];
	let alpha: number | undefined;
	for (const frag of placeholder.s) {
		const encoded = encodeFragment(frag);
		if (!encoded) return placeholder;
		if (alpha === undefined) alpha = encoded[1];
		else if (alpha !== encoded[1]) return placeholder;
		entries.push(encoded[0]);
	}
	const { s: _s, ...rest } = placeholder;
	const v2: GeometrizePlaceholderV2 = { ...rest, v: 2, a: alpha ?? 1, s: entries.join(';') };
	return v2;
}
