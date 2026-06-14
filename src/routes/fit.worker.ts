// Runs the exact same fitter as the build-time Vite plugin, but off the main
// thread so dragging sliders / uploading photos never janks the UI. geometrizejs
// is pure JS (no Node deps), so fitShapes runs unchanged in a worker — only the
// RGBA decoding differs (canvas here vs. sharp at build time).
import { fitShapes } from '$lib/core/fit.js';
import type { GeometrizeOptions, GeometrizePlaceholder } from '$lib/core/types.js';

interface FitRequest {
	token: number;
	rgba: Uint8ClampedArray;
	w: number;
	h: number;
	sw: number;
	sh: number;
	options: GeometrizeOptions;
}

type FitResponse =
	| { token: number; ok: true; placeholder: GeometrizePlaceholder }
	| { token: number; ok: false; error: string };

const ctx = self as unknown as {
	onmessage: ((e: MessageEvent<FitRequest>) => void) | null;
	postMessage: (message: FitResponse) => void;
};

ctx.onmessage = (e) => {
	const { token, rgba, w, h, sw, sh, options } = e.data;
	try {
		const placeholder = fitShapes(rgba, w, h, sw, sh, options);
		ctx.postMessage({ token, ok: true, placeholder });
	} catch (err) {
		ctx.postMessage({ token, ok: false, error: err instanceof Error ? err.message : String(err) });
	}
};
