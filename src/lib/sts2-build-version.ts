// Builds at or above this version are guaranteed bit-exact replay against
// our generator. Measured 2026-04-30 across 244 runs (v0.98.0–v0.104.0):
// v0.102.0+ scored 100% OK with no AMBIG; v0.101.0 was 86%; v0.98–v0.99
// were essentially unreproducible.
export const MIN_SUPPORTED_BUILD = "v0.102.0";

function parseBuild(build: string): number[] {
  return build
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareBuild(a: string, b: string): number {
  const av = parseBuild(a);
  const bv = parseBuild(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i += 1) {
    const x = av[i] ?? 0;
    const y = bv[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export function isBuildSupported(build: string): boolean {
  if (!build || build === "unknown") return false;
  return compareBuild(build, MIN_SUPPORTED_BUILD) >= 0;
}
