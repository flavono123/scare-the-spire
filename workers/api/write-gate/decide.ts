import {
  ACTOR_RPCS,
  CONTACT_RATE_LIMIT,
  DEFRAGMENT_SOURCE_TABLES,
  TABLE_RULES,
  type TableRule,
} from "./rules";

/**
 * Decides a user's PostgREST write the way Supabase decides it today for that
 * user's token (RLS policies, role-guarded triggers, grants), and rewrites it
 * into the request the Worker sends with the service key
 * (docs/supabase-exit/STEP4_WRITE_GATE.md 3). Pure apart from `lookups`, which
 * read Supabase with the service key where a policy reads other rows.
 *
 * The answers keep PostgREST's codes and statuses, so the step 1 handlers map
 * them to the same API errors as today: 42501 (403) for a policy or grant
 * refusal, P0001 (400) for the inquiry rate limit, and an empty result where
 * RLS hides every row.
 */

export type GateMethod = "GET" | "HEAD" | "POST" | "PATCH" | "DELETE";

export type GateWrite = {
  method: GateMethod;
  /** `table` or `rpc/function`. */
  path: string;
  query: URLSearchParams;
  prefer: readonly string[];
  /** The parsed JSON body; undefined when there is none. */
  body: unknown;
};

export type Row = Record<string, unknown>;

export type LookupResult<T> = { ok: true; value: T } | { ok: false; status: number; code: string };

export type GateLookups = {
  /** Rows of `table` matching PostgREST `filters` ([column, "op.value"]), read as the service role. */
  rows(table: string, select: string, filters: readonly [string, string][], limit: number): Promise<LookupResult<Row[]>>;
  /** How many rows match, read as the service role. */
  count(table: string, filters: readonly [string, string][]): Promise<LookupResult<number>>;
};

export type GateDecision =
  | { kind: "send"; write: GateWrite }
  /** RLS would hide every target row: answer like PostgREST with no rows, without calling it. */
  | { kind: "empty"; representation: boolean }
  | { kind: "reject"; status: number; code: string };

const RESERVED_QUERY = new Set(["select", "columns", "on_conflict", "order", "limit", "offset"]);
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

const reject = (status: number, code: string): GateDecision => ({ kind: "reject", status, code });
/** An RLS or grant refusal of an authenticated user: PostgREST answers 403 with 42501. */
const forbidden = (): GateDecision => reject(403, "42501");
/** A request this gate does not know; never sent with the service key. */
const unsupported = (): GateDecision => reject(500, "gate_unsupported");
/** A payload key that cannot be a column (they are all lower snake case): PostgREST's answer. */
const unknownColumn = (): GateDecision => reject(400, "PGRST204");

function isPlainObject(value: unknown): value is Row {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function preferValue(prefer: readonly string[], name: string): string | null {
  for (const entry of prefer) {
    for (const part of entry.split(",")) {
      const [key, value] = part.trim().split("=");
      if (key === name) return value ?? "";
    }
  }
  return null;
}

/** Filter columns of the query (`col=op.value`); null when a logical filter (or, and, not) is present. */
function filterColumns(query: URLSearchParams): string[] | null {
  const columns: string[] = [];
  for (const key of query.keys()) {
    if (RESERVED_QUERY.has(key)) continue;
    if (!IDENTIFIER.test(key) || key === "or" || key === "and" || key === "not") return null;
    columns.push(key);
  }
  return columns;
}

/** Columns a select list names; null for `*`, embeddings, casts or aliases. */
function selectColumns(query: URLSearchParams): string[] | null {
  const select = query.get("select");
  if (select === null) return null;
  const columns = select.replace(/\s+/g, "").split(",");
  return columns.every((column) => IDENTIFIER.test(column)) ? columns : null;
}

/**
 * Postgres uuid input (uuid.c string_to_uuid): 32 hex digits, optionally in one pair of braces, with
 * at most one hyphen after each group of four digits but the last. Anything else fails the cast.
 */
function uuidHex(value: string): string | null {
  const braces = value.startsWith("{");
  let at = braces ? 1 : 0;
  let hex = "";
  for (let byte = 0; byte < 16; byte += 1) {
    const pair = value.slice(at, at + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(pair)) return null;
    hex += pair;
    at += 2;
    if (value[at] === "-" && byte % 2 === 1 && byte < 15) at += 1;
  }
  if (braces) {
    if (value[at] !== "}") return null;
    at += 1;
  }
  return at === value.length ? hex.toLowerCase() : null;
}

/**
 * How a payload's owner value compares with auth.uid(). "invalid" values cannot
 * be cast to uuid, so Postgres refuses the row (22P02) before any policy runs;
 * they are sent as they are and fail the same way.
 */
export function ownerState(value: unknown, actor: string): "match" | "other" | "invalid" {
  if (value === null || value === undefined) return "other";
  if (typeof value !== "string") return "invalid";
  const hex = uuidHex(value);
  if (!hex) return "invalid";
  return hex === uuidHex(actor) ? "match" : "other";
}

function withoutKeys(row: Row, keys: readonly string[]): Row {
  // fromEntries defines own properties, so a "__proto__" key stays a key (PostgREST refuses it) instead of
  // an assignment that would drop it and let the row through.
  return Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
}

function valueOf(row: Row, column: string, rule: TableRule): unknown {
  if (Object.hasOwn(row, column)) return row[column];
  return rule.defaults?.[column] ?? null;
}

const eq = (value: unknown): string => `eq.${String(value)}`;

/** Postgres btrim(text) with the default characters: spaces only. */
function btrimSpaces(value: string): string {
  return value.replace(/^ +| +$/g, "");
}

// --- Insert checks of the policies ----------------------------------------------------------

async function insertCheck(rule: TableRule, row: Row, actor: string, lookups: GateLookups): Promise<LookupResult<boolean>> {
  switch (rule.insertCheck) {
    case undefined:
      return { ok: true, value: true };
    case "not_builtin_preset": {
      // preset_key !~~ 'builtin:%': NULL is not true, and LIKE is case-sensitive. A JSON number, boolean,
      // object or array lands in the text column as its JSON text, which never starts with "builtin:".
      const key = valueOf(row, "preset_key", rule);
      return { ok: true, value: key !== null && !(typeof key === "string" && key.startsWith("builtin:")) };
    }
    case "vote_post_same_env": {
      // EXISTS (posts.id = post_id AND posts.env = env), read past RLS like the policy's subquery.
      const postId = valueOf(row, "post_id", rule);
      if (typeof postId !== "string" || postId === "") return { ok: true, value: false };
      const found = await lookups.rows("this_or_that_posts", "id", [["id", eq(postId)], ["env", eq(valueOf(row, "env", rule))]], 1);
      return found.ok ? { ok: true, value: found.value.length > 0 } : found;
    }
    case "defragment_source_owned": {
      const table = DEFRAGMENT_SOURCE_TABLES[String(valueOf(row, "source_service", rule))];
      const sourceId = valueOf(row, "source_id", rule);
      if (!table || typeof sourceId !== "string") return { ok: true, value: false };
      const found = await lookups.rows(table, "id", [["id", eq(sourceId)], ["env", eq(valueOf(row, "env", rule))], ["user_id", eq(actor)]], 1);
      return found.ok ? { ok: true, value: found.value.length > 0 } : found;
    }
  }
}

// --- Insert and upsert ------------------------------------------------------------------------

async function decideInsert(table: string, rule: TableRule, write: GateWrite, actor: string, lookups: GateLookups, now: number): Promise<GateDecision> {
  const single = !Array.isArray(write.body);
  const rows = single ? [write.body] : (write.body as unknown[]);
  if (!rows.every(isPlainObject)) return reject(400, "PGRST102");
  const keys = [...new Set((rows as Row[]).flatMap((row) => Object.keys(row)))];
  if (!keys.every((key) => IDENTIFIER.test(key))) return unknownColumn();

  const resolution = preferValue(write.prefer, "resolution");
  const onConflict = write.query.get("on_conflict");
  const conflict = onConflict === null ? null : onConflict.split(",");
  if (conflict && !conflict.every((column) => IDENTIFIER.test(column))) return unsupported();
  const merge = conflict !== null && resolution === "merge-duplicates";
  if (conflict !== null && !merge && resolution !== "ignore-duplicates") return unsupported();
  if (write.query.has("columns")) return unsupported();
  const representation = preferValue(write.prefer, "return") === "representation";

  // Grants are checked before anything runs.
  if (rule.grants?.insert && !keys.every((key) => rule.grants?.insert?.includes(key))) return forbidden();
  if (merge && rule.grants?.update && !keys.every((key) => rule.grants?.update?.includes(key))) return forbidden();
  if (representation && rule.grants?.select) {
    // RETURNING needs SELECT on the returned columns (all of them for `*`).
    const returned = selectColumns(write.query);
    if (!returned || !returned.every((column) => rule.grants?.select?.includes(column))) return forbidden();
  }

  // PostgREST reads the whole payload into rows before any trigger or policy runs: an owner that is no
  // uuid fails that cast (22P02) for the statement, so it goes out as it came and fails the same way.
  if ((rows as Row[]).some((row) => ownerState(row[rule.owner], actor) === "invalid")) return { kind: "send", write };

  const out: Row[] = [];
  for (const [index, original] of (rows as Row[]).entries()) {
    let row = original;
    // BEFORE triggers run first: the inquiry trigger refuses another user, then trims and counts.
    if (rule.contactTrigger) {
      // contact_inquiry_user_mismatch (42501); a value that is not a uuid fails its cast first.
      if (ownerState(row[rule.owner], actor) === "other") return forbidden();
      row = { ...row };
      if (typeof row.message === "string") row.message = btrimSpaces(row.message);
      if (typeof row.reply_email === "string") {
        const email = btrimSpaces(row.reply_email).toLowerCase();
        row.reply_email = email === "" ? null : email;
      }
      const recent = await lookups.count("contact_inquiries", [
        ["user_id", eq(actor)],
        ["env", eq(valueOf(row, "env", rule))],
        ["created_at", `gt.${new Date(now - CONTACT_RATE_LIMIT.windowMs).toISOString()}`],
      ]);
      if (!recent.ok) return reject(recent.status, recent.code);
      if (recent.value + index >= CONTACT_RATE_LIMIT.count) return reject(400, "P0001");
    }

    // Then the insert policy (before CHECK constraints, which Supabase still runs).
    const owner = ownerState(row[rule.owner], actor);
    let passes = rule.policies.insert && owner !== "other";
    if (passes && owner === "match") {
      const check = await insertCheck(rule, row, actor, lookups);
      if (!check.ok) return reject(check.status, check.code);
      passes = check.value;
    }

    // The proposed row is checked before conflicts are looked at, so a row that would be skipped
    // by ON CONFLICT DO NOTHING still fails the statement (checked on PGlite).
    if (!passes) return forbidden();

    if (merge && owner === "match") {
      // ON CONFLICT DO UPDATE: the existing row must pass the update policy's USING, or the statement fails.
      const filters = (conflict ?? []).map((column) => [column, eq(valueOf(row, column, rule))] as [string, string]);
      const found = await lookups.rows(table, rule.owner, filters, 1);
      if (!found.ok) return reject(found.status, found.code);
      const existing = found.value[0];
      if (existing && (!rule.policies.update || ownerState(existing[rule.owner], actor) !== "match")) return forbidden();
    }

    out.push(rule.guard ? withoutKeys(row, rule.guard.insert) : row);
  }

  return { kind: "send", write: { ...write, body: single ? out[0] : out } };
}

// --- Update -------------------------------------------------------------------------------------

async function decideUpdate(table: string, rule: TableRule, write: GateWrite, actor: string, lookups: GateLookups): Promise<GateDecision> {
  if (!isPlainObject(write.body)) return reject(400, "PGRST102");
  const keys = Object.keys(write.body);
  if (!keys.every((key) => IDENTIFIER.test(key))) return unknownColumn();
  if (write.query.has("columns") || write.query.has("on_conflict")) return unsupported();
  const representation = preferValue(write.prefer, "return") === "representation";
  const filters = filterColumns(write.query);
  if (!filters) return unsupported();

  if (rule.grants?.update && !keys.every((key) => rule.grants?.update?.includes(key))) return forbidden();
  if (rule.grants?.select) {
    // Filters and returned columns need SELECT on those columns.
    if (!filters.every((column) => rule.grants?.select?.includes(column))) return forbidden();
    if (representation) {
      const returned = selectColumns(write.query);
      if (!returned || !returned.every((column) => rule.grants?.select?.includes(column))) return forbidden();
    }
  }
  // No update policy: RLS hides every row from UPDATE.
  if (!rule.policies.update) return { kind: "empty", representation };
  // The update policy's WITH CHECK on the new row also reads other tables here; no route updates this way.
  if (rule.insertCheck === "defragment_source_owned") return unsupported();

  const query = new URLSearchParams(write.query);
  query.append(rule.owner, eq(actor));
  const owner = Object.hasOwn(write.body, rule.owner) ? ownerState(write.body[rule.owner], actor) : "match";
  if (owner === "other") {
    // WITH CHECK fails only when a visible row would be updated; otherwise nothing happens.
    const matching = [...query].filter(([key]) => !RESERVED_QUERY.has(key)) as [string, string][];
    const found = await lookups.rows(table, rule.owner, matching, 1);
    if (!found.ok) return reject(found.status, found.code);
    return found.value.length > 0 ? forbidden() : { kind: "empty", representation };
  }

  let body = rule.guard ? withoutKeys(write.body, rule.guard.update) : write.body;
  // Only guarded columns: the row is still "updated" (and returned) with nothing changed.
  if (Object.keys(body).length === 0 && keys.length > 0) body = { [rule.owner]: actor };
  return { kind: "send", write: { ...write, query, body } };
}

// --- Delete -------------------------------------------------------------------------------------

function decideDelete(rule: TableRule, write: GateWrite, actor: string): GateDecision {
  const representation = preferValue(write.prefer, "return") === "representation";
  const filters = filterColumns(write.query);
  if (!filters) return unsupported();
  if (rule.grants?.delete === false) return forbidden();
  if (rule.grants?.select && !filters.every((column) => rule.grants?.select?.includes(column))) return forbidden();
  if (!rule.policies.delete) return { kind: "empty", representation };
  const query = new URLSearchParams(write.query);
  query.append(rule.owner, eq(actor));
  return { kind: "send", write: { ...write, query } };
}

// --- Entry --------------------------------------------------------------------------------------

export async function decideWrite(write: GateWrite, actor: string, lookups: GateLookups, now = Date.now()): Promise<GateDecision> {
  if (write.path.startsWith("rpc/")) {
    const target = ACTOR_RPCS[write.path.slice(4)];
    if (!target || write.method !== "POST") return unsupported();
    if (!isPlainObject(write.body)) return unsupported();
    // The original functions have no p_actor argument: PostgREST finds no such function.
    if (Object.hasOwn(write.body, "p_actor")) return reject(404, "PGRST202");
    return { kind: "send", write: { ...write, path: `rpc/${target}`, body: { ...write.body, p_actor: actor } } };
  }
  const rule = Object.hasOwn(TABLE_RULES, write.path) ? TABLE_RULES[write.path] : undefined;
  if (!rule) return unsupported();
  switch (write.method) {
    case "POST":
      return decideInsert(write.path, rule, write, actor, lookups, now);
    case "PATCH":
      return decideUpdate(write.path, rule, write, actor, lookups);
    case "DELETE":
      return decideDelete(rule, write, actor);
    default:
      // No write route reads with the user's identity.
      return unsupported();
  }
}
