import type { ReplayRun } from "./sts2-run-replay";

const CROCKFORD = "0123456789abcdefghjkmnpqrstvwxyz";

function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += CROCKFORD[(value >> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    result += CROCKFORD[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

// A run is uniquely keyed by (seed, build, start_time, character) — a single
// player can't start two runs at the same wall-clock second with the same
// seed and character. We hash that compact key rather than the whole file,
// so trivial whitespace re-saves don't change the hash.
function runIdentityKey(run: ReplayRun): string {
  return [
    run.seed,
    run.build_id,
    String(run.start_time ?? 0),
    String(run.run_time ?? 0),
    String(run.acts.length),
    run.players[0]?.character ?? "",
  ].join("|");
}

export async function computeRunHash(run: ReplayRun, length = 10): Promise<string> {
  const data = new TextEncoder().encode(runIdentityKey(run));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToBase32(new Uint8Array(digest)).slice(0, length);
}

export function runRouteSlug(seed: string, hash: string): string {
  return `${seed}-${hash}`;
}
