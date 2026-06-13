declare module '*?geometrize' {
	const placeholder: import('$lib/core/types.js').GeometrizePlaceholder;
	export default placeholder;
}

// with query params, put `geometrize` last: ./photo.jpg?shapes=70&geometrize
declare module '*&geometrize' {
	const placeholder: import('$lib/core/types.js').GeometrizePlaceholder;
	export default placeholder;
}
