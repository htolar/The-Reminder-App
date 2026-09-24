/**
 * Small, dependency-free math helpers shared by the canvas background.
 */

/** Clamp `value` to the inclusive range [min, max]. */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Linear interpolation between `start` and `end`. `t` is clamped to [0, 1]. */
export function lerp(start, end, t) {
  return start + (end - start) * clamp(t, 0, 1);
}

/** A random float in the range [min, max). */
export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

/** Remap `value` from the [inMin, inMax] range to the [outMin, outMax] range. */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}