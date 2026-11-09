/**
 * Operator writes that went straight to Supabase (docs/SUPABASE_EXIT_PLAN.md 5.7, step 6 plan P17):
 * the /dev/admin inquiry reply and nickname pools, the /dev/colorful-philosophers weekly post, the
 * builtin tournament seed (pnpm worldcup:seed) and the patch-note-revision skill's community_stories
 * relink. The dev server actions and the CLI scripts under scripts/admin call these functions.
 *
 * Each write follows its env's step 5 write source, read from that env's D1 (scripts/lib/d1-remote.ts):
 *   - source.<group> = supabase: the same Supabase write as before (same request or SQL).
 *   - source.<group> = d1: the D1 change and its outbox row(s) in one call, built with the Worker's
 *     outbox builder and the sync's row mapper, so the step 5 mirror sends Supabase the same row and
 *     a store rollback (source back to supabase) loses nothing.
 *   - write.paused = on (a cutover is running): nothing is written (WritesPausedError).
 *
 * Groups: contact_inquiries -> contact, profile_character_nickname_pools -> profile,
 * favorite_tournament_posts -> toybox-feed, community_stories -> stories. colorful_philosopher_posts
 * has no write group: it goes to D1 exactly while some group's source is d1, which is when the step 2
 * sync (the only path from a Supabase write into D1) is off and the mirror is on (gate.ts
 * supabaseInSyncAllowed / anyD1Source). The cutover flips every group together, so both rules agree.
 *
 * Env-less nickname pools (every database holds the same rows): Supabase or production D1 + outbox by
 * production's source; the testbed database is written directly while its own source is d1 (its
 * mirror never sends env-less rows, design 5.5).
 */
import { mapChange, mapRow, mergeChanges, type MapResult, type RowImage } from "../../src/lib/d1-sync/row-mapper";
import { toSqlText, type D1Statement } from "../../src/lib/d1-sync/statements";
import { isValidNicknameList, nicknamePoolRowsFromPools, type ProfileNicknamePools } from "../../src/lib/profile-character-nicknames";
import type { WriteGroup, WriteSource } from "../../src/lib/write-source-flags";
import { stmt, tsFromMs } from "../../workers/api/d1-write/db";
import { anyD1Source, type WriteGate } from "../../workers/api/d1-write/gate";
import { outboxStatement, readPayload } from "../../workers/api/d1-write/outbox";
import { mirrorTable } from "../../workers/api/d1-write/tables";
import {
  D1_DATABASES,
  D1_ENVS,
  DATA_ENV_OF,
  MAX_COMMAND_BYTES,
  commandSql,
  d1EnvOf,
  readGate,
  WritesPausedError,
  type D1EnvName,
  type D1Remote,
  type D1Rows,
  type DataEnv,
} from "../lib/d1-remote";
import { supabaseRest, type RestFetch, type RestRequest, type SupabaseAdminConfig } from "../lib/supabase-admin";

export { WritesPausedError };

export interface AdminDeps {
  d1(env: D1EnvName): D1Remote;
  /** The secret-key PostgREST config, or null when the server has no key. */
  supabase: SupabaseAdminConfig | null;
  /** SQL on the linked Supabase project (`supabase db query --linked -f`), as the seed and the skill ran it. */
  supabaseSql?(sql: string): Promise<void>;
  fetch?: RestFetch;
  now?(): number;
  uuid?(): string;
  /** Read the gates and print the plan; write nothing. */
  dryRun?: boolean;
  /** D1 is the local wrangler dev SQLite: a Supabase write is refused unless it is a dry run. */
  localD1?: boolean;
  log?(line: string): void;
}

export type AdminPlan =
  | { store: "d1"; env: D1EnvName; statements: D1Statement[] }
  | { store: "supabase"; request: RestRequest }
  | { store: "supabase-sql"; sql: string };

export interface AdminWriteResult {
  plans: AdminPlan[];
  dryRun: boolean;
}

export class AdminInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminInputError";
  }
}

export class AdminWriteError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "AdminWriteError";
  }
}

const now = (deps: AdminDeps) => (deps.now ? deps.now() : Date.now());
const uuid = (deps: AdminDeps) => (deps.uuid ? deps.uuid() : crypto.randomUUID());
const log = (deps: AdminDeps, line: string) => deps.log?.(line);

// ------------------------------------------------------------------------------------------- source

/** The gate of an env; refuses while its writes are paused. */
export async function gateOf(deps: AdminDeps, env: D1EnvName): Promise<WriteGate> {
  const gate = await readGate(deps.d1(env));
  if (gate.paused) throw new WritesPausedError(env);
  return gate;
}

export function sourceOf(gate: WriteGate, group: WriteGroup | "any"): WriteSource {
  if (group === "any") return anyD1Source(gate) ? "d1" : "supabase";
  return gate.sources[group];
}

// ------------------------------------------------------------------------------------------- running plans

function truncated(text: string): string {
  return text.length > 400 ? `${text.slice(0, 397)}...` : text;
}

async function runD1(deps: AdminDeps, env: D1EnvName, statements: D1Statement[]): Promise<D1Rows[]> {
  if (deps.dryRun) {
    log(deps, `dry run: ${D1_DATABASES[env]} would run ${statements.length} statements in one call:`);
    for (const statement of statements) log(deps, `  ${truncated(toSqlText(statement))}`);
    return statements.map(() => []);
  }
  return deps.d1(env).run(statements);
}

function refuseLocalSupabase(deps: AdminDeps) {
  if (deps.localD1 && !deps.dryRun) {
    throw new AdminWriteError("the source is supabase: --local only runs the D1 path (use --dry-run, or --remote for Supabase)");
  }
}

async function runRest(deps: AdminDeps, request: RestRequest): Promise<unknown> {
  if (deps.dryRun) {
    const query = new URLSearchParams(request.query ?? {}).toString();
    log(deps, `dry run: Supabase ${request.method} /rest/v1/${request.path}${query ? `?${query}` : ""}`);
    if (request.body !== undefined) log(deps, `  body ${truncated(JSON.stringify(request.body))}`);
    return null;
  }
  refuseLocalSupabase(deps);
  if (!deps.supabase) throw new AdminWriteError("SUPABASE_SECRET_KEY is not configured");
  const result = await supabaseRest(deps.supabase, request, { fetch: deps.fetch });
  if (!result.ok) throw new AdminWriteError(result.error.message, result.error.code);
  return result.data;
}

async function runSupabaseSql(deps: AdminDeps, sql: string): Promise<void> {
  if (deps.dryRun) {
    log(deps, `dry run: supabase db query --linked would run:\n${truncated(sql.trim())}`);
    return;
  }
  refuseLocalSupabase(deps);
  if (!deps.supabaseSql) throw new AdminWriteError("no Supabase CLI runner");
  await deps.supabaseSql(sql);
}

/** Groups of statements (each kept in one call) packed into calls under the command size. */
export function packCalls(groups: readonly D1Statement[][], maxBytes = MAX_COMMAND_BYTES - 16 * 1024): D1Statement[][] {
  const calls: D1Statement[][] = [];
  let current: D1Statement[] = [];
  let bytes = 0;
  for (const group of groups) {
    const size = Buffer.byteLength(commandSql(group), "utf8") + 1;
    if (size > maxBytes) throw new AdminWriteError("one write is larger than a D1 call");
    if (current.length && bytes + size > maxBytes) {
      calls.push(current);
      current = [];
      bytes = 0;
    }
    current.push(...group);
    bytes += size;
  }
  if (current.length) calls.push(current);
  return calls;
}

function mapped(result: MapResult): D1Statement[] {
  if (!result.ok) throw new AdminWriteError(`D1 cannot hold this row (${result.reject.reason}): ${result.reject.error}`);
  return result.statements;
}

/** The sync's statements for a Supabase UPDATE of these columns (a d1_change_log U row). */
function mappedUpdate(table: string, newRow: RowImage, nowMs: number): D1Statement[] {
  const { changes, rejects } = mergeChanges([{ id: 1, table, op: "U", newRow }]);
  if (rejects.length || changes.length !== 1) throw new AdminWriteError(`${table}: not an update D1 can apply`);
  return mapped(mapChange(changes[0], { nowMs }));
}

// ------------------------------------------------------------------------------------------- 1. inquiry reply

export const INQUIRY_STATUSES = ["new", "reviewing", "done", "spam"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export const INQUIRY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const INQUIRY_RESPONSE_MAX = 8000;

export interface InquiryReplyInput {
  id: string;
  /** The inquiry's data env (its row's env): production or development. */
  dataEnv: string;
  response: string;
  status: string;
}

/** The dev page's checks (respondToContactInquiry), in the same order and words. */
export function checkInquiryReply(input: InquiryReplyInput): { id: string; env: D1EnvName; response: string; status: InquiryStatus } {
  const id = String(input.id ?? "");
  const response = String(input.response ?? "").trim();
  const status = String(input.status ?? "") as InquiryStatus;
  if (!INQUIRY_ID_PATTERN.test(id)) throw new AdminInputError("Invalid inquiry id");
  if (!INQUIRY_STATUSES.includes(status)) throw new AdminInputError("Invalid inquiry status");
  if (response.length > INQUIRY_RESPONSE_MAX) throw new AdminInputError("Response is too long");
  if (!response && status === "done") throw new AdminInputError("A completed inquiry needs a response");
  const env = d1EnvOf(input.dataEnv);
  if (!env) throw new AdminInputError("Invalid inquiry env");
  return { id, env, response, status };
}

/** Today's Supabase update: PATCH contact_inquiries?id=eq.<id> (its trigger clears reply_seen_at). */
export function inquiryReplyRequest(id: string, response: string, status: InquiryStatus, nowMs: number): RestRequest {
  return {
    method: "PATCH",
    path: "contact_inquiries",
    query: { id: `eq.${id}` },
    body: {
      admin_response: response || null,
      responded_at: response ? new Date(nowMs).toISOString() : null,
      status: response ? "done" : status,
    },
  };
}

export const INQUIRY_REPLY_COLUMNS = ["admin_response", "responded_at", "status"] as const;

/**
 * The same update on D1 with Supabase's contact_inquiries_clear_reply_seen trigger in the statement
 * (design-runs-profile 532: the C5 CASE): a new or changed reply clears reply_seen_at, so the user's
 * mailbox dot lights again. SQLite evaluates every SET expression on the old row. The outbox row
 * (only when the inquiry is in this database) PATCHes the three columns, as the request above does.
 */
export function inquiryReplyStatements(id: string, response: string, status: InquiryStatus, nowMs: number): D1Statement[] {
  const key = id.toLowerCase();
  const adminResponse = response || null;
  const respondedAt = response ? tsFromMs(nowMs) : null;
  return [
    stmt(
      "UPDATE contact_inquiries SET reply_seen_at = CASE WHEN admin_response IS ?1 AND responded_at IS ?2 THEN reply_seen_at ELSE NULL END, " +
        "admin_response = ?1, responded_at = ?2, status = ?3 WHERE id = ?4",
      adminResponse,
      respondedAt,
      response ? "done" : status,
      key,
    ),
    outboxStatement(
      { table: "contact_inquiries", op: "update", match: { id: key }, payload: { read: "contact_inquiries", columns: [...INQUIRY_REPLY_COLUMNS] } },
      nowMs,
      { sql: "EXISTS (SELECT 1 FROM contact_inquiries WHERE id = ?6)", params: [key] },
    ),
    stmt("SELECT id FROM contact_inquiries WHERE id = ?1", key),
  ];
}

export async function replyToContactInquiry(
  deps: AdminDeps,
  input: InquiryReplyInput,
): Promise<AdminWriteResult & { store: WriteSource; matched: boolean | null }> {
  const { id, env, response, status } = checkInquiryReply(input);
  const nowMs = now(deps);
  const source = sourceOf(await gateOf(deps, env), "contact");
  log(deps, `contact inquiry ${id} (${DATA_ENV_OF[env]}): source ${source}`);
  if (source === "supabase") {
    const request = inquiryReplyRequest(id, response, status, nowMs);
    await runRest(deps, request);
    return { plans: [{ store: "supabase", request }], dryRun: Boolean(deps.dryRun), store: source, matched: null };
  }
  const statements = inquiryReplyStatements(id, response, status, nowMs);
  const results = await runD1(deps, env, statements);
  return {
    plans: [{ store: "d1", env, statements }],
    dryRun: Boolean(deps.dryRun),
    store: source,
    matched: deps.dryRun ? null : (results[2]?.length ?? 0) > 0,
  };
}

// ------------------------------------------------------------------------------------------- 2. nickname pools

export const NICKNAME_POOLS_TABLE = "profile_character_nickname_pools";

/** Today's rows (nicknamePoolRowsFromPools + updated_at), checked as profile_nickname_list_is_valid does. */
export function nicknamePoolRows(pools: ProfileNicknamePools, nowMs: number) {
  const updatedAt = new Date(nowMs).toISOString();
  const rows = nicknamePoolRowsFromPools(pools).map((row) => ({ ...row, updated_at: updatedAt }));
  for (const row of rows) {
    if (!isValidNicknameList(row.nicknames)) throw new AdminInputError(`invalid nickname list for ${row.character_id}/${row.locale}`);
  }
  return rows;
}

/** Today's upsert: one POST of the ten rows, merged on (character_id, locale). */
export function nicknamePoolRequest(rows: ReturnType<typeof nicknamePoolRows>): RestRequest {
  return {
    method: "POST",
    path: NICKNAME_POOLS_TABLE,
    query: { on_conflict: "character_id,locale" },
    body: rows,
    prefer: ["resolution=merge-duplicates"],
  };
}

/** The rows as the sync would write them; with the outbox rows on production only. */
export function nicknamePoolStatements(rows: ReturnType<typeof nicknamePoolRows>, nowMs: number, withOutbox: boolean): D1Statement[] {
  const statements: D1Statement[] = [];
  for (const row of rows) {
    statements.push(...mapped(mapRow(NICKNAME_POOLS_TABLE, { ...row, updated_at: tsFromMs(Date.parse(row.updated_at)) }, { nowMs })));
    if (withOutbox) {
      statements.push(outboxStatement(
        { table: NICKNAME_POOLS_TABLE, op: "upsert", match: { character_id: row.character_id, locale: row.locale }, payload: readPayload(NICKNAME_POOLS_TABLE) },
        nowMs,
      ));
    }
  }
  return statements;
}

export async function saveProfileNicknamePools(
  deps: AdminDeps,
  pools: ProfileNicknamePools,
): Promise<AdminWriteResult & { sources: Record<D1EnvName, WriteSource> }> {
  const nowMs = now(deps);
  const rows = nicknamePoolRows(pools, nowMs);
  const sources = {} as Record<D1EnvName, WriteSource>;
  for (const env of D1_ENVS) sources[env] = sourceOf(await gateOf(deps, env), "profile");
  log(deps, `nickname pools: production source ${sources.production}, testbed source ${sources.testbed}`);
  const plans: AdminPlan[] = [];
  if (sources.testbed === "d1") {
    const statements = nicknamePoolStatements(rows, nowMs, false);
    plans.push({ store: "d1", env: "testbed", statements });
  }
  if (sources.production === "d1") {
    plans.push({ store: "d1", env: "production", statements: nicknamePoolStatements(rows, nowMs, true) });
  } else {
    plans.push({ store: "supabase", request: nicknamePoolRequest(rows) });
  }
  for (const plan of plans) {
    if (plan.store === "d1") await runD1(deps, plan.env, plan.statements);
    else if (plan.store === "supabase") await runRest(deps, plan.request);
  }
  return { plans, dryRun: Boolean(deps.dryRun), sources };
}

// ------------------------------------------------------------------------------------------- 3. philosopher post

export const PHILOSOPHER_POSTS_TABLE = "colorful_philosopher_posts";
export const PHILOSOPHER_SELECT =
  "id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version, buff_count, nerf_count, rework_count";

export interface PhilosopherPostRow {
  week_start: string;
  slot: string;
  resource_type: string;
  resource_id: string;
  name_ko: string;
  name_en: string;
  image_url: string | null;
  body: string;
  game_version: string;
}

const PHILOSOPHER_FIELDS = ["resource_type", "resource_id", "name_ko", "name_en", "image_url", "body", "game_version"] as const;

/** Today's upsert (onConflict env,week_start,slot) returning the saved row (.select(...).single()). */
export function philosopherPostRequest(dataEnv: DataEnv, row: PhilosopherPostRow): RestRequest {
  return {
    method: "POST",
    path: PHILOSOPHER_POSTS_TABLE,
    query: { on_conflict: "env,week_start,slot", select: PHILOSOPHER_SELECT.replace(/ /g, "") },
    body: { env: dataEnv, ...row },
    prefer: ["resolution=merge-duplicates", "return=representation"],
    accept: "application/vnd.pgrst.object+json",
  };
}

/**
 * The same upsert on D1: a new week keeps the given id and created_at; an existing (week_start, slot)
 * keeps its id and created_at, as Supabase's ON CONFLICT does. The outbox row mirrors the week's row.
 */
export function philosopherPostStatements(row: PhilosopherPostRow, id: string, nowMs: number): D1Statement[] {
  return [
    stmt(
      "INSERT INTO colorful_philosopher_posts (id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version, created_at) " +
        "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT (week_start, slot) DO UPDATE SET " +
        PHILOSOPHER_FIELDS.map((name) => `${name} = excluded.${name}`).join(", "),
      id,
      row.week_start,
      row.slot,
      row.resource_type,
      row.resource_id,
      row.name_ko,
      row.name_en,
      row.image_url,
      row.body,
      row.game_version,
      tsFromMs(nowMs),
    ),
    outboxStatement(
      { table: PHILOSOPHER_POSTS_TABLE, op: "upsert", match: { week_start: row.week_start, slot: row.slot }, payload: readPayload(PHILOSOPHER_POSTS_TABLE) },
      nowMs,
    ),
    stmt(
      "SELECT id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version FROM colorful_philosopher_posts " +
        "WHERE week_start = ?1 AND slot = ?2",
      row.week_start,
      row.slot,
    ),
  ];
}

export async function saveColorfulPhilosopherPostRow(
  deps: AdminDeps,
  dataEnv: string,
  row: PhilosopherPostRow,
): Promise<AdminWriteResult & { store: WriteSource; saved: Record<string, unknown> | null }> {
  const env = d1EnvOf(dataEnv);
  if (!env) throw new AdminInputError("알 수 없는 Supabase 환경입니다.");
  const nowMs = now(deps);
  const source = sourceOf(await gateOf(deps, env), "any");
  log(deps, `colorful philosopher post ${row.week_start} ${row.slot} (${DATA_ENV_OF[env]}): source ${source}`);
  if (source === "supabase") {
    const request = philosopherPostRequest(DATA_ENV_OF[env], row);
    const saved = await runRest(deps, request);
    return {
      plans: [{ store: "supabase", request }],
      dryRun: Boolean(deps.dryRun),
      store: source,
      saved: saved && typeof saved === "object" ? (saved as Record<string, unknown>) : null,
    };
  }
  const statements = philosopherPostStatements(row, uuid(deps), nowMs);
  const results = await runD1(deps, env, statements);
  return { plans: [{ store: "d1", env, statements }], dryRun: Boolean(deps.dryRun), store: source, saved: results[2]?.[0] ?? null };
}

// ------------------------------------------------------------------------------------------- 4. builtin tournaments

export const TOURNAMENT_POSTS_TABLE = "favorite_tournament_posts";

/** One seed row as scripts/seed-favorite-tournament-builtins.ts builds it. */
export interface BuiltinTournamentRow {
  nickname: string;
  title: string;
  note: string;
  preset_key: string;
  game_version: string;
  pool: Array<{ type: string; id: string }>;
  env: string;
  created_at: string;
}

/** Today's seed SQL, unchanged (run with `supabase db query --linked -f`). */
export function builtinSeedSql(rows: readonly BuiltinTournamentRow[], tag: string): string {
  return `
insert into public.favorite_tournament_posts (
  user_id,
  nickname,
  title,
  note,
  preset_key,
  game_version,
  pool,
  env,
  created_at
)
select
  null,
  x.nickname,
  x.title,
  x.note,
  x.preset_key,
  x.game_version,
  x.pool,
  x.env,
  x.created_at
from jsonb_to_recordset($${tag}$${JSON.stringify(rows)}$${tag}$::jsonb) as x(
  nickname text,
  title text,
  note text,
  preset_key text,
  game_version text,
  pool jsonb,
  env text,
  created_at timestamptz
)
on conflict (env, preset_key) where (preset_key like 'builtin:%')
do update set
  nickname = excluded.nickname,
  title = excluded.title,
  note = excluded.note,
  pool = excluded.pool,
  game_version = excluded.game_version;
`;
}

/** The builtin posts D1 already has, by preset key (Postgres LIKE 'builtin:%' as the schema writes it). */
export const BUILTIN_IDS_SQL =
  "SELECT post_id, preset_key FROM post_favorite_tournament WHERE service = 'favorite_tournament' AND substr(preset_key, 1, 8) = 'builtin:'";

/** favorite_tournament_posts_game_version_check, which D1 does not keep (handlers/toybox.ts supabaseOnlyCheck). */
function checkBuiltinRow(row: BuiltinTournamentRow) {
  const length = Array.from(row.game_version ?? "").length;
  if (length < 1 || length > 32) throw new AdminInputError(`${row.preset_key}: game_version must be 1..32 characters`);
  if (!Array.isArray(row.pool)) throw new AdminInputError(`${row.preset_key}: pool must be an array`);
  if (!row.preset_key.startsWith("builtin:")) throw new AdminInputError(`${row.preset_key}: not a builtin preset key`);
}

export const BUILTIN_UPDATE_COLUMNS = ["nickname", "title", "note", "pool"] as const;

/**
 * One seed row on D1. An existing builtin gets the seed's conflict update (nickname, title, note,
 * pool, game_version) as the sync would apply that Supabase UPDATE, and an outbox update of the same
 * columns. A new builtin is inserted whole (no owner, no author token, zero counts, the seed's
 * created_at) with an outbox insert.
 */
export function builtinTournamentStatements(row: BuiltinTournamentRow, existingId: string | null, newId: string, nowMs: number): D1Statement[] {
  checkBuiltinRow(row);
  const id = existingId ?? newId;
  const extra = { game_version: row.game_version };
  const guard = { sql: "EXISTS (SELECT 1 FROM posts WHERE service = 'favorite_tournament' AND id = ?6)", params: [id] };
  if (existingId) {
    return [
      ...mappedUpdate(TOURNAMENT_POSTS_TABLE, { id, nickname: row.nickname, title: row.title, note: row.note, pool: row.pool, game_version: row.game_version }, nowMs),
      outboxStatement({ table: TOURNAMENT_POSTS_TABLE, op: "update", match: { id }, payload: { read: "posts", columns: [...BUILTIN_UPDATE_COLUMNS], extra } }, nowMs, guard),
    ];
  }
  const image: RowImage = {
    id,
    user_id: null,
    nickname: row.nickname,
    avatar_id: null,
    avatar_kind: null,
    palette_id: null,
    palette_swapped: false,
    like_count: 0,
    comment_count: 0,
    created_at: row.created_at,
    title: row.title,
    note: row.note,
    preset_key: row.preset_key,
    play_count: 0,
    pool: row.pool,
    game_version: row.game_version,
  };
  return [
    ...mapped(mapRow(TOURNAMENT_POSTS_TABLE, image, { nowMs })),
    outboxStatement({ table: TOURNAMENT_POSTS_TABLE, op: "insert", match: { id }, payload: readPayload("posts", extra) }, nowMs, guard),
  ];
}

export async function seedBuiltinTournaments(
  deps: AdminDeps,
  rows: readonly BuiltinTournamentRow[],
  tag: string,
): Promise<AdminWriteResult & { sources: Partial<Record<string, WriteSource>> }> {
  const nowMs = now(deps);
  const dataEnvs = [...new Set(rows.map((row) => row.env))];
  const sources: Partial<Record<string, WriteSource>> = {};
  const viaSupabase: BuiltinTournamentRow[] = [];
  const viaD1 = new Map<D1EnvName, BuiltinTournamentRow[]>();
  for (const dataEnv of dataEnvs) {
    const env = d1EnvOf(dataEnv);
    if (!env) throw new AdminInputError(`unknown env ${dataEnv} (production or development)`);
    const source = sourceOf(await gateOf(deps, env), "toybox-feed");
    sources[dataEnv] = source;
    log(deps, `builtin worldcups (${dataEnv}): source ${source}`);
    const own = rows.filter((row) => row.env === dataEnv);
    if (source === "supabase") viaSupabase.push(...own);
    else viaD1.set(env, own);
  }
  const plans: AdminPlan[] = [];
  for (const [env, own] of viaD1) {
    // A read: allowed in a dry run too.
    const [existing] = await deps.d1(env).run([stmt(BUILTIN_IDS_SQL)]);
    const ids = new Map((existing ?? []).map((entry) => [String(entry.preset_key), String(entry.post_id)]));
    const groups = own.map((row) => builtinTournamentStatements(row, ids.get(row.preset_key) ?? null, uuid(deps), nowMs));
    log(deps, `  ${D1_DATABASES[env]}: ${own.filter((row) => ids.has(row.preset_key)).length} updated, ${own.filter((row) => !ids.has(row.preset_key)).length} new`);
    for (const statements of packCalls(groups)) {
      plans.push({ store: "d1", env, statements });
      await runD1(deps, env, statements);
    }
  }
  if (viaSupabase.length) {
    // Exactly today's statement when every env is on Supabase (the rows of both envs together).
    const sql = builtinSeedSql(viaSupabase, tag);
    plans.push({ store: "supabase-sql", sql });
    await runSupabaseSql(deps, sql);
  }
  return { plans, dryRun: Boolean(deps.dryRun), sources };
}

// ------------------------------------------------------------------------------------------- 5. story patch line relink

export interface StoryRelinkInput {
  oldId: string;
  newId: string;
  entityType: string;
  entityId: string;
}

function sqlText(value: string): string {
  if (value.includes("\u0000")) throw new AdminInputError("NUL in a value");
  return `'${value.replace(/'/g, "''")}'`;
}

const RELINK_FLAGS: Record<keyof StoryRelinkInput, string> = { oldId: "--old", newId: "--new", entityType: "--entity-type", entityId: "--entity-id" };

function checkRelink(input: StoryRelinkInput): StoryRelinkInput {
  for (const name of Object.keys(RELINK_FLAGS) as Array<keyof StoryRelinkInput>) {
    const value = input[name];
    if (typeof value !== "string" || !value.trim() || value.length > 200) throw new AdminInputError(`${RELINK_FLAGS[name]} is required (1..200 characters)`);
  }
  if (input.oldId === input.newId) throw new AdminInputError("the old and the new patch line id are the same");
  return input;
}

/** The skill's SELECT (Step 4.1), on Supabase; `env` narrows it when the envs' sources differ. */
export function storyFindSql(oldId: string, env?: DataEnv): string {
  return `SELECT id, sentence, patch_line_id FROM public.community_stories WHERE patch_line_id = ${sqlText(oldId)}${env ? ` AND env = ${sqlText(env)}` : ""};`;
}

/** The skill's UPDATE (Step 4.2), on Supabase; `env` narrows it when the envs' sources differ. */
export function storyRelinkSql(input: StoryRelinkInput, env?: DataEnv): string {
  return (
    `UPDATE public.community_stories SET patch_line_id = ${sqlText(input.newId)}, entity_type = ${sqlText(input.entityType)}, ` +
    `entity_id = ${sqlText(input.entityId)} WHERE patch_line_id = ${sqlText(input.oldId)}${env ? ` AND env = ${sqlText(env)}` : ""};`
  );
}

export const STORY_RELINK_COLUMNS = ["patch_line_id", "entity_type", "entity_id"] as const;

/**
 * The same UPDATE on D1: one outbox update per story it is about to change (read before the UPDATE in
 * the same call, as handlers/stories-contact.ts markRepliesSeen does), then the UPDATE.
 */
export function storyRelinkStatements(input: StoryRelinkInput, nowMs: number): D1Statement[] {
  mirrorTable("community_stories");
  return [
    stmt(
      "INSERT INTO outbox (table_name, op, match_key, payload, created_at) " +
        "SELECT 'community_stories', 'update', json_object('id', id), ?2, ?3 FROM community_stories WHERE patch_line_id = ?1 ORDER BY id",
      input.oldId,
      JSON.stringify({ read: "community_stories", columns: [...STORY_RELINK_COLUMNS] }),
      nowMs,
    ),
    stmt(
      "UPDATE community_stories SET patch_line_id = ?2, entity_type = ?3, entity_id = ?4 WHERE patch_line_id = ?1",
      input.oldId,
      input.newId,
      input.entityType,
      input.entityId,
    ),
    stmt("SELECT id, sentence, patch_line_id FROM community_stories WHERE patch_line_id = ?1 ORDER BY id", input.newId),
  ];
}

async function storySources(deps: AdminDeps): Promise<Record<D1EnvName, WriteSource>> {
  const sources = {} as Record<D1EnvName, WriteSource>;
  for (const env of D1_ENVS) sources[env] = sourceOf(await gateOf(deps, env), "stories");
  log(deps, `community_stories: production source ${sources.production}, testbed source ${sources.testbed}`);
  return sources;
}

/** Step 4.1: the stories that point at the old id, from each env's source. Supabase rows print through the CLI. */
export async function findStoriesByPatchLine(deps: AdminDeps, oldId: string): Promise<Record<string, unknown>[]> {
  if (!oldId.trim()) throw new AdminInputError("--old is required");
  const sources = await storySources(deps);
  const found: Record<string, unknown>[] = [];
  const supabaseEnvs = D1_ENVS.filter((env) => sources[env] === "supabase");
  for (const env of D1_ENVS.filter((name) => sources[name] === "d1")) {
    const [rows] = await deps.d1(env).run([stmt("SELECT id, sentence, patch_line_id FROM community_stories WHERE patch_line_id = ?1 ORDER BY id", oldId)]);
    for (const row of rows ?? []) found.push({ ...row, env: DATA_ENV_OF[env] });
  }
  if (supabaseEnvs.length === D1_ENVS.length) {
    await runSupabaseQuery(deps, storyFindSql(oldId));
  } else {
    for (const env of supabaseEnvs) await runSupabaseQuery(deps, storyFindSql(oldId, DATA_ENV_OF[env]));
  }
  return found;
}

/** A read on the linked project: runs in a dry run too (it changes nothing). */
async function runSupabaseQuery(deps: AdminDeps, sql: string) {
  if (!deps.supabaseSql) throw new AdminWriteError("no Supabase CLI runner");
  await deps.supabaseSql(sql);
}

/** Step 4.2: point the stories at the new id and entity in each env's source. */
export async function relinkStoryPatchLine(deps: AdminDeps, input: StoryRelinkInput): Promise<AdminWriteResult & { relinked: Record<string, unknown>[] }> {
  checkRelink(input);
  const nowMs = now(deps);
  const sources = await storySources(deps);
  const plans: AdminPlan[] = [];
  const relinked: Record<string, unknown>[] = [];
  const supabaseEnvs = D1_ENVS.filter((env) => sources[env] === "supabase");
  for (const env of D1_ENVS.filter((name) => sources[name] === "d1")) {
    const statements = storyRelinkStatements(input, nowMs);
    plans.push({ store: "d1", env, statements });
    const results = await runD1(deps, env, statements);
    for (const row of results[2] ?? []) relinked.push({ ...row, env: DATA_ENV_OF[env] });
  }
  if (supabaseEnvs.length === D1_ENVS.length) {
    const sql = storyRelinkSql(input);
    plans.push({ store: "supabase-sql", sql });
    await runSupabaseSql(deps, sql);
  } else {
    for (const env of supabaseEnvs) {
      const sql = storyRelinkSql(input, DATA_ENV_OF[env]);
      plans.push({ store: "supabase-sql", sql });
      await runSupabaseSql(deps, sql);
    }
  }
  return { plans, dryRun: Boolean(deps.dryRun), relinked };
}
