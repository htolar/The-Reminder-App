/**
 * Prepares a <canvas> element for crisp rendering on high-DPI screens and
 * keeps it sized to the viewport.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{
 *   canvas: HTMLCanvasElement,
 *   context: CanvasRenderingContext2D,
 *   resize: () => { width: number, height: number },
 * }}
 */
export function setupCanvas(canvas) {
  const context = canvas.getContext('2d');

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const displayWidth = Math.round(width * dpr);
    const displayHeight = Math.round(height * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    return { width, height };
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  return { canvas, context, resize };
}