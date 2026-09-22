export function setupCanvas(canvas) {
	const context = canvas.getContext('2d');

	if (!context) {
		throw new Error('Canvas 2D context is unavailable.');
	}

	function resize() {
		const pixelRatio = window.devicePixelRatio || 1;
		const bounds = canvas.getBoundingClientRect();

		canvas.width = Math.max(1, Math.round(bounds.width * pixelRatio));
		canvas.height = Math.max(1, Math.round(bounds.height * pixelRatio));
		context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

		return { width: bounds.width, height: bounds.height };
	}

	return { canvas, context, resize };
}
