/**
 * Supabase on PGlite for specs: the public schema rebuilt from the repo's own supabase/*.sql and
 * supabase/migrations/*.sql (never from backup data), stand-ins for the auth schema and API roles,
 * and a small PostgREST that runs each request in one transaction as the role its keys name, so RLS,
 * grants and triggers decide exactly as they do on Supabase. Only the PostgREST features the /api
 * write routes use are here: eq/neq/gt/lt/is/in filters, select lists, on_conflict with both
 * resolutions, return=minimal|representation, HEAD with count=exact, and RPCs with named arguments.
 */
import { readdirSync, readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = "supabase/migrations";

// What Supabase provides before any repo SQL runs (same stand-ins as d1-change-log.spec.ts).
export const SUPABASE_BOOTSTRAP = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role supabase_admin nologin;
create schema auth;
create table auth.users (id uuid primary key, created_at timestamptz default now(), last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create publication supabase_realtime;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

/** The repo's SQL in the order Supabase got it: setup, env, numbered files, then the CLI migrations. */
export function repoSchemaFiles(exclude: (file: string) => boolean = () => false): string[] {
  const top = readdirSync("supabase").filter((file) => /^migration-\d{3}-.*\.sql$/.test(file)).sort();
  const cli = readdirSync(MIGRATIONS).filter((file) => file.endsWith(".sql")).sort();
  return [
    "supabase/setup.sql",
    "supabase/migrate-env.sql",
    ...top.map((file) => `supabase/${file}`),
    ...cli.map((file) => `${MIGRATIONS}/${file}`),
  ].filter((file) => !exclude(file));
}

export async function applySqlFile(db: PGlite, file: string): Promise<void> {
  try {
    await db.exec(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file}: ${(error as Error).message}`);
  }
}

export async function supabaseFromRepo(files: readonly string[]): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP);
  for (const file of files) await applySqlFile(db, file);
  return db;
}

/**
 * A `pg_dump --schema-only` of the live public schema replayed on the same stand-ins (for local
 * checks against a backup; nothing from a backup is committed). The dump sets its own privileges.
 */
export async function supabaseFromDump(dumpFile: string, after: readonly string[] = []): Promise<PGlite> {
  const dump = readFileSync(dumpFile, "utf8")
    .split("\n")
    .filter((line) => !line.startsWith("\\"))
    .join("\n")
    .replace(/^CREATE SCHEMA public;$/m, "");
  const db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP.split("\n").filter((line) => !line.startsWith("alter default privileges")).join("\n"));
  await db.exec(dump);
  // pg_dump turns row_security off and empties search_path for its session; requests need the defaults.
  await db.exec("reset all");
  for (const file of after) await applySqlFile(db, file);
  return db;
}

// --- PostgREST ---------------------------------------------------------------------------------

type Role = "anon" | "authenticated" | "service_role";
type Json = unknown;

const IDENT = /^[a-z_][a-z0-9_]*$/;
const RESERVED = new Set(["select", "columns", "on_conflict", "order", "limit", "offset"]);

function quoteIdent(name: string): string {
  if (!IDENT.test(name)) throw new PgrstError(400, "PGRST100", `bad identifier ${name}`);
  return `"${name}"`;
}

class PgrstError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

function statusFor(code: string, role: Role): number {
  if (code === "42501") return role === "anon" ? 401 : 403;
  if (code === "23505" || code === "23503") return 409;
  if (code === "42883" || code === "42P01" || code === "PGRST202") return 404;
  if (code.startsWith("08") || code.startsWith("53") || code === "57014") return 503;
  if (code.startsWith("54") || code.startsWith("XX")) return 500;
  return 400;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function preferValues(header: string | null): Map<string, string> {
  const values = new Map<string, string>();
  for (const part of (header ?? "").split(",")) {
    const [key, value] = part.trim().split("=");
    if (key) values.set(key, value ?? "");
  }
  return values;
}

/** A PostgREST `in.(a,"b,c")` list. */
function inList(raw: string): string[] {
  const inner = raw.replace(/^\(/, "").replace(/\)$/, "");
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of inner) {
    if (char === "\"") quoted = !quoted;
    else if (char === "," && !quoted) {
      out.push(current);
      current = "";
    } else current += char;
  }
  if (inner.length) out.push(current);
  return out;
}

type Built = { sql: string; params: unknown[] };

export type PgRestOptions = {
  secretKey: string;
  publishableKey: string;
  jwks: unknown;
};

/** One request log entry, for specs that check what the Worker sent. */
export type PgRestCall = { method: string; path: string; search: string; role: Role; sub: string | null; prefer: string | null; body: string };

export class PgRest {
  readonly calls: PgRestCall[] = [];
  private readonly types = new Map<string, Map<string, string>>();
  private readonly functions = new Map<string, { names: string[]; types: string[] }[]>();

  constructor(readonly db: PGlite, readonly options: PgRestOptions) {}

  private async columnTypes(table: string): Promise<Map<string, string>> {
    let types = this.types.get(table);
    if (!types) {
      const { rows } = await this.db.query<{ name: string; type: string }>(
        `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type from pg_attribute a
         where a.attrelid = to_regclass('public.' || $1) and a.attnum > 0 and not a.attisdropped`,
        [table],
      );
      if (rows.length === 0) throw new PgrstError(404, "42P01", `no table ${table}`);
      types = new Map(rows.map((row) => [row.name, row.type]));
      this.types.set(table, types);
    }
    return types;
  }

  private async functionSignatures(name: string) {
    let signatures = this.functions.get(name);
    if (!signatures) {
      const { rows } = await this.db.query<{ names: string[] | null; types: string[] }>(
        `select p.proargnames as names, array(select format_type(t, null) from unnest(p.proargtypes::oid[]) as t) as types
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = $1`,
        [name],
      );
      signatures = rows.map((row) => ({ names: row.names ?? [], types: row.types }));
      this.functions.set(name, signatures);
    }
    return signatures;
  }

  /** PostgREST refuses a payload key that is not a column of the table. */
  private async knownColumns(table: string, columns: readonly string[]): Promise<void> {
    const types = await this.columnTypes(table);
    const unknown = columns.find((column) => !types.has(column));
    if (unknown !== undefined) throw new PgrstError(400, "PGRST204", `no column ${unknown}`);
  }

  private async where(table: string, query: URLSearchParams, params: unknown[], alias: string): Promise<string> {
    const types = await this.columnTypes(table);
    const terms: string[] = [];
    for (const [key, raw] of query) {
      if (RESERVED.has(key)) continue;
      const column = quoteIdent(key);
      const type = types.get(key);
      if (!type) throw new PgrstError(400, "42703", `no column ${key}`);
      const ref = `${alias}.${column}`;
      const bind = (value: unknown, cast = type) => {
        params.push(value);
        return `$${params.length}::${cast}`;
      };
      if (raw === "is.null") terms.push(`${ref} is null`);
      else if (raw === "not.is.null") terms.push(`${ref} is not null`);
      else if (raw === "is.true" || raw === "is.false") terms.push(`${ref} is ${raw.slice(3)}`);
      else if (raw.startsWith("eq.")) terms.push(`${ref} = ${bind(raw.slice(3))}`);
      else if (raw.startsWith("neq.")) terms.push(`${ref} <> ${bind(raw.slice(4))}`);
      else if (raw.startsWith("gt.")) terms.push(`${ref} > ${bind(raw.slice(3))}`);
      else if (raw.startsWith("lt.")) terms.push(`${ref} < ${bind(raw.slice(3))}`);
      else if (raw.startsWith("in.")) terms.push(`${ref} = any(${bind(inList(raw.slice(3)), `${type}[]`)})`);
      else throw new PgrstError(400, "PGRST100", `filter ${raw}`);
    }
    return terms.length ? `where ${terms.join(" and ")}` : "";
  }

  private selectList(query: URLSearchParams, alias: string): string {
    const select = (query.get("select") ?? "*").replace(/\s+/g, "");
    if (select === "*") return `${alias}.*`;
    return select.split(",").map((column) => `${alias}.${quoteIdent(column)}`).join(", ");
  }

  private async build(method: string, path: string, query: URLSearchParams, prefer: Map<string, string>, body: Json): Promise<Built & { kind: "rows" | "count" | "scalar" | "none" }> {
    const params: unknown[] = [];
    const representation = prefer.get("return") === "representation";
    if (path.startsWith("rpc/")) {
      const name = path.slice(4);
      if (!IDENT.test(name)) throw new PgrstError(404, "PGRST202", "no function");
      const args = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, Json>;
      const keys = Object.keys(args).sort();
      const signature = (await this.functionSignatures(name)).find((candidate) =>
        candidate.names.length === keys.length && [...candidate.names].sort().every((arg, index) => arg === keys[index]));
      if (!signature) throw new PgrstError(404, "PGRST202", `no function ${name}(${keys.join(",")})`);
      const named = signature.names.map((arg, index) => {
        const type = signature.types[index];
        const value = args[arg];
        params.push(value === null || value === undefined ? null : type === "jsonb" || type === "json" ? JSON.stringify(value) : String(value));
        return `${quoteIdent(arg)} => $${params.length}::${type}`;
      });
      return { kind: "scalar", sql: `select to_json(public.${quoteIdent(name)}(${named.join(", ")})) as body`, params };
    }

    const table = quoteIdent(path);
    const returning = this.selectList(query, "pgrst_target");
    if (method === "GET" || method === "HEAD") {
      const where = await this.where(path, query, params, "pgrst_target");
      if (method === "HEAD") return { kind: "count", sql: `select count(*)::int as n from public.${table} as pgrst_target ${where}`, params };
      const limit = query.get("limit");
      return {
        kind: "rows",
        sql: `select coalesce(json_agg(r), '[]'::json) as body from (select ${returning} from public.${table} as pgrst_target ${where}${limit ? ` limit ${Number(limit)}` : ""}) r`,
        params,
      };
    }

    if (method === "POST") {
      const rows = (Array.isArray(body) ? body : [body]) as Record<string, Json>[];
      if (!rows.every((row) => row && typeof row === "object" && !Array.isArray(row))) throw new PgrstError(400, "PGRST102", "bad body");
      if (rows.length === 0) return { kind: "rows", sql: "select '[]'::json as body", params };
      const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      await this.knownColumns(path, columns);
      const list = columns.map(quoteIdent).join(", ");
      params.push(JSON.stringify(rows));
      let sql = `insert into public.${table} as pgrst_target (${list}) select ${list} from json_populate_recordset(null::public.${table}, $1::json)`;
      const onConflict = query.get("on_conflict");
      if (onConflict) {
        const keys = onConflict.split(",").map(quoteIdent).join(", ");
        const resolution = prefer.get("resolution");
        if (resolution === "merge-duplicates") {
          sql += ` on conflict (${keys}) do update set ${columns.map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`).join(", ")}`;
        } else if (resolution === "ignore-duplicates") {
          sql += ` on conflict (${keys}) do nothing`;
        } else {
          throw new PgrstError(400, "PGRST100", "on_conflict needs a resolution");
        }
      }
      if (!representation) return { kind: "none", sql, params };
      return { kind: "rows", sql: `with pgrst_rows as (${sql} returning ${returning}) select coalesce(json_agg(pgrst_rows), '[]'::json) as body from pgrst_rows`, params };
    }

    if (method === "PATCH") {
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new PgrstError(400, "PGRST102", "bad body");
      const columns = Object.keys(body);
      if (columns.length === 0) throw new PgrstError(400, "PGRST_SPEC", "empty PATCH bodies are outside this stand-in");
      await this.knownColumns(path, columns);
      params.push(JSON.stringify(body));
      const set = columns.map((column) => `${quoteIdent(column)} = pgrst_body.${quoteIdent(column)}`).join(", ");
      const where = await this.where(path, query, params, "pgrst_target");
      const sql = `update public.${table} as pgrst_target set ${set} from (select * from json_populate_record(null::public.${table}, $1::json)) as pgrst_body ${where}`;
      if (!representation) return { kind: "none", sql, params };
      return { kind: "rows", sql: `with pgrst_rows as (${sql} returning ${returning}) select coalesce(json_agg(pgrst_rows), '[]'::json) as body from pgrst_rows`, params };
    }

    if (method === "DELETE") {
      const where = await this.where(path, query, params, "pgrst_target");
      const sql = `delete from public.${table} as pgrst_target ${where}`;
      if (!representation) return { kind: "none", sql, params };
      return { kind: "rows", sql: `with pgrst_rows as (${sql} returning ${returning}) select coalesce(json_agg(pgrst_rows), '[]'::json) as body from pgrst_rows`, params };
    }
    throw new PgrstError(405, "PGRST117", method);
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/auth/v1/.well-known/jwks.json") return Response.json(this.options.jwks);
    if (!url.pathname.startsWith("/rest/v1/")) return new Response("not found", { status: 404 });
    const path = url.pathname.slice("/rest/v1/".length);
    const method = request.method;
    const apikey = request.headers.get("apikey");
    const authorization = request.headers.get("authorization");
    let role: Role = "anon";
    let sub: string | null = null;
    if (apikey === this.options.secretKey && !authorization) role = "service_role";
    else if (apikey !== this.options.publishableKey) return Response.json({ code: "PGRST301", message: "bad key" }, { status: 401 });
    else if (authorization?.startsWith("Bearer ")) {
      const payload = decodeJwtPayload(authorization.slice(7));
      if (!payload || payload.role !== "authenticated" || typeof payload.sub !== "string") {
        return Response.json({ code: "PGRST301", message: "bad token" }, { status: 401 });
      }
      role = "authenticated";
      sub = payload.sub;
    }
    const text = method === "GET" || method === "HEAD" ? "" : await request.text();
    this.calls.push({ method, path, search: url.search, role, sub, prefer: request.headers.get("prefer"), body: text });
    let body: Json = undefined;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return Response.json({ code: "PGRST102", message: "invalid json" }, { status: 400 });
      }
    }
    const prefer = preferValues(request.headers.get("prefer"));
    try {
      const built = await this.build(method, path, url.searchParams, prefer, body);
      const result = await this.db.transaction(async (tx) => {
        await tx.exec(`set local role ${role}`);
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [sub ?? ""]);
        return tx.query<Record<string, unknown>>(built.sql, built.params);
      });
      if (built.kind === "count") {
        const total = Number(result.rows[0]?.n ?? 0);
        return new Response(null, { status: 200, headers: { "content-range": total ? `0-${total - 1}/${total}` : "*/0" } });
      }
      const status = method === "POST" && !path.startsWith("rpc/") ? 201 : built.kind === "none" ? 204 : 200;
      if (built.kind === "none") return new Response(null, { status });
      const payload = built.kind === "scalar" ? result.rows[0]?.body : result.rows[0]?.body;
      return new Response(JSON.stringify(payload ?? null), { status, headers: { "content-type": "application/json" } });
    } catch (error) {
      const known = error instanceof PgrstError ? error : null;
      const code = known?.code ?? String((error as { code?: unknown }).code ?? "XX000");
      const status = known?.status ?? statusFor(code, role);
      return Response.json({ code, message: (error as Error).message, details: null, hint: null }, { status });
    }
  }
}
