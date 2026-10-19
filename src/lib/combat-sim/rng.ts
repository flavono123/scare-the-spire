/** mulberry32: a tiny seeded RNG whose whole state is one uint32, so it can live in plain state. */
export function seedRandom(seed: number): number {
  return (Math.trunc(seed) ^ 0x9e3779b9) >>> 0;
}

/** Returns [value in [0, 1), next state]. */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}
