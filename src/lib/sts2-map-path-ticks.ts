/**
 * Map path geometry shared by the history course map and the map progress bar
 * simulator: a stable per-string jitter and the dotted path between two map
 * points, in the map's own (game) units.
 */

export interface MapTickPoint {
  left: number;
  top: number;
  /** Radians; the dot texture points along the path. */
  rotation: number;
}

/** Game units between two path dots. */
export const PATH_TICK_SPACING = 22;

export function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function stableSigned(value: string, magnitude: number) {
  return ((stableHash(value) / 4294967295) * 2 - 1) * magnitude;
}

/**
 * Dots from `start` toward `end` every PATH_TICK_SPACING, excluding both
 * endpoints, each nudged by a stable jitter keyed on `edgeId`.
 */
export function pathTickPoints(
  edgeId: string,
  start: { left: number; top: number },
  end: { left: number; top: number },
): MapTickPoint[] {
  const dx = end.left - start.left;
  const dy = end.top - start.top;
  const length = Math.sqrt(dx * dx + dy * dy);
  const spacing = PATH_TICK_SPACING;
  const count = Math.floor(length / spacing) + 1;
  const unitX = length === 0 ? 0 : dx / length;
  const unitY = length === 0 ? 0 : dy / length;
  const baseRotation = Math.atan2(dy, dx) + Math.PI / 2;

  return Array.from({ length: Math.max(0, count - 1) }, (_, index) => {
    const step = index + 1;
    return {
      left: start.left + unitX * spacing * step + stableSigned(`${edgeId}:${step}:x`, 3),
      top: start.top + unitY * spacing * step + stableSigned(`${edgeId}:${step}:y`, 3),
      rotation: baseRotation + stableSigned(`${edgeId}:${step}:r`, 0.1),
    };
  });
}
