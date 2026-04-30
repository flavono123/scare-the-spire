import type { ReplayRun } from "./sts2-run-replay";

const CROCKFORD = "0123456789abcdefghjkmnpqrstvwxyz";

// Bump when the identity key shape (which fields, what order, what
// separator) changes. Old slugs keep working because we dispatch to
// the matching key builder by version. The version digit is the first
// character of every slug — never reuse a digit.
export const HASH_VERSION = 1;

// Body length after the 1-char version prefix. 15 base32 chars ≈
// 75 bits of entropy — ample for content-addressable identity.
const HASH_BODY_LENGTH = 15;

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

export async function computeRunHash(run: ReplayRun): Promise<string> {
  return sha256Base32(runIdentityKeyV1(run), HASH_BODY_LENGTH);
}

// Slug shape: <hashVer><hash> — single opaque content-addressable id.
// Example: "1a3f9c1d2k5n7m4q" (16 chars). Seed/build are recoverable
// from the run record stored under this id, not from the URL itself.
export function runRouteSlug(hash: string): string {
  return `${HASH_VERSION}${hash}`;
}

export interface ParsedRunSlug {
  hashVersion: number;
  hash: string;
}

export function parseRunRouteSlug(slug: string): ParsedRunSlug | null {
  if (!slug || slug.length < 2) return null;
  const hashVersion = Number.parseInt(slug[0], 10);
  if (!Number.isFinite(hashVersion) || hashVersion < 1) return null;
  const hash = slug.slice(1);
  if (!/^[0-9a-z]+$/.test(hash)) return null;
  return { hashVersion, hash };
}
