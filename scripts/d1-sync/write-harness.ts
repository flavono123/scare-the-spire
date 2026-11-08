/**
 * Shared harness for the step 5 specs: a token signer, a fake Supabase (JWKS plus a recorder for the
 * mirror's REST calls), the Worker env on a local SQLite D1, and request helpers that go through the
 * real main Worker and /api router.
 */
import { WRITE_GROUPS, sourceFlagKey } from "../../src/lib/write-source-flags";
import { API_SURFACE_GROUPS, pathFlagKey } from "../../src/lib/api-surfaces";
import { resetFlagsForTest } from "../../workers/api/flags";
import { resetJwtCachesForTest } from "../../workers/api/jwt";
import { resetWriteGateForTest } from "../../workers/api/d1-write/gate";
import mainWorker from "../../workers/main-worker";
import { SqliteD1 } from "./sqlite-d1";

export const ORIGIN = "https://testbed.example.workers.dev";
export const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";
export const ISSUER = `${PROJECT}/auth/v1`;
export const USER = "4f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f";
export const OTHER = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const segment = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

export async function makeSigner() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const jwks = { keys: [{ kty: "EC", crv: "P-256", alg: "ES256", use: "sig", kid: "spec-kid", x: publicJwk.x, y: publicJwk.y }] };
  async function token(sub = USER) {
    const now = Math.floor(Date.now() / 1000);
    const input = `${segment({ alg: "ES256", kid: "spec-kid", typ: "JWT" })}.${segment({
      iss: ISSUER, sub, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now, is_anonymous: true,
    })}`;
    const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(input)));
    return `${input}.${base64Url(signature)}`;
  }
  return { jwks, token };
}

export type RecordedCall = { method: string; url: URL; headers: Headers; body: string };

/** Supabase as the mirror and the step 1 handlers see it: JWKS, and every REST call recorded. */
export class FakeSupabase {
  jwks: unknown = { keys: [] };
  calls: RecordedCall[] = [];
  /** Answer for the next REST calls, in order; empty -> 201 (POST) or 204. */
  answers: Array<{ status: number; code?: string }> = [];
  /** Tables (or rpc/<fn>) that always fail with this answer. */
  failing = new Map<string, { status: number; code?: string }>();

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/auth/v1/.well-known/jwks.json") return Response.json(this.jwks);
    const body = request.method === "GET" || request.method === "HEAD" ? "" : await request.text();
    this.calls.push({ method: request.method, url, headers: request.headers, body });
    const name = url.pathname.replace("/rest/v1/", "");
    const answer = this.failing.get(name) ?? this.answers.shift();
    if (answer) {
      return new Response(JSON.stringify({ code: answer.code ?? `http_${answer.status}` }), { status: answer.status, headers: { "content-type": "application/json" } });
    }
    if (request.method === "GET") return Response.json([]);
    return new Response(null, { status: request.method === "POST" ? 201 : 204 });
  }

  restCalls(): RecordedCall[] {
    return this.calls.filter((entry) => entry.url.pathname.startsWith("/rest/v1/"));
  }
}

export class Ctx {
  pending: Promise<unknown>[] = [];
  waitUntil(promise: Promise<unknown>) {
    this.pending.push(promise);
  }
  async drain() {
    while (this.pending.length) await Promise.allSettled(this.pending.splice(0));
  }
}

export type Harness = Awaited<ReturnType<typeof setupHarness>>;

export async function setupHarness(options: { dataEnv?: "production" | "development"; serviceKey?: boolean; source?: "d1" | "supabase" } = {}) {
  const supabase = new FakeSupabase();
  const signer = await makeSigner();
  supabase.jwks = signer.jwks;
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => supabase.handle(new Request(input, init))) as typeof fetch;
  resetFlagsForTest();
  resetJwtCachesForTest();
  resetWriteGateForTest();
  const db = new SqliteD1();
  const at = new Date().toISOString();
  for (const group of API_SURFACE_GROUPS) {
    db.run("INSERT INTO runtime_flags (key, value, updated_at) VALUES (?1, 'api', ?2)", pathFlagKey(group), at);
  }
  for (const group of WRITE_GROUPS) {
    db.run("INSERT INTO runtime_flags (key, value, updated_at) VALUES (?1, ?2, ?3)", sourceFlagKey(group), options.source ?? "d1", at);
  }
  const env: Record<string, unknown> = {
    API_RUNTIME_FLAGS: "d1",
    API_SUPABASE_URL: PROJECT,
    API_SUPABASE_KEY: "sb_publishable_test",
    API_DATA_ENV: options.dataEnv ?? "development",
    DB: db,
    ASSETS: { fetch: async () => new Response("asset") },
    PATCH_WORKER: { fetch: async () => new Response("patch") },
  };
  if (options.serviceKey) env.API_SUPABASE_SERVICE_KEY = "sb_secret_test";
  const ctx = new Ctx();
  const tokens: Record<string, string> = { [USER]: await signer.token(USER), [OTHER]: await signer.token(OTHER) };

  async function call(path: string, init: { method?: string; body?: unknown; raw?: string; as?: string | null; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { ...(init.headers ?? {}) };
    const as = init.as === undefined ? USER : init.as;
    if (as) headers.authorization = `Bearer ${tokens[as]}`;
    let body: string | undefined;
    if (init.raw !== undefined) {
      body = init.raw;
      headers["content-type"] ??= "application/json";
      headers["content-length"] = String(new TextEncoder().encode(body).byteLength);
    } else if (init.body !== undefined) {
      body = JSON.stringify(init.body);
      headers["content-type"] = "application/json";
      headers["content-length"] = String(new TextEncoder().encode(body).byteLength);
    }
    const response = await mainWorker.fetch(new Request(`${ORIGIN}${path}`, { method: init.method ?? "GET", headers, body }), env as never, ctx as never);
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: response.status, json: json as Record<string, unknown> & unknown[], headers: response.headers, text };
  }

  function setFlag(key: string, value: string | null) {
    if (value === null) db.run("DELETE FROM runtime_flags WHERE key = ?1", key);
    else db.run("INSERT INTO runtime_flags (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT (key) DO UPDATE SET value = excluded.value", key, value, at);
    resetFlagsForTest();
    resetWriteGateForTest();
  }

  type OutboxView = { seq: number; table_name: string; op: string; match: Record<string, unknown>; payload: Record<string, unknown> | null };
  function outbox(): OutboxView[] {
    return db.rows("SELECT seq, table_name, op, match_key, payload FROM outbox ORDER BY seq").map((row) => ({
      seq: Number(row.seq),
      table_name: String(row.table_name),
      op: String(row.op),
      match: JSON.parse(String(row.match_key)) as Record<string, unknown>,
      payload: row.payload === null ? null : (JSON.parse(String(row.payload)) as Record<string, unknown>),
    }));
  }

  return { supabase, db, env, ctx, call, setFlag, outbox, tokens };
}
