/**
 * Step 4 write gate equivalence (docs/supabase-exit/STEP4_WRITE_GATE.md 6). Two PGlite databases are
 * built from the repo's supabase SQL: "today" (every migration but the unapplied change log and the
 * step 4 migration) and "step 4" (with 20261108160000_worker_write_actor.sql). The same Worker serves
 * both: write.<group> = rls against today (the user's token, RLS, guard triggers, grants), and
 * write.<group> = worker against step 4 (the Worker's checks, then the service key). Every case runs on
 * both and must give the same HTTP answer and leave the same rows in every written table. Gate-level
 * cases then send PostgREST writes no route builds (forged owners, privileges, missing policies).
 * Usage: tsx scripts/write-gate-equivalence.spec.ts
 * SUPABASE_PUBLIC_SCHEMA=<pg_dump --schema-only of public> runs the same cases on that dump's policies,
 * triggers, functions and grants instead (the dump plus the step 4 migration on the worker side).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { PGlite } from "@electric-sql/pglite";

import { API_SURFACE_GROUPS, pathFlagKey } from "../src/lib/api-surfaces";
import type { D1Database, D1PreparedStatement, D1Result } from "../workers/api/d1";
import { FLAGS_SQL, resetFlagsForTest } from "../workers/api/flags";
import { resetJwtCachesForTest } from "../workers/api/jwt";
import { postgrest, type RestRequest, type SupabaseApiConfig } from "../workers/api/supabase-rest";
import { createWriteGate, withWriteGate } from "../workers/api/write-gate/gate";
import { resetWriteFlagsForTest, WRITE_FLAGS_SQL } from "../workers/api/write-flags";
import mainWorker from "../workers/main-worker";
import { PgRest, repoSchemaFiles, supabaseFromDump, supabaseFromRepo } from "./lib/supabase-pglite";

const ORIGIN = "https://testbed.example.workers.dev";
const TODAY_URL = "http://127.0.0.1:54321";
const STEP4_URL = "http://127.0.0.1:54322";
/** The step 4 database served in rls mode: browser roles and old tabs must see no change. */
const STEP4_RLS_URL = "http://127.0.0.1:54323";
const PUBLISHABLE = "sb_publishable_spec";
const SECRET = "sb_secret_spec";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";
const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const C1 = id("c1000000", 1);
const C2 = id("c1000000", 2);
const STORY1 = id("51000000", 1);
const STORY2 = id("51000000", 2);
const COMBO1 = id("a1000000", 1);
const COMBO2 = id("a1000000", 2);
const COMBO_NEW = id("a1000000", 3);
const TRANS1 = id("a2000000", 1);
const TRANS_NEW = id("a2000000", 3);
const TOT2 = id("70000000", 2);
const TOT_PROD = id("70000000", 9);
const TOT_NEW = id("70000000", 3);
const CHEM_NEW = id("a4000000", 3);
const DEC_NEW = id("a5000000", 3);
const FAV1 = id("f0000000", 1);
const FAV_NEW = id("f0000000", 3);
const PAGE1 = id("a7000000", 1);
const PAGE_NEW = id("a7000000", 3);
const DEFRAG_NEW = id("a8000000", 3);
const DRAFT1 = id("a9000000", 1);
const DRAFT2 = id("a9000000", 2);
const DRAFT_NEW = id("a9000000", 3);
const INQ1 = id("b1000000", 1);
const INQ2 = id("b1000000", 2);
const MISSING = id("ee000000", 1);
const KNOWN_IDS = new Set([U1, U2, U3, C1, C2, STORY1, STORY2, COMBO1, COMBO2, COMBO_NEW, TRANS1, TRANS_NEW, TOT2, TOT_PROD, TOT_NEW,
  CHEM_NEW, DEC_NEW, FAV1, FAV_NEW, PAGE1, PAGE_NEW, DEFRAG_NEW, DRAFT1, DRAFT2, DRAFT_NEW, INQ1, INQ2, MISSING]);

const POOL = [{ type: "card", id: "BASH" }, { type: "card", id: "STRIKE" }];
const SEED = `
insert into auth.users (id) values ('${U1}'), ('${U2}'), ('${U3}');
insert into public.comments (id, story_id, user_id, nickname, content, env) values
  ('${C1}', 'sts2-codex:card:BASH', '${U1}', '닉', 'mine', 'development'),
  ('${C2}', 'sts2-codex:card:BASH', '${U2}', '남', 'theirs', 'development');
insert into public.likes (story_id, user_id, env) values ('sts2-codex:card:BASH', '${U2}', 'development');
insert into public.resource_reactions (env, resource_type, resource_id, game_version, user_id, kind)
  values ('development', 'card', 'BASH', '0.1.0', '${U2}', 'buff');
insert into public.community_stories (id, user_id, nickname, sentence, env) values
  ('${STORY1}', '${U1}', '닉', 'my sentence', 'development'),
  ('${STORY2}', '${U2}', '남', 'their sentence', 'development');
insert into public.combo_posts (id, user_id, nickname, content, content_text, resources, env, like_count) values
  ('${COMBO1}', '${U1}', '닉', '[]', 'combo one', '${JSON.stringify(POOL)}', 'development', 3),
  ('${COMBO2}', '${U2}', '남', '[]', 'combo two', '${JSON.stringify(POOL)}', 'development', 4);
insert into public.transfigure_posts (id, user_id, nickname, resource_type, resource_id, source_text, source_game_locale, content, content_text, env)
  values ('${TRANS1}', '${U1}', '닉', 'card', 'BASH', 'src', 'kor', '[]', 'text', 'development');
insert into public.this_or_that_posts (id, user_id, nickname, left_type, left_id, right_type, right_id, reason, env) values
  ('${TOT2}', '${U2}', '남', 'card', 'BASH', 'card', 'STRIKE', 'a reason', 'development'),
  ('${TOT_PROD}', '${U2}', '남', 'card', 'BASH', 'card', 'STRIKE', 'a reason', 'production');
insert into public.favorite_tournament_posts (id, user_id, nickname, title, preset_key, game_version, pool, env)
  values ('${FAV1}', '${U2}', '남', 'cup', 'custom', '0.1', '${JSON.stringify(POOL)}', 'development');
insert into public.pagestorm_posts (id, user_id, nickname, title, content, content_text, env)
  values ('${PAGE1}', '${U1}', '닉', 'title', '{}', 'text', 'development');
insert into public.pagestorm_drafts (id, user_id, nickname, title, content, content_text, env) values
  ('${DRAFT1}', '${U1}', '닉', 'draft', '{}', 'text', 'development'),
  ('${DRAFT2}', '${U2}', '남', 'draft', '{}', 'text', 'development');
-- A body on U1's combo that U2 wrote (possible only before the source-owned policy): U1 may not take it over.
insert into public.defragment_bodies (env, source_service, source_id, user_id, nickname, content, content_text)
  values ('development', 'combo', '${COMBO1}', '${U2}', '남', '[]', 'their body');
insert into public.runs (id, raw, seed, build, "character", ascension, win, acts_count, donor_user_id, env, donor_nickname) values
  ('run-u1', '{}', 'S1', 'v0.1', 'IRONCLAD', 0, true, 3, '${U1}', 'development', '닉'),
  ('run-u2', '{}', 'S2', 'v0.1', 'SILENT', 1, false, 2, '${U2}', 'development', '남');
-- Answered inquiries from January; the rate-limit trigger only lets a user insert their own, so it is off for the seed.
alter table public.contact_inquiries disable trigger contact_inquiries_rate_limit;
insert into public.contact_inquiries (id, user_id, category, message, page_path, service_locale, game_locale, env, created_at, admin_response, responded_at) values
  ('${INQ1}', '${U1}', 'bug', 'an old question', '/codex', 'ko', 'kor', 'development', '2026-01-01T00:00:00Z', 'an answer', '2026-01-02T00:00:00Z'),
  ('${INQ2}', '${U2}', 'bug', 'an old question', '/codex', 'ko', 'kor', 'development', '2026-01-01T00:00:00Z', 'an answer', '2026-01-02T00:00:00Z');
alter table public.contact_inquiries enable trigger contact_inquiries_rate_limit;
`;

const TABLES = [
  "comments", "comment_likes", "likes", "resource_reactions", "resource_reaction_counts", "community_stories",
  "combo_posts", "transfigure_posts", "this_or_that_posts", "chemical_posts", "decisions_decisions_posts",
  "favorite_tournament_posts", "favorite_tournament_plays", "favorite_tournament_candidate_stats", "pagestorm_posts",
  "defragment_posts", "pagestorm_drafts", "defragment_bodies", "this_or_that_post_likes", "this_or_that_post_votes",
  "runs", "contact_inquiries", "puzzlebox_players", "puzzlebox_runs", "puzzlebox_best", "puzzlebox_board_stats",
];

// --- Normalizing ------------------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}(?::?\d{2})?)?$/;
const startedAt = Date.now();

/** Server-made values differ run to run: new uuids become <uuid>, times of this run become <now>. */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, inner]) => [key, normalize(inner)]));
  }
  if (typeof value === "string") {
    if (UUID.test(value) && !KNOWN_IDS.has(value.toLowerCase())) return "<uuid>";
    const match = TIMESTAMP.exec(value);
    if (match) {
      const zone = match[4] ? (match[4] === "Z" ? "Z" : match[4].length === 3 ? `${match[4]}:00` : match[4]) : "Z";
      const at = Date.parse(`${match[1]}T${match[2]}${(match[3] ?? "").slice(0, 4)}${zone}`);
      if (Math.abs(at - startedAt) < 60 * 60 * 1000) return "<now>";
    }
  }
  return value;
}

async function tableRows(db: PGlite, table: string): Promise<string[]> {
  const { rows } = await db.query<{ rows: unknown[] }>(`select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as rows from public.${table} t`);
  return (rows[0].rows ?? []).map((row) => JSON.stringify(normalize(row))).sort();
}

async function assertSameTables(today: PGlite, step4: PGlite, label: string) {
  for (const table of TABLES) {
    assert.deepEqual(await tableRows(step4, table), await tableRows(today, table), `${label}: ${table} differs`);
  }
}

// --- Worker environment ---------------------------------------------------------------------------

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const segment = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

async function makeSigner() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const jwks = { keys: [{ kty: "EC", crv: "P-256", alg: "ES256", use: "sig", kid: "gate-spec-kid", x: publicJwk.x, y: publicJwk.y }] };
  async function token(sub: string, issuer: string) {
    const now = Math.floor(Date.now() / 1000);
    const input = `${segment({ alg: "ES256", kid: "gate-spec-kid", typ: "JWT" })}.${segment({
      iss: issuer, sub, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now, is_anonymous: true,
    })}`;
    const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(input)));
    return `${input}.${base64Url(signature)}`;
  }
  return { jwks, token };
}

/** runtime_flags with every group on the api path and no write.* rows (each env's default decides). */
class FlagsD1 implements D1Database {
  prepare(query: string): D1PreparedStatement {
    const statement: D1PreparedStatement = {
      bind: () => statement,
      all: (async () => {
        if (query === FLAGS_SQL) return { success: true, results: API_SURFACE_GROUPS.map((group) => ({ key: pathFlagKey(group), value: "api" })) };
        if (query === WRITE_FLAGS_SQL) return { success: true, results: [] };
        throw new Error(`unexpected SQL: ${query}`);
      }) as D1PreparedStatement["all"],
      first: (async () => null) as D1PreparedStatement["first"],
      run: (async () => ({ success: true, results: [] })) as D1PreparedStatement["run"],
    };
    return statement;
  }
  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return Promise.all(statements.map((statement) => statement.all<T>()));
  }
}

const ctx = { waitUntil() {} };

type Side = { name: string; env: Record<string, unknown>; issuer: string };

type ApiCase = {
  name: string;
  actor?: string;
  method: string;
  path: string;
  body?: unknown;
  /** The answer today, checked on both sides. */
  status: number;
};

const COMBO_ROW = (overrides: Record<string, unknown>) => ({
  id: COMBO_NEW, user_id: U1, nickname: "닉", content: [], content_text: "combo text", resources: POOL, env: "development", ...overrides,
});
const FORGED = { like_count: 99, comment_count: 5, created_at: "2001-01-01T00:00:00Z" };
const RUN_ROW = (overrides: Record<string, unknown>) => ({
  id: "run-new", raw: "{}", seed: "S9", build: "v0.1", character: "DEFECT", ascension: 0, win: true, acts_count: 3,
  donor_user_id: U1, env: "development", donor_nickname: "닉", ...overrides,
});
const BODY_ROW = (overrides: Record<string, unknown>) => ({
  env: "development", source_service: "transfigure", source_id: TRANS1, user_id: U1, nickname: "닉", content: [], content_text: "body text", ...overrides,
});
const CONTACT = (message: string) => ({
  category: "bug", message, replyEmail: null, pagePath: "/codex/cards", serviceLocale: "ko", gameLocale: "kor", viewportWidth: 390, viewportHeight: 844,
});
const PUZZLE_RUN = (JSON.parse(readFileSync("scripts/fixtures/puzzlebox-score-cases.json", "utf8")) as { run: unknown }[])[0].run;

const API_CASES: ApiCase[] = [
  // comments group
  { name: "comment insert", method: "POST", path: "/api/write/comments", body: { threadKey: "sts2-codex:card:BASH", nickname: "닉", content: "hello there" }, status: 201 },
  { name: "comment delete own", method: "DELETE", path: `/api/write/comments?id=${C1}`, status: 200 },
  { name: "comment delete other's", method: "DELETE", path: `/api/write/comments?id=${C2}`, status: 404 },
  { name: "comment like", method: "PUT", path: `/api/write/comment-likes?id=${C2}`, status: 200 },
  { name: "comment like again", method: "PUT", path: `/api/write/comment-likes?id=${C2}`, status: 200 },
  { name: "comment like by another user", actor: U2, method: "PUT", path: `/api/write/comment-likes?id=${C2}`, status: 200 },
  { name: "comment unlike", method: "DELETE", path: `/api/write/comment-likes?id=${C2}`, status: 200 },
  { name: "comment like on no comment", method: "PUT", path: `/api/write/comment-likes?id=${MISSING}`, status: 404 },
  { name: "like", method: "PUT", path: "/api/write/likes?key=sts2-codex:card:BASH", status: 200 },
  { name: "like toybox thread", method: "PUT", path: `/api/write/likes?key=toybox:combo:${COMBO2}`, status: 200 },
  { name: "unlike", method: "DELETE", path: "/api/write/likes?key=sts2-codex:card:BASH", status: 200 },
  { name: "reaction insert", method: "PUT", path: "/api/write/reactions", body: { resourceType: "card", resourceId: "BASH", gameVersion: "0.1.0", kind: "buff" }, status: 200 },
  { name: "reaction update", method: "PUT", path: "/api/write/reactions", body: { resourceType: "card", resourceId: "BASH", gameVersion: "0.1.0", kind: "nerf" }, status: 200 },
  { name: "reaction clear", method: "PUT", path: "/api/write/reactions", body: { resourceType: "card", resourceId: "BASH", gameVersion: "0.1.0", kind: null }, status: 200 },
  { name: "reaction clear when there is none", method: "PUT", path: "/api/write/reactions", body: { resourceType: "relic", resourceId: "ANCHOR", gameVersion: "0.1.0", kind: null }, status: 200 },
  { name: "reaction with a bad kind", method: "PUT", path: "/api/write/reactions", body: { resourceType: "card", resourceId: "BASH", gameVersion: "0.1.0", kind: "angry" }, status: 400 },
  { name: "unlike when not liked", method: "DELETE", path: "/api/write/likes?key=sts2-codex:card:STRIKE", status: 200 },
  { name: "comment unlike when not liked", method: "DELETE", path: `/api/write/comment-likes?id=${C1}`, status: 200 },
  // stories group
  {
    name: "story insert", method: "POST", path: "/api/write/stories",
    body: { nickname: "닉", sentence: "a new sentence", entityType: "card", entityId: "BASH", patchLineId: "line-1", source: "v0.1", linkedEntities: [] }, status: 201,
  },
  { name: "story delete other's", method: "DELETE", path: `/api/write/stories?id=${STORY2}`, status: 200 },
  { name: "story delete own", method: "DELETE", path: `/api/write/stories?id=${STORY1}`, status: 200 },
  // toybox-feed group: posts (bodies pass through as the client wrote them)
  { name: "combo insert with forged counters", method: "POST", path: "/api/write/toybox-post?service=combo", body: COMBO_ROW(FORGED), status: 201 },
  { name: "combo insert for another user", method: "POST", path: "/api/write/toybox-post?service=combo", body: COMBO_ROW({ id: id("a1000000", 4), user_id: U2 }), status: 403 },
  { name: "combo insert without owner", method: "POST", path: "/api/write/toybox-post?service=combo", body: COMBO_ROW({ id: id("a1000000", 5), user_id: undefined }), status: 403 },
  { name: "combo insert with an uppercase owner", method: "POST", path: "/api/write/toybox-post?service=combo", body: COMBO_ROW({ id: id("a1000000", 6), user_id: U1.toUpperCase() }), status: 201 },
  { name: "combo insert failing a CHECK", method: "POST", path: "/api/write/toybox-post?service=combo", body: COMBO_ROW({ id: id("a1000000", 7), content_text: "x" }), status: 422 },
  { name: "combo insert with a bad owner", method: "POST", path: "/api/write/toybox-post?service=combo", body: COMBO_ROW({ id: id("a1000000", 8), user_id: "not-a-uuid" }), status: 400 },
  { name: "combo insert with an unknown column", method: "POST", path: "/api/write/toybox-post?service=combo", body: COMBO_ROW({ id: id("a1000000", 9), bogus: 1 }), status: 400 },
  { name: "combo insert duplicate id", method: "POST", path: "/api/write/toybox-post?service=combo", body: COMBO_ROW({}), status: 422 },
  {
    name: "combo update with guarded columns", method: "PATCH", path: `/api/write/toybox-post?service=combo&id=${COMBO1}`,
    body: { content_text: "edited", like_count: 50, comment_count: 9, created_at: "2001-01-01T00:00:00Z", env: "production", id: COMBO2 }, status: 200,
  },
  { name: "combo update other's", method: "PATCH", path: `/api/write/toybox-post?service=combo&id=${COMBO2}`, body: { content_text: "hijack" }, status: 200 },
  { name: "combo update giving it away", method: "PATCH", path: `/api/write/toybox-post?service=combo&id=${COMBO1}`, body: { user_id: U2 }, status: 403 },
  { name: "combo update giving away an invisible row", method: "PATCH", path: `/api/write/toybox-post?service=combo&id=${COMBO2}`, body: { user_id: U2 }, status: 200 },
  { name: "combo update of guarded columns only", method: "PATCH", path: `/api/write/toybox-post?service=combo&id=${COMBO1}`, body: { like_count: 7 }, status: 200 },
  { name: "combo update keeping the owner", method: "PATCH", path: `/api/write/toybox-post?service=combo&id=${COMBO1}`, body: { user_id: U1, content_text: "mine still" }, status: 200 },
  { name: "combo delete other's", method: "DELETE", path: `/api/write/toybox-post?service=combo&id=${COMBO2}`, status: 200 },
  { name: "combo delete own", method: "DELETE", path: `/api/write/toybox-post?service=combo&id=${COMBO_NEW}`, status: 200 },
  {
    name: "transfigure insert", method: "POST", path: "/api/write/toybox-post?service=transfigure",
    body: { id: TRANS_NEW, user_id: U1, nickname: "닉", resource_type: "card", resource_id: "BASH", source_text: "src", source_game_locale: "kor", content: [], content_text: "text", env: "development", ...FORGED }, status: 201,
  },
  {
    name: "this or that insert with forged votes", method: "POST", path: "/api/write/toybox-post?service=this_or_that",
    body: { id: TOT_NEW, user_id: U1, nickname: "닉", left_type: "card", left_id: "BASH", right_type: "relic", right_id: "ANCHOR", reason: "because", env: "development", left_vote_count: 9, right_vote_count: 8, ...FORGED }, status: 201,
  },
  {
    name: "chemical insert", method: "POST", path: "/api/write/toybox-post?service=chemical_x",
    body: { id: CHEM_NEW, user_id: U1, nickname: "닉", content: [], content_text: "chem", env: "development", ...FORGED }, status: 201,
  },
  {
    name: "decisions insert", method: "POST", path: "/api/write/toybox-post?service=decisions_decisions",
    body: { id: DEC_NEW, user_id: U1, nickname: "닉", title: "title", preset_key: "preset", game_version: "0.1", rows: [], placements: [], env: "development", ...FORGED }, status: 201,
  },
  {
    name: "tournament insert with a builtin key", method: "POST", path: "/api/write/toybox-post?service=favorite_tournament",
    body: { id: id("f0000000", 4), user_id: U1, nickname: "닉", title: "cup", preset_key: "builtin:cards", game_version: "0.1", pool: POOL, env: "development" }, status: 403,
  },
  {
    name: "tournament insert", method: "POST", path: "/api/write/toybox-post?service=favorite_tournament",
    body: { id: FAV_NEW, user_id: U1, nickname: "닉", title: "cup", preset_key: "Builtin:cards", game_version: "0.1", pool: POOL, env: "development", play_count: 4, ...FORGED }, status: 201,
  },
  {
    name: "pagestorm insert", method: "POST", path: "/api/write/toybox-post?service=pagestorm",
    body: { id: PAGE_NEW, user_id: U1, nickname: "닉", title: "title", content: {}, content_text: "text", env: "development", ...FORGED }, status: 201,
  },
  { name: "pagestorm update", method: "PATCH", path: `/api/write/toybox-post?service=pagestorm&id=${PAGE1}`, body: { title: "title 2" }, status: 200 },
  {
    name: "defragment post insert", method: "POST", path: "/api/write/toybox-post?service=defragment",
    body: { id: DEFRAG_NEW, user_id: U1, nickname: "닉", title: "title", content: [], content_text: "text", env: "development", ...FORGED }, status: 201,
  },
  // every post table: updates where a route exists (five services), deletes everywhere, own and another user's
  {
    name: "transfigure update with guarded columns", method: "PATCH", path: `/api/write/toybox-post?service=transfigure&id=${TRANS1}`,
    body: { content_text: "edited", env: "production", ...FORGED }, status: 200,
  },
  { name: "transfigure update by another user", actor: U2, method: "PATCH", path: `/api/write/toybox-post?service=transfigure&id=${TRANS1}`, body: { content_text: "hijack" }, status: 200 },
  { name: "transfigure delete by another user", actor: U2, method: "DELETE", path: `/api/write/toybox-post?service=transfigure&id=${TRANS1}`, status: 200 },
  { name: "decisions update with guarded columns", method: "PATCH", path: `/api/write/toybox-post?service=decisions_decisions&id=${DEC_NEW}`, body: { title: "title 2", ...FORGED }, status: 200 },
  { name: "decisions update by another user", actor: U2, method: "PATCH", path: `/api/write/toybox-post?service=decisions_decisions&id=${DEC_NEW}`, body: { title: "hijack" }, status: 200 },
  { name: "defragment post update with guarded columns", method: "PATCH", path: `/api/write/toybox-post?service=defragment&id=${DEFRAG_NEW}`, body: { title: "title 2", ...FORGED }, status: 200 },
  { name: "defragment post update giving it away", method: "PATCH", path: `/api/write/toybox-post?service=defragment&id=${DEFRAG_NEW}`, body: { user_id: U2 }, status: 403 },
  { name: "pagestorm update by another user", actor: U2, method: "PATCH", path: `/api/write/toybox-post?service=pagestorm&id=${PAGE1}`, body: { title: "hijack" }, status: 200 },
  { name: "chemical update (no update route)", method: "PATCH", path: `/api/write/toybox-post?service=chemical_x&id=${CHEM_NEW}`, body: { content_text: "edited" }, status: 400 },
  { name: "this or that delete of another user's", method: "DELETE", path: `/api/write/toybox-post?service=this_or_that&id=${TOT2}`, status: 200 },
  { name: "tournament delete of another user's", method: "DELETE", path: `/api/write/toybox-post?service=favorite_tournament&id=${FAV1}`, status: 200 },
  { name: "pagestorm delete by another user", actor: U2, method: "DELETE", path: `/api/write/toybox-post?service=pagestorm&id=${PAGE1}`, status: 200 },
  { name: "chemical delete by another user", actor: U2, method: "DELETE", path: `/api/write/toybox-post?service=chemical_x&id=${CHEM_NEW}`, status: 200 },
  { name: "decisions delete by another user", actor: U2, method: "DELETE", path: `/api/write/toybox-post?service=decisions_decisions&id=${DEC_NEW}`, status: 200 },
  { name: "defragment post delete by another user", actor: U2, method: "DELETE", path: `/api/write/toybox-post?service=defragment&id=${DEFRAG_NEW}`, status: 200 },
  { name: "transfigure delete own", method: "DELETE", path: `/api/write/toybox-post?service=transfigure&id=${TRANS_NEW}`, status: 200 },
  { name: "this or that delete own", method: "DELETE", path: `/api/write/toybox-post?service=this_or_that&id=${TOT_NEW}`, status: 200 },
  { name: "chemical delete own", method: "DELETE", path: `/api/write/toybox-post?service=chemical_x&id=${CHEM_NEW}`, status: 200 },
  { name: "decisions delete own", method: "DELETE", path: `/api/write/toybox-post?service=decisions_decisions&id=${DEC_NEW}`, status: 200 },
  { name: "tournament delete own", method: "DELETE", path: `/api/write/toybox-post?service=favorite_tournament&id=${FAV_NEW}`, status: 200 },
  { name: "pagestorm delete own", method: "DELETE", path: `/api/write/toybox-post?service=pagestorm&id=${PAGE_NEW}`, status: 200 },
  { name: "defragment post delete own", method: "DELETE", path: `/api/write/toybox-post?service=defragment&id=${DEFRAG_NEW}`, status: 200 },
  // pagestorm drafts: no guard trigger, the client's times and env stay
  {
    name: "draft insert", method: "POST", path: "/api/write/pagestorm/drafts",
    body: { id: DRAFT_NEW, user_id: U1, nickname: "닉", title: "draft", content: {}, content_text: "text", env: "development", created_at: "2001-01-01T00:00:00Z" }, status: 201,
  },
  {
    name: "draft insert for another user", method: "POST", path: "/api/write/pagestorm/drafts",
    body: { id: id("a9000000", 4), user_id: U2, nickname: "닉", title: "draft", content: {}, content_text: "text", env: "development" }, status: 403,
  },
  { name: "draft update", method: "PATCH", path: `/api/write/pagestorm/drafts?id=${DRAFT1}`, body: { title: "draft 2", env: "production", updated_at: "2001-01-01T00:00:00Z" }, status: 200 },
  { name: "draft update other's", method: "PATCH", path: `/api/write/pagestorm/drafts?id=${DRAFT2}`, body: { title: "hijack" }, status: 200 },
  { name: "draft delete other's", method: "DELETE", path: `/api/write/pagestorm/drafts?id=${DRAFT2}`, status: 200 },
  { name: "draft delete own", method: "DELETE", path: `/api/write/pagestorm/drafts?id=${DRAFT_NEW}`, status: 200 },
  // defragment bodies: upsert on (env, source_service, source_id)
  { name: "body insert", method: "PUT", path: "/api/write/defragment-body", body: BODY_ROW({}), status: 200 },
  { name: "body update", method: "PUT", path: "/api/write/defragment-body", body: BODY_ROW({ content_text: "body two" }), status: 200 },
  { name: "body on another user's source", method: "PUT", path: "/api/write/defragment-body", body: BODY_ROW({ source_service: "combo", source_id: COMBO2 }), status: 403 },
  { name: "body over another user's body", method: "PUT", path: "/api/write/defragment-body", body: BODY_ROW({ source_service: "combo", source_id: COMBO1 }), status: 403 },
  { name: "body for another user", method: "PUT", path: "/api/write/defragment-body", body: BODY_ROW({ user_id: U2 }), status: 403 },
  { name: "body for an unknown service", method: "PUT", path: "/api/write/defragment-body", body: BODY_ROW({ source_service: "unknown" }), status: 403 },
  { name: "body with a bad source id", method: "PUT", path: "/api/write/defragment-body", body: BODY_ROW({ source_id: "nope" }), status: 400 },
  // this or that likes and votes
  { name: "this or that like", method: "PUT", path: `/api/write/this-or-that/like?id=${TOT2}`, status: 200 },
  { name: "this or that like again", method: "PUT", path: `/api/write/this-or-that/like?id=${TOT2}`, status: 200 },
  { name: "this or that unlike", method: "DELETE", path: `/api/write/this-or-that/like?id=${TOT2}`, status: 200 },
  { name: "this or that like on another env's post", method: "PUT", path: `/api/write/this-or-that/like?id=${TOT_PROD}`, status: 200 },
  { name: "this or that like on no post", method: "PUT", path: `/api/write/this-or-that/like?id=${MISSING}`, status: 404 },
  { name: "vote", method: "PUT", path: `/api/write/this-or-that/vote?id=${TOT2}`, body: { choice: "left", surface: "index" }, status: 201 },
  { name: "vote again", method: "PUT", path: `/api/write/this-or-that/vote?id=${TOT2}`, body: { choice: "right", surface: "detail" }, status: 422 },
  { name: "vote on another env's post", method: "PUT", path: `/api/write/this-or-that/vote?id=${TOT_PROD}`, body: { choice: "left", surface: "index" }, status: 403 },
  { name: "vote on no post", method: "PUT", path: `/api/write/this-or-that/vote?id=${MISSING}`, body: { choice: "left", surface: "index" }, status: 403 },
  { name: "unvote", method: "DELETE", path: `/api/write/this-or-that/vote?id=${TOT2}`, status: 200 },
  // favorite tournament play (RPC that reads auth.uid())
  {
    name: "tournament play", method: "POST", path: "/api/write/favorite-tournament/play",
    body: { tournamentId: FAV1, startingSize: 2, championType: "card", championId: "BASH", matches: [{ left_type: "card", left_id: "BASH", right_type: "card", right_id: "STRIKE", winner: "left" }] }, status: 200,
  },
  {
    name: "tournament play with a wrong match count", method: "POST", path: "/api/write/favorite-tournament/play",
    body: { tournamentId: FAV1, startingSize: 3, championType: "card", championId: "BASH", matches: [{ left_type: "card", left_id: "BASH", right_type: "card", right_id: "STRIKE", winner: "left" }] }, status: 400,
  },
  {
    name: "tournament play on no tournament", method: "POST", path: "/api/write/favorite-tournament/play",
    body: { tournamentId: MISSING, startingSize: 2, championType: "card", championId: "BASH", matches: [{ left_type: "card", left_id: "BASH", right_type: "card", right_id: "STRIKE", winner: "left" }] }, status: 400,
  },
  // history-runs group
  { name: "run upload with forged counters", method: "POST", path: "/api/write/history-runs", body: RUN_ROW(FORGED), status: 201 },
  { name: "run upload again", method: "POST", path: "/api/write/history-runs", body: RUN_ROW({}), status: 422 },
  { name: "run upload for another user", method: "POST", path: "/api/write/history-runs", body: RUN_ROW({ id: "run-theirs", donor_user_id: U2 }), status: 403 },
  { name: "run batch with a duplicate", method: "POST", path: "/api/write/history-runs/batch", body: [RUN_ROW({ id: "run-batch-1", ...FORGED }), RUN_ROW({ id: "run-u1" })], status: 201 },
  { name: "run batch with a new row of another user", method: "POST", path: "/api/write/history-runs/batch", body: [RUN_ROW({ id: "run-batch-2", donor_user_id: U2 })], status: 403 },
  { name: "run batch with an existing row of another user", method: "POST", path: "/api/write/history-runs/batch", body: [RUN_ROW({ id: "run-u2", donor_user_id: U2 }), RUN_ROW({ id: "run-batch-3" })], status: 403 },
  { name: "run cover", method: "PATCH", path: "/api/write/history-runs/cover?id=run-u1", body: { coverSpec: { card: "BASH" } }, status: 200 },
  { name: "run cover of another user's run", method: "PATCH", path: "/api/write/history-runs/cover?id=run-u2", body: { coverSpec: { card: "BASH" } }, status: 200 },
  { name: "run nicknames", method: "POST", path: "/api/write/history-runs/nicknames", body: { nickname: "새닉" }, status: 200 },
  { name: "run delete other's", method: "DELETE", path: "/api/write/history-runs?id=run-u2", status: 200 },
  { name: "run delete own", method: "DELETE", path: "/api/write/history-runs?id=run-batch-1", status: 200 },
  // puzzlebox group (RPC that reads auth.uid())
  { name: "puzzlebox run", method: "POST", path: "/api/write/puzzlebox/runs", body: { game: "connections", board: "1", run: PUZZLE_RUN, player: { nickname: " 닉 " } }, status: 200 },
  { name: "puzzlebox run too soon", method: "POST", path: "/api/write/puzzlebox/runs", body: { game: "connections", board: "1", run: PUZZLE_RUN, player: { nickname: "닉" } }, status: 429 },
  { name: "puzzlebox unknown board", method: "POST", path: "/api/write/puzzlebox/runs", body: { game: "connections", board: "0", run: PUZZLE_RUN, player: {} }, status: 400 },
  // contact group: three an hour
  { name: "inquiry 1", method: "POST", path: "/api/write/contact-inquiries", body: CONTACT("the first question"), status: 201 },
  { name: "inquiry 2", method: "POST", path: "/api/write/contact-inquiries", body: { ...CONTACT("the second question"), category: "partnership", replyEmail: "Me@Example.COM" }, status: 201 },
  { name: "inquiry 3", method: "POST", path: "/api/write/contact-inquiries", body: CONTACT("the third question"), status: 201 },
  { name: "inquiry 4 over the limit", method: "POST", path: "/api/write/contact-inquiries", body: CONTACT("the fourth question"), status: 429 },
  { name: "inquiry of another user", actor: U2, method: "POST", path: "/api/write/contact-inquiries", body: CONTACT("their own question"), status: 201 },
  // profile group
  { name: "inquiries seen", method: "POST", path: "/api/write/profile/inquiries-seen", status: 200 },
];

// --- Gate-level writes no route builds ------------------------------------------------------------

type GateCase = { name: string; actor?: string; request: Omit<RestRequest, "token">; status: number; code?: string };

const q = (entries: Record<string, string>) => new URLSearchParams(entries);
const INQUIRY = (overrides: Record<string, unknown>) => ({
  user_id: U3, category: "bug", message: "a long enough question", page_path: "/codex", service_locale: "ko", game_locale: "kor", env: "development", ...overrides,
});

const GATE_CASES: GateCase[] = [
  { name: "comment for another user", request: { method: "POST", path: "comments", body: { story_id: "k", user_id: U2, nickname: "닉", content: "hello", env: "development" }, prefer: ["return=minimal"] }, status: 403, code: "42501" },
  { name: "comment with a forged time", request: { method: "POST", path: "comments", body: { story_id: "k", user_id: U1, nickname: "닉", content: "hello", env: "development", created_at: "2001-01-01T00:00:00Z" }, query: q({ select: "story_id,created_at" }), prefer: ["return=representation"] }, status: 201 },
  { name: "comment with a key that is no column", request: { method: "POST", path: "comments", body: { story_id: "k", user_id: U1, nickname: "닉", Content: "hello", env: "development" }, prefer: ["return=minimal"] }, status: 400, code: "PGRST204" },
  { name: "comment with an empty content", request: { method: "POST", path: "comments", body: { story_id: "k", user_id: U1, nickname: "닉", content: "", env: "development" }, prefer: ["return=minimal"] }, status: 400, code: "23514" },
  { name: "comment update (no policy)", request: { method: "PATCH", path: "comments", body: { content: "edited" }, query: q({ id: `eq.${C2}`, select: "id" }), prefer: ["return=representation"] }, status: 200 },
  { name: "comment delete of another user's by its owner filter", request: { method: "DELETE", path: "comments", query: q({ id: `eq.${C2}`, user_id: `eq.${U2}`, select: "id" }), prefer: ["return=representation"] }, status: 200 },
  { name: "story with a static id", request: { method: "POST", path: "community_stories", body: { user_id: U1, nickname: "닉", sentence: "a sentence", env: "development", static_story_id: "official-1", created_at: "2001-01-01T00:00:00Z" }, query: q({ select: "static_story_id,created_at" }), prefer: ["return=representation"] }, status: 201 },
  { name: "like with a bad reaction", request: { method: "POST", path: "likes", body: { story_id: "k2", user_id: U1, env: "development", reaction_type: "angry" }, prefer: ["return=minimal"] }, status: 400, code: "23514" },
  { name: "like with a forged time (no guard)", request: { method: "POST", path: "likes", body: { story_id: "k3", user_id: U1, env: "development", created_at: "2001-01-01T00:00:00Z" }, prefer: ["return=minimal"] }, status: 201 },
  { name: "reaction update of another column", request: { method: "PATCH", path: "resource_reactions", body: { resource_id: "STRIKE" }, query: q({ resource_id: "eq.BASH" }), prefer: ["return=minimal"] }, status: 403, code: "42501" },
  { name: "reaction update of another user's", request: { method: "PATCH", path: "resource_reactions", body: { kind: "rework" }, query: q({ user_id: `eq.${U2}`, select: "kind" }), prefer: ["return=representation"] }, status: 200 },
  { name: "vote update (no policy)", request: { method: "PATCH", path: "this_or_that_post_votes", body: { choice: "right" }, query: q({ post_id: `eq.${TOT2}` }), prefer: ["return=minimal"] }, status: 204 },
  { name: "run update giving it away", request: { method: "PATCH", path: "runs", body: { donor_user_id: U2 }, query: q({ id: "eq.run-u1" }), prefer: ["return=minimal"] }, status: 403, code: "42501" },
  { name: "inquiry with padded text", actor: U3, request: { method: "POST", path: "contact_inquiries", body: INQUIRY({ message: "  padded question here  ", reply_email: " Someone@Example.Org " }), prefer: ["return=minimal"] }, status: 201 },
  { name: "inquiry with an empty email", actor: U3, request: { method: "POST", path: "contact_inquiries", body: INQUIRY({ reply_email: "   " }), prefer: ["return=minimal"] }, status: 201 },
  { name: "inquiry for another user", actor: U3, request: { method: "POST", path: "contact_inquiries", body: INQUIRY({ user_id: U2 }), prefer: ["return=minimal"] }, status: 403, code: "42501" },
  { name: "inquiry with a status", actor: U3, request: { method: "POST", path: "contact_inquiries", body: INQUIRY({ status: "done" }), prefer: ["return=minimal"] }, status: 403, code: "42501" },
  { name: "inquiry read back", actor: U3, request: { method: "POST", path: "contact_inquiries", body: INQUIRY({}), prefer: ["return=representation"] }, status: 403, code: "42501" },
  { name: "inquiry read back of a hidden column", actor: U3, request: { method: "POST", path: "contact_inquiries", body: INQUIRY({}), query: q({ select: "id,user_id" }), prefer: ["return=representation"] }, status: 403, code: "42501" },
  { name: "inquiry read back of its id", actor: U3, request: { method: "POST", path: "contact_inquiries", body: INQUIRY({}), query: q({ select: "id,status" }), prefer: ["return=representation"] }, status: 201 },
  { name: "inquiry answer by its user", request: { method: "PATCH", path: "contact_inquiries", body: { admin_response: "self answer" }, query: q({ env: "eq.development" }), prefer: ["return=minimal"] }, status: 403, code: "42501" },
  { name: "inquiry filtered by user id", request: { method: "PATCH", path: "contact_inquiries", body: { reply_seen_at: "2026-11-08T00:00:00Z" }, query: q({ user_id: `eq.${U1}` }), prefer: ["return=minimal"] }, status: 403, code: "42501" },
  { name: "inquiry delete", request: { method: "DELETE", path: "contact_inquiries", query: q({ env: "eq.development" }), prefer: ["return=minimal"] }, status: 403, code: "42501" },
  { name: "rpc with an actor argument", request: { method: "POST", path: "rpc/complete_favorite_tournament_play", body: { p_actor: U2, p_tournament_id: FAV1, p_env: "development", p_starting_size: 2, p_champion_type: "card", p_champion_id: "BASH", p_matches: [] } }, status: 404, code: "PGRST202" },
];

async function main() {
  const skip = (file: string) => file.endsWith("_d1_change_log.sql");
  const step4Migration = repoSchemaFiles().filter((file) => file.endsWith("_worker_write_actor.sql"));
  const dump = process.env.SUPABASE_PUBLIC_SCHEMA;
  const [today, step4, step4Rls] = await Promise.all(dump
    ? [supabaseFromDump(dump), supabaseFromDump(dump, step4Migration), supabaseFromDump(dump, [...step4Migration, ...step4Migration])]
    : [
      supabaseFromRepo(repoSchemaFiles((file) => skip(file) || step4Migration.includes(file))),
      supabaseFromRepo(repoSchemaFiles(skip)),
      // The migration a second time: it must be idempotent.
      supabaseFromRepo([...repoSchemaFiles(skip), ...step4Migration]),
    ]);
  console.log(dump ? `schema: replayed ${dump}` : "schema: rebuilt from the repo's supabase SQL");
  for (const db of [today, step4, step4Rls]) await db.exec(SEED);
  await assertSameTables(today, step4, "seed");
  await assertSameTables(today, step4Rls, "seed");

  const signer = await makeSigner();
  const options = { secretKey: SECRET, publishableKey: PUBLISHABLE, jwks: signer.jwks };
  const restToday = new PgRest(today, options);
  const restStep4 = new PgRest(step4, options);
  const restStep4Rls = new PgRest(step4Rls, options);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (request.url.startsWith(TODAY_URL)) return restToday.handle(request);
    if (request.url.startsWith(STEP4_URL)) return restStep4.handle(request);
    if (request.url.startsWith(STEP4_RLS_URL)) return restStep4Rls.handle(request);
    throw new Error(`unexpected fetch ${request.url}`);
  }) as typeof fetch;
  resetFlagsForTest();
  resetJwtCachesForTest();
  resetWriteFlagsForTest();

  const common = {
    API_RUNTIME_FLAGS: "d1",
    API_SUPABASE_KEY: PUBLISHABLE,
    API_DATA_ENV: "development",
    DB: new FlagsD1(),
    ASSETS: { fetch: async () => new Response("asset") },
    PATCH_WORKER: { fetch: async () => new Response("patch") },
  };
  const sides: [Side, Side, Side] = [
    { name: "rls", issuer: `${TODAY_URL}/auth/v1`, env: { ...common, API_SUPABASE_URL: TODAY_URL } },
    {
      name: "worker",
      issuer: `${STEP4_URL}/auth/v1`,
      env: { ...common, API_SUPABASE_URL: STEP4_URL, API_SUPABASE_SERVICE_KEY: SECRET, API_WRITE_MODE_DEFAULT: "worker" },
    },
    { name: "rls after the migration", issuer: `${STEP4_RLS_URL}/auth/v1`, env: { ...common, API_SUPABASE_URL: STEP4_RLS_URL } },
  ];

  async function callApi(side: Side, item: ApiCase) {
    const token = await signer.token(item.actor ?? U1, side.issuer);
    const headers: Record<string, string> = { authorization: `Bearer ${token}`, "sec-fetch-site": "same-origin" };
    let text: string | undefined;
    if (item.body !== undefined) {
      text = JSON.stringify(item.body);
      headers["content-type"] = "application/json";
      headers["content-length"] = String(Buffer.byteLength(text));
    }
    const response = await mainWorker.fetch(new Request(`${ORIGIN}${item.path}`, { method: item.method, headers, body: text }), side.env as never, ctx);
    const body = await response.text();
    return { status: response.status, body: normalize(body ? JSON.parse(body) : null) };
  }

  for (const item of API_CASES) {
    const before = { today: restToday.calls.length, step4: restStep4.calls.length };
    const rls = await callApi(sides[0], item);
    const worker = await callApi(sides[1], item);
    const rlsAfter = await callApi(sides[2], item);
    assert.equal(rls.status, item.status, `${item.name}: today answers ${rls.status} ${JSON.stringify(rls.body)}`);
    assert.deepEqual(worker, rls, `${item.name}: worker mode answers differently`);
    assert.deepEqual(rlsAfter, rls, `${item.name}: the step 4 migration changed the rls path`);
    // The rls side never uses the service key; the worker side never forwards a user token.
    assert.ok(restToday.calls.slice(before.today).every((call) => call.role !== "service_role"), `${item.name}: rls side used the service key`);
    assert.ok(restStep4.calls.slice(before.step4).every((call) => call.role !== "authenticated"), `${item.name}: worker side forwarded the token`);
    await assertSameTables(today, step4, item.name);
    await assertSameTables(today, step4Rls, `${item.name} (rls after the migration)`);
  }
  console.log(`api cases: ${API_CASES.length} answer alike and leave the same rows (also in rls mode after the migration)`);

  // The cases did what their names say on today's database (both sides already hold the same rows).
  const one = async (sql: string) => (await today.query<Record<string, unknown>>(sql)).rows;
  assert.deepEqual(await one(`select content_text, like_count, comment_count, env, user_id from public.transfigure_posts where id = '${TRANS1}'`),
    [{ content_text: "edited", like_count: 0, comment_count: 0, env: "development", user_id: U1 }], "own update kept the guarded columns");
  assert.deepEqual(await one(`select title from public.pagestorm_posts where id = '${PAGE1}'`), [{ title: "title 2" }], "another user's update and delete did nothing");
  assert.equal((await one(`select id from public.this_or_that_posts where id = '${TOT2}'`)).length, 1, "another user's post stays");
  assert.equal((await one(`select id from public.favorite_tournament_posts where id = '${FAV1}'`)).length, 1, "another user's post stays");
  for (const [table, postId] of [["transfigure_posts", TRANS_NEW], ["this_or_that_posts", TOT_NEW], ["chemical_posts", CHEM_NEW],
    ["decisions_decisions_posts", DEC_NEW], ["favorite_tournament_posts", FAV_NEW], ["pagestorm_posts", PAGE_NEW], ["defragment_posts", DEFRAG_NEW]]) {
    assert.equal((await one(`select id from public.${table} where id = '${postId}'`)).length, 0, `own ${table} delete removed the row`);
  }
  assert.equal((await one(`select post_id from public.this_or_that_post_likes where post_id = '${TOT_PROD}'`)).length, 1, "a like on another env's post is accepted today");

  const todayConfig: SupabaseApiConfig = { url: TODAY_URL, key: PUBLISHABLE, dataEnv: "development" };
  const step4Config: SupabaseApiConfig = { url: STEP4_URL, key: PUBLISHABLE, dataEnv: "development" };
  const step4RlsConfig: SupabaseApiConfig = { url: STEP4_RLS_URL, key: PUBLISHABLE, dataEnv: "development" };
  const service: SupabaseApiConfig = { url: STEP4_URL, key: SECRET, dataEnv: "development" };
  for (const item of GATE_CASES) {
    const actor = item.actor ?? U1;
    const token = await signer.token(actor, `${TODAY_URL}/auth/v1`);
    const rls = await postgrest(todayConfig, { ...item.request, token });
    const rlsAfter = await postgrest(step4RlsConfig, { ...item.request, token: await signer.token(actor, `${STEP4_RLS_URL}/auth/v1`) });
    const gated = withWriteGate(step4Config, createWriteGate({ actor, service }));
    const worker = await postgrest(gated, { ...item.request, token: "worker-actor" });
    const shape = (result: Awaited<ReturnType<typeof postgrest>>) => (result.ok
      ? { ok: true, status: result.status, data: normalize(result.data) }
      : { ok: false, status: result.status, code: result.code });
    assert.equal(rls.status, item.status, `${item.name}: today answers ${JSON.stringify(shape(rls))}`);
    if (item.code) assert.equal(rls.ok ? null : rls.code, item.code, `${item.name}: today's code`);
    assert.deepEqual(shape(worker), shape(rls), `${item.name}: the gate answers differently`);
    assert.deepEqual(shape(rlsAfter), shape(rls), `${item.name}: the step 4 migration changed what a user token may do`);
    await assertSameTables(today, step4, item.name);
    await assertSameTables(today, step4Rls, `${item.name} (rls after the migration)`);
  }
  console.log(`gate cases: ${GATE_CASES.length} answer alike and leave the same rows (also with a user token after the migration)`);

  globalThis.fetch = realFetch;
  await today.close();
  await step4.close();
  await step4Rls.close();
  console.log("write-gate equivalence spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
