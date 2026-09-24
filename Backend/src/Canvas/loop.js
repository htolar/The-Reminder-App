/**
 * Starts a requestAnimationFrame render loop.
 *
 * @param {(time: number, deltaTime: number) => void} callback
 *   Called every frame with the current high-resolution timestamp (ms)
 *   and the time elapsed since the previous frame (ms).
 * @returns {() => void} A function that stops the loop when called.
 */
export function startRenderLoop(callback) {
  let frameId = null;
  let previousTime = performance.now();

  function tick(time) {
    const deltaTime = time - previousTime;
    previousTime = time;

    callback(time, deltaTime);

    frameId = window.requestAnimationFrame(tick);
  }

  frameId = window.requestAnimationFrame(tick);

  return function stopRenderLoop() {
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
      frameId = null;
    }
  };
}
