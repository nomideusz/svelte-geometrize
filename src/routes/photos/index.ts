// Demo photos: Unsplash License, fetched through picsum.photos, credited on the page.
// (No 'jellyfish' in a URL: ad blockers drop it, after an ad network of that name.)
// Each one's placeholder is fitted at build time by the package's own Vite plugin.
import type { GeometrizePlaceholder, GeometrizePreset } from '#lib/index.js';
import fjord from './fjord.webp';
import fjordShapes from './fjord.webp?geometrize';
import medusa from './medusa.webp';
import medusaShapes from './medusa.webp?geometrize';
import lioness from './lioness.webp';
import lionessShapes from './lioness.webp?geometrize';
import strawberries from './strawberries.webp';
import strawberriesShapes from './strawberries.webp?geometrize';
import waterfall from './waterfall.webp';
import waterfallShapes from './waterfall.webp?geometrize';
import puppy from './puppy.webp';
import puppyShapes from './puppy.webp?geometrize';
import lowPoly from './medusa.webp?preset=low-poly&geometrize';
import soft from './medusa.webp?preset=soft&geometrize';
import mosaic from './medusa.webp?preset=mosaic&geometrize';
import bubbles from './medusa.webp?preset=bubbles&geometrize';

export interface DemoPhoto {
	src: string;
	placeholder: GeometrizePlaceholder;
	alt: string;
	by: string;
	href: string;
}

export const PHOTOS: DemoPhoto[] = [
	{ src: medusa, placeholder: medusaShapes, alt: 'An orange jellyfish in deep blue water', by: 'Marat Gilyadzinov', href: 'https://unsplash.com/photos/wpTWYBll4_w' },
	{ src: fjord, placeholder: fjordShapes, alt: 'A fjord seen from a granite cliff', by: 'Alexey Topolyanskiy', href: 'https://unsplash.com/photos/-oWyJoSqBRM' },
	{ src: lioness, placeholder: lionessShapes, alt: 'A lioness looking into the camera', by: 'Samuel Scrimshaw', href: 'https://unsplash.com/photos/sseiVD2XsOk' },
	{ src: strawberries, placeholder: strawberriesShapes, alt: 'Strawberries packed in a crate', by: 'veeterzy', href: 'https://unsplash.com/photos/OJJIaFZOeX4' },
	{ src: waterfall, placeholder: waterfallShapes, alt: 'A waterfall dropping into a green gorge', by: 'Andrew Coelho', href: 'https://unsplash.com/photos/VB-w_3dnyvI' },
	{ src: puppy, placeholder: puppyShapes, alt: 'A black puppy on wooden planks', by: 'André Spieker', href: 'https://unsplash.com/photos/8wTPqxlnKM4' }
];

/** The jellyfish in every preset — `triangles` is the default fit above. */
export const STYLES: { preset: GeometrizePreset; placeholder: GeometrizePlaceholder }[] = [
	{ preset: 'triangles', placeholder: medusaShapes },
	{ preset: 'low-poly', placeholder: lowPoly },
	{ preset: 'soft', placeholder: soft },
	{ preset: 'mosaic', placeholder: mosaic },
	{ preset: 'bubbles', placeholder: bubbles }
];
