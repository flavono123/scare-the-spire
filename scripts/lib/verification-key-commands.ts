/**
 * What scripts/verification-keys.ts sends to D1, kept apart from the script (which runs wrangler)
 * so specs can check it. The statements are queries.sql K2-K5 bound as literals, because
 * `wrangler d1 execute --command` takes no parameters.
 */
import type { SupabaseJwk } from "../../workers/api/supabase-jwks";

export const KEY_SQL = {
  list: "SELECT kid, alg, x, y, added_at, revoked_at, note FROM api_verification_keys ORDER BY kid",
  add: "INSERT INTO api_verification_keys (kid, alg, x, y, added_at, note) VALUES (?1, 'ES256', ?2, ?3, ?4, ?5)",
  revoke:
    "INSERT INTO api_verification_keys (kid, x, y, added_at, revoked_at, note) VALUES (?1, ?2, ?3, ?4, ?4, ?5)\n" +
    "ON CONFLICT (kid) DO UPDATE SET revoked_at = excluded.revoked_at, note = excluded.note WHERE api_verification_keys.revoked_at IS NULL",
  unrevokeBare: "DELETE FROM api_verification_keys WHERE kid = ?1 AND revoked_at IS NOT NULL AND x IS NULL",
  unrevoke: "UPDATE api_verification_keys SET revoked_at = NULL, note = ?2 WHERE kid = ?1 AND revoked_at IS NOT NULL AND x IS NOT NULL",
  one: "SELECT kid, alg, x, y, added_at, revoked_at, note FROM api_verification_keys WHERE kid = ?1",
} as const;

const COORDINATE = /^[A-Za-z0-9_-]{43}$/;
const KID = /^[\x21-\x7e]{1,128}$/;

function literal(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`not an integer: ${value}`);
    return String(value);
  }
  return `'${value.replace(/'/g, "''")}'`;
}

/** `?N` placeholders replaced by SQL literals of `params[N - 1]`. */
export function bindLiterals(sql: string, params: readonly (string | number | null)[]): string {
  return sql.replace(/\?(\d+)/g, (_match, index: string) => {
    const position = Number(index) - 1;
    if (position < 0 || position >= params.length) throw new Error(`no parameter ?${index}`);
    return literal(params[position]);
  });
}

export function cleanNote(note: string | undefined): string {
  return (note ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
}

export function validKid(kid: string | undefined): kid is string {
  return typeof kid === "string" && KID.test(kid);
}

/** A JWK from Supabase's JWKS (`--jwk '<json>'`), or a reason it cannot be trusted. */
export function parseJwkArgument(text: string | undefined): { ok: true; key: SupabaseJwk } | { ok: false; message: string } {
  let value: unknown;
  try {
    value = JSON.parse(text ?? "");
  } catch {
    return { ok: false, message: "--jwk must be one key of the JWKS as JSON" };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, message: "--jwk must be a JSON object" };
  const key = value as Record<string, unknown>;
  if (key.kty !== "EC" || key.crv !== "P-256") return { ok: false, message: "only EC P-256 keys (ES256) are verified" };
  if (key.alg !== undefined && key.alg !== "ES256") return { ok: false, message: "alg must be ES256" };
  if (key.use !== undefined && key.use !== "sig") return { ok: false, message: "use must be sig" };
  if (typeof key.kid !== "string" || !validKid(key.kid)) return { ok: false, message: "kid must be 1-128 printable characters" };
  if (typeof key.x !== "string" || typeof key.y !== "string" || !COORDINATE.test(key.x) || !COORDINATE.test(key.y)) {
    return { ok: false, message: "x and y must be 43 base64url characters (P-256)" };
  }
  if ("d" in key) return { ok: false, message: "that is a private key: pass the public JWK only" };
  return { ok: true, key: { kty: "EC", crv: "P-256", alg: "ES256", kid: key.kid, x: key.x, y: key.y } };
}

/** The statements of `add`. */
export function addStatements(key: SupabaseJwk, note: string, now: number): string[] {
  return [bindLiterals(KEY_SQL.add, [key.kid, key.x, key.y, now, note])];
}

/**
 * The statements of `revoke`. A kid not in the table yet gets a row: with the coordinates of the
 * compiled-in key of that kid, or none (a key only the live JWKS had).
 */
export function revokeStatements(kid: string, note: string, now: number, compiled: readonly SupabaseJwk[]): string[] {
  const seed = compiled.find((key) => key.kid === kid);
  return [bindLiterals(KEY_SQL.revoke, [kid, seed?.x ?? null, seed?.y ?? null, now, note])];
}

/** The statements of `unrevoke` (the rollback of a revoke). */
export function unrevokeStatements(kid: string, note: string): string[] {
  return [bindLiterals(KEY_SQL.unrevokeBare, [kid]), bindLiterals(KEY_SQL.unrevoke, [kid, note])];
}
