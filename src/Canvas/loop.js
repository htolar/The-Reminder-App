export function startRenderLoop(render) {
	let frameId;

	function frame(time) {
		render(time);
		frameId = window.requestAnimationFrame(frame);
	}

	frameId = window.requestAnimationFrame(frame);

	return function stopRenderLoop() {
		window.cancelAnimationFrame(frameId);
	};
}
