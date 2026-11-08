import { withTimeout, type D1Database } from "./d1";
import type { ExecutionContextLike } from "./flags";
import { PINNED_SUPABASE_JWKS, type SupabaseJwk } from "./supabase-jwks";

/**
 * The Supabase token signing keys the Worker trusts, with revocation (docs/supabase-exit/STEP1_DESIGN.md 6:
 * before the Worker is the only verifier in step 4, the key list moves to D1 with a way to revoke).
 *
 * D1 `api_verification_keys` (d1/migrations/0007) sits on top of the compiled-in key list
 * (supabase-jwks.ts), which is the seed:
 * - a compiled-in key counts unless a row with its kid says otherwise;
 * - a row without `revoked_at` adds its key;
 * - a row with `revoked_at` refuses that kid, even while Supabase's live JWKS still lists it.
 * With the table empty or never read (cold isolate whose read failed) the compiled-in keys alone
 * count and nothing is revoked: exactly the step 1 behavior. A failed read keeps the last good one.
 *
 * One statement (K1) per isolate per minute at most, whatever the outcome: requests that need a key
 * while a read is in flight wait for it up to KEYS_WAIT_MS, then use what the isolate has.
 * Change rows only with scripts/verification-keys.ts.
 */

export const VERIFICATION_KEYS_SQL = "SELECT kid, x, y, revoked_at FROM api_verification_keys";
export const KEYS_READ_INTERVAL_MS = 60_000;
export const KEYS_WAIT_MS = 1_000;

export type VerificationKeys = {
  /** Keys to try before the live JWKS (jwt.ts `pinnedKeys`). */
  pinned: readonly SupabaseJwk[];
  /** Kids refused outright (jwt.ts `revokedKids`). */
  revoked: ReadonlySet<string>;
};

type KeyRow = { kid?: unknown; x?: unknown; y?: unknown; revoked_at?: unknown };

const COORDINATE = /^[A-Za-z0-9_-]{43}$/;

let rows: readonly KeyRow[] | null = null;
let lastAttemptAt = -Infinity;
let inFlight: Promise<void> | null = null;
let generation = 0;

export function resetVerificationKeysForTest(): void {
  rows = null;
  lastAttemptAt = -Infinity;
  inFlight = null;
  generation += 1;
}

/** The effective key set of one read (null: no read yet, the compiled-in keys alone). */
export function effectiveKeys(
  readRows: readonly KeyRow[] | null,
  compiled: readonly SupabaseJwk[] = PINNED_SUPABASE_JWKS,
): VerificationKeys {
  if (!readRows || readRows.length === 0) return { pinned: compiled, revoked: new Set() };
  const known = new Set<string>();
  const revoked = new Set<string>();
  const added: SupabaseJwk[] = [];
  for (const row of readRows) {
    if (typeof row.kid !== "string" || row.kid.length === 0) continue;
    known.add(row.kid);
    if (row.revoked_at !== null && row.revoked_at !== undefined) {
      revoked.add(row.kid);
      continue;
    }
    // The table's CHECKs hold these; a row that does not fit is skipped, never trusted.
    if (typeof row.x !== "string" || typeof row.y !== "string" || !COORDINATE.test(row.x) || !COORDINATE.test(row.y)) continue;
    added.push({ kty: "EC", crv: "P-256", alg: "ES256", kid: row.kid, x: row.x, y: row.y });
  }
  return { pinned: [...added, ...compiled.filter((key) => !known.has(key.kid))], revoked };
}

/**
 * The key set for a token check. Reads D1 when the last attempt is a minute old (waiting at most
 * KEYS_WAIT_MS); without a binding, the compiled-in keys.
 */
export async function verificationKeys(
  env: { DB?: D1Database },
  ctx: ExecutionContextLike,
  now = Date.now(),
): Promise<VerificationKeys> {
  const db = env.DB;
  // The minute between attempts also bounds a read that never settles (its request was cancelled).
  if (db && now - lastAttemptAt >= KEYS_READ_INTERVAL_MS) {
    lastAttemptAt = now;
    const mine = ++generation;
    const read = (async () => {
      try {
        const result = await db.prepare(VERIFICATION_KEYS_SQL).all<KeyRow>();
        if (mine === generation) rows = result.results ?? [];
      } catch {
        // Keep the last good read (or the compiled-in keys); the next attempt is a minute away.
      } finally {
        if (mine === generation) inFlight = null;
      }
    })();
    inFlight = read;
    ctx.waitUntil(read);
  }
  // Only the first KEYS_WAIT_MS of a read are worth waiting for; later requests use what is here.
  const waited = now - lastAttemptAt;
  if (inFlight && waited < KEYS_WAIT_MS) await withTimeout(inFlight, KEYS_WAIT_MS - waited).catch(() => undefined);
  return effectiveKeys(rows);
}
