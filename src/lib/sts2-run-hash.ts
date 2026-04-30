import type { ReplayRun } from "./sts2-run-replay";

const CROCKFORD = "0123456789abcdefghjkmnpqrstvwxyz";

// Bump when the identity key shape (which fields, what order, what
// separator) changes. Old slugs keep working because we dispatch to
// the matching key builder by version. Embedding the version in the
// URL is part of the public contract — never reuse a digit.
export const HASH_VERSION = 1;

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

// v1: seed|build|start_time|run_time|acts|character. start_time alone
// disambiguates two attempts at the same seed by the same player.
function runIdentityKeyV1(run: ReplayRun): string {
  return [
    run.seed,
    run.build_id,
    String(run.start_time ?? 0),
    String(run.run_time ?? 0),
    String(run.acts.length),
    run.players[0]?.character ?? "",
  ].join("|");
}

async function sha256Base32(input: string, length: number): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToBase32(new Uint8Array(digest)).slice(0, length);
}

export async function computeRunHash(
  run: ReplayRun,
  length = 10,
): Promise<string> {
  return sha256Base32(runIdentityKeyV1(run), length);
}

// Build segment is normalised to alphanumeric + dot only. Game writes
// "v0.103.0", "v0.103.2", etc.; defensively strip anything else so a
// future "-rc1" suffix can't break the dash split.
function buildSegment(build: string): string {
  const safe = (build || "unknown").replace(/[^a-zA-Z0-9.]/g, "_");
  return safe || "unknown";
}

export interface ParsedRunSlug {
  seed: string;
  build: string;
  hashVersion: number;
  hash: string;
}

// Slug shape: <seed>-<build>-<hashVer>-<hash>
//   PE82XCX32D-v0.103.0-1-a3f9c1d2k
// seeds are uppercase alphanumeric (no dashes), build segment is
// alphanumeric+dots after sanitisation, hashVer is a digit, hash is
// base32 alphanumeric — so split('-') always yields 4 parts.
export function runRouteSlug(run: ReplayRun, hash: string): string {
  return `${run.seed}-${buildSegment(run.build_id)}-${HASH_VERSION}-${hash}`;
}

export function parseRunRouteSlug(slug: string): ParsedRunSlug | null {
  const parts = slug.split("-");
  if (parts.length !== 4) return null;
  const [seed, build, ver, hash] = parts;
  if (!seed || !build || !ver || !hash) return null;
  const hashVersion = Number.parseInt(ver, 10);
  if (!Number.isFinite(hashVersion) || hashVersion < 1) return null;
  return { seed, build, hashVersion, hash };
}
