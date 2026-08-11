declare module '*?geometrize' {
	const placeholder: import('@nomideusz/svelte-geometrize').GeometrizePlaceholder;
	export default placeholder;
}

// when combining with query params, put `geometrize` last:
// ./photo.jpg?shapes=70&geometrize
declare module '*&geometrize' {
	const placeholder: import('@nomideusz/svelte-geometrize').GeometrizePlaceholder;
	export default placeholder;
}

export {};
