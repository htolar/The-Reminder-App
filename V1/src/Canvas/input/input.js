'use strict';
/**
 * Tracks pointer position on `target` (defaults to window) and exposes it
 * as a small mutable state object, normalized to [0, 1] across the viewport.
 * Useful for subtle parallax effects on the canvas background.
 *
 * @param {EventTarget} [target=window]
 * @returns {{
 *   x: number,
 *   y: number,
 *   normalizedX: number,
 *   normalizedY: number,
 *   isDown: boolean,
 *   destroy: () => void,
 * }}
 */
function setupInput(target = window) {
  const pointer = {
    x: 0,
    y: 0,
    normalizedX: 0.5,
    normalizedY: 0.5,
    isDown: false,
  };

  function updateFromEvent(event) {
    const point = 'touches' in event && event.touches.length ? event.touches[0] : event;
    pointer.x = point.clientX;
    pointer.y = point.clientY;
    pointer.normalizedX = clamp(point.clientX / window.innerWidth, 0, 1);
    pointer.normalizedY = clamp(point.clientY / window.innerHeight, 0, 1);
  }

  function handlePointerDown() {
    pointer.isDown = true;
  }

  function handlePointerUp() {
    pointer.isDown = false;
  }

  function handlePointerLeave() {
    // Drift back to center so the effect doesn't freeze off-screen.
    pointer.normalizedX = 0.5;
    pointer.normalizedY = 0.5;
  }

  target.addEventListener('pointermove', updateFromEvent, { passive: true });
  target.addEventListener('pointerdown', handlePointerDown, { passive: true });
  target.addEventListener('pointerup', handlePointerUp, { passive: true });
  target.addEventListener('pointerleave', handlePointerLeave, { passive: true });

  pointer.destroy = function destroy() {
    target.removeEventListener('pointermove', updateFromEvent);
    target.removeEventListener('pointerdown', handlePointerDown);
    target.removeEventListener('pointerup', handlePointerUp);
    target.removeEventListener('pointerleave', handlePointerLeave);
  };

  return pointer;
}