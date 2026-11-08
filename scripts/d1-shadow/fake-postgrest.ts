/**
 * A PostgREST stand-in over PGlite for the shadow-read specs: it answers the exact requests the
 * step-1 routes send (select lists with the two embeds they use, eq/neq/gt/gte/lt/lte/like/in/is
 * filters, or=(...), order, limit, HEAD count=exact, and the RPCs) by running the equivalent SQL as
 * anon or authenticated (RLS applies) and returning json_agg's text, as PostgREST does. Tokens are
 * test strings mapped to user ids; nothing leaves the process.
 */
import type { PGlite } from "@electric-sql/pglite";

type Fetch = (input: Request | string | URL, init?: RequestInit) => Promise<Response>;

export const TEST_SUPABASE_URL = "http://127.0.0.1:54321";

/** The access token the specs pass for a user id. */
export function testToken(userId: string): string {
  return `test-token:${userId}`;
}

function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`bad identifier ${name}`);
  return `"${name}"`;
}

/** Splits on commas outside parentheses and double quotes. */
function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "(") depth += 1;
    if (!quoted && ch === ")") depth -= 1;
    if (!quoted && depth === 0 && ch === ",") {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

function unquote(value: string): string {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

type Embed = { alias: string; kind: "count" | "inner"; table: string; on: string; cols: string[] };

// The two embeds the step-1 routes use.
const EMBEDS: Record<string, Record<string, { table: string; on: (main: string, alias: string) => string }>> = {
  comments: { comment_likes: { table: "comment_likes", on: (m, a) => `${a}.comment_id = ${m}.id` } },
  comment_likes: { comments: { table: "comments", on: (m, a) => `${a}.id = ${m}.comment_id` } },
};

function column(ref: string, embeds: Map<string, Embed>): string {
  const [first, second] = ref.split(".");
  if (second !== undefined) {
    const embed = embeds.get(first);
    if (!embed) throw new Error(`filter on unknown embed ${first}`);
    return `${embed.alias}.${ident(second)}`;
  }
  return `m.${ident(first)}`;
}

function condition(ref: string, expression: string, embeds: Map<string, Embed>): string {
  const target = column(ref, embeds);
  if (expression === "is.null") return `${target} is null`;
  if (expression === "not.is.null") return `${target} is not null`;
  const dot = expression.indexOf(".");
  const op = expression.slice(0, dot);
  const value = expression.slice(dot + 1);
  switch (op) {
    case "eq": return `${target} = ${lit(unquote(value))}`;
    case "neq": return `${target} <> ${lit(unquote(value))}`;
    case "gt": return `${target} > ${lit(unquote(value))}`;
    case "gte": return `${target} >= ${lit(unquote(value))}`;
    case "lt": return `${target} < ${lit(unquote(value))}`;
    case "lte": return `${target} <= ${lit(unquote(value))}`;
    case "like": return `${target} like ${lit(unquote(value).replace(/\*/g, "%"))}`;
    case "in": {
      const inner = value.replace(/^\(/, "").replace(/\)$/, "");
      const items = splitTop(inner).map((item) => lit(unquote(item)));
      return items.length ? `${target} in (${items.join(", ")})` : "false";
    }
    default: throw new Error(`unsupported operator ${op}`);
  }
}

/** or=(a.lt.x,and(b.eq.x,c.lt.y)) */
function logical(text: string, joiner: "or" | "and", embeds: Map<string, Embed>): string {
  const inner = text.replace(/^\(/, "").replace(/\)$/, "");
  const parts = splitTop(inner).map((part) => {
    if (part.startsWith("and(")) return logical(part.slice(3), "and", embeds);
    if (part.startsWith("or(")) return logical(part.slice(2), "or", embeds);
    const dot = part.indexOf(".");
    return condition(part.slice(0, dot), part.slice(dot + 1), embeds);
  });
  return `(${parts.join(` ${joiner} `)})`;
}

function selectSql(table: string, params: URLSearchParams, countOnly: boolean): string {
  const embeds = new Map<string, Embed>();
  const items: string[] = [];
  for (const item of splitTop(params.get("select") ?? "*")) {
    const embed = /^([a-z_]+)(!inner)?\(([^)]*)\)$/.exec(item);
    if (embed) {
      const spec = EMBEDS[table]?.[embed[1]];
      if (!spec) throw new Error(`unknown embed ${table}.${embed[1]}`);
      const alias = `e${embeds.size}`;
      const cols = embed[3].split(",");
      const kind = embed[2] ? "inner" : cols[0] === "count" ? "count" : "inner";
      embeds.set(embed[1], { alias, kind, table: spec.table, on: spec.on("m", alias), cols });
      if (kind === "count") {
        items.push(`(select json_build_array(json_build_object('count', count(*))) from public.${ident(spec.table)} ${alias} where ${spec.on("m", alias)}) as ${ident(embed[1])}`);
      } else {
        items.push(`json_build_object(${cols.map((name) => `${lit(name)}, ${alias}.${ident(name)}`).join(", ")}) as ${ident(embed[1])}`);
      }
      continue;
    }
    items.push(item === "*" ? "m.*" : `m.${ident(item)}`);
  }
  const joins = [...embeds.values()].filter((embed) => embed.kind === "inner")
    .map((embed) => `join public.${ident(embed.table)} ${embed.alias} on ${embed.on}`);
  const where: string[] = [];
  for (const [key, value] of params) {
    if (key === "select" || key === "order" || key === "limit") continue;
    if (key === "or") where.push(logical(value, "or", embeds));
    else where.push(condition(key, value, embeds));
  }
  const from = `from public.${ident(table)} m ${joins.join(" ")} ${where.length ? `where ${where.join(" and ")}` : ""}`;
  if (countOnly) return `select count(*)::int as n ${from}`;
  const order = (params.get("order") ?? "").split(",").filter(Boolean).map((part) => {
    const [name, direction = "asc", nulls] = part.split(".");
    return `m.${ident(name)} ${direction}${nulls === "nullslast" ? " nulls last" : nulls === "nullsfirst" ? " nulls first" : ""}`;
  });
  const limit = params.get("limit");
  return `select coalesce(json_agg(t), '[]'::json)::text as body from (select ${items.join(", ")} ${from}` +
    `${order.length ? ` order by ${order.join(", ")}` : ""}${limit ? ` limit ${Number(limit)}` : ""}) t`;
}

// Argument types of the RPCs the step-1 routes call (supabase schema); scalar ones return jsonb.
const RPC_ARGS: Record<string, Record<string, string>> = {
  get_engagement_counts: { p_env: "text" },
  get_toybox_feed: {
    p_env: "text", p_service: "text", p_sort: "text", p_limit: "integer", p_cursor_score: "bigint",
    p_cursor_created_at: "timestamptz", p_cursor_id: "uuid",
  },
  get_defragment_feed_v2: {
    p_env: "text", p_sort: "text", p_limit: "integer", p_cursor_score: "bigint", p_cursor_created_at: "timestamptz",
    p_cursor_id: "text",
  },
  get_this_or_that_vote_summaries: { p_post_ids: "uuid[]", p_env: "text" },
  get_my_profile_activity_stats: { p_env: "text" },
  get_my_profile_activity: { p_env: "text", p_category: "text", p_sort: "text", p_limit: "integer", p_offset: "integer" },
  get_puzzlebox_leaderboard: {
    p_env: "text", p_game: "text", p_boards: "jsonb", p_board: "text", p_offset: "integer", p_around_me: "boolean",
  },
  get_my_puzzlebox_standings: { p_env: "text", p_game: "text", p_boards: "jsonb" },
};
const RPC_SCALAR = new Set(["get_puzzlebox_leaderboard", "get_my_puzzlebox_standings"]);

function argument(value: unknown, type: string): string {
  if (value === null || value === undefined) return `null::${type}`;
  if (type === "jsonb") return `${lit(JSON.stringify(value))}::jsonb`;
  if (type.endsWith("[]")) {
    const items = (value as unknown[]).map((item) => lit(String(item)));
    return `array[${items.join(", ")}]::${type}`;
  }
  return `${lit(String(value))}::${type}`;
}

function rpcSql(name: string, body: Record<string, unknown>): string {
  const types = RPC_ARGS[name];
  if (!types) throw new Error(`unknown rpc ${name}`);
  const args = Object.entries(body).map(([key, value]) => {
    if (!(key in types)) throw new Error(`unknown argument ${name}.${key}`);
    return `${ident(key)} => ${argument(value, types[key])}`;
  });
  const call = `public.${ident(name)}(${args.join(", ")})`;
  return RPC_SCALAR.has(name)
    ? `select ${call}::text as body`
    : `select coalesce(json_agg(t), '[]'::json)::text as body from ${call} t`;
}

export type FakePostgrest = {
  fetch: Fetch;
  /** Every request seen, as "METHOD path?query". */
  requests: string[];
};

/** A fetch for TEST_SUPABASE_URL; any other URL is refused (no network in the specs). */
export function fakePostgrest(db: PGlite): FakePostgrest {
  let chain: Promise<unknown> = Promise.resolve();
  const requests: string[] = [];
  const handle = async (url: URL, init: RequestInit): Promise<Response> => {
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    const path = url.pathname.replace(/^\/rest\/v1\//, "");
    requests.push(`${method} ${path}${url.search}`);
    const auth = headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const userId = token.startsWith("test-token:") ? token.slice("test-token:".length) : "";
    const role = userId ? "authenticated" : "anon";
    let sql: string;
    let countOnly = false;
    try {
      if (path.startsWith("rpc/")) {
        sql = rpcSql(path.slice(4), init.body ? JSON.parse(String(init.body)) : {});
      } else {
        countOnly = method === "HEAD";
        sql = selectSql(path, url.searchParams, countOnly);
      }
    } catch (error) {
      return new Response(JSON.stringify({ code: "PGRST100", message: (error as Error).message }), { status: 400 });
    }
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    await db.exec(`set role ${role}`);
    try {
      const result = await db.query<{ body?: string; n?: number }>(sql);
      if (countOnly) {
        const n = result.rows[0]?.n ?? 0;
        return new Response(null, { status: 200, headers: { "content-range": `*/${n}` } });
      }
      return new Response(result.rows[0]?.body ?? "null", { status: 200, headers: { "content-type": "application/json" } });
    } catch (error) {
      const code = String((error as { code?: string }).code ?? "XX000");
      if (process.env.DEBUG_POSTGREST) console.error(`postgrest ${method} ${path}: ${code} ${(error as Error).message}`);
      const status = code === "42501" ? (userId ? 403 : 401) : code.startsWith("22") || code.startsWith("42") ? 400 : 500;
      return new Response(JSON.stringify({ code }), { status, headers: { "content-type": "application/json" } });
    } finally {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', '', false)");
    }
  };
  const fetch: Fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    if (url.origin !== TEST_SUPABASE_URL) throw new Error(`no network in specs: ${url.origin}`);
    // One request at a time: role and claims are session settings.
    const run = chain.then(() => handle(url, init));
    chain = run.catch(() => undefined);
    return run;
  };
  return { fetch, requests };
}
