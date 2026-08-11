/// <reference types="@sveltejs/kit" />

declare module '*?geometrize' {
	const placeholder: import('$lib/core/types.js').GeometrizePlaceholder;
	export default placeholder;
}

declare module '*&geometrize' {
	const placeholder: import('$lib/core/types.js').GeometrizePlaceholder;
	export default placeholder;
}
