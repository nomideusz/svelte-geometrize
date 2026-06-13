import type { GeometrizePlaceholder } from './types.js';

/**
 * Serializes a placeholder to a standalone SVG string — useful for SSR,
 * emails, og-images, or a CSS background via data URI. No geometrize
 * dependency: safe to import in the browser.
 */
export function placeholderToSvg(placeholder: GeometrizePlaceholder): string {
	const { fw, fh, bg, s } = placeholder;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fw} ${fh}">` +
		`<rect width="${fw}" height="${fh}" fill="${bg}"/>` +
		s.join('') +
		`</svg>`
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
