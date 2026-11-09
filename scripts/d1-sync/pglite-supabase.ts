/**
 * Supabase on PGlite for the step 5 specs: the public schema rebuilt from the repo's own SQL
 * (supabase/*.sql and supabase/migrations/*.sql, like scripts/d1-change-log.spec.ts), and a small
 * PostgREST stand-in for the calls the D1 -> Supabase mirror and the reload script make, run as
 * service_role so every real trigger, constraint and FK applies.
 */
import { readdirSync, readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = "supabase/migrations";

export const SUPABASE_BOOTSTRAP = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role supabase_admin nologin;
create schema auth;
create table auth.users (id uuid primary key, created_at timestamptz default now(), last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create publication supabase_realtime;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

/** The contact trigger WHEN of design 5.5, a step 4 prerequisite (not this piece's migration). */
export const CONTACT_TRIGGER_WHEN = `
drop trigger contact_inquiries_rate_limit on public.contact_inquiries;
create trigger contact_inquiries_rate_limit
  before insert on public.contact_inquiries
  for each row
  when (current_user = any (array['anon'::name, 'authenticated'::name]))
  execute function public.enforce_contact_inquiry_rate_limit();
`;

export function repoSupabaseFiles(): string[] {
  const top = readdirSync("supabase").filter((file) => /^migration-\d{3}-.*\.sql$/.test(file)).sort();
  const cli = readdirSync(MIGRATIONS).filter((file) => file.endsWith(".sql")).sort();
  return ["supabase/setup.sql", "supabase/migrate-env.sql", ...top.map((file) => `supabase/${file}`), ...cli.map((file) => `${MIGRATIONS}/${file}`)];
}

export async function repoSupabase(options: { exclude?: (file: string) => boolean; contactWhen?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP);
  for (const file of repoSupabaseFiles()) {
    if (options.exclude?.(file)) continue;
    try {
      await db.exec(readFileSync(file, "utf8"));
    } catch (error) {
      throw new Error(`${file}: ${(error as Error).message}`);
    }
  }
  if (options.contactWhen) await db.exec(CONTACT_TRIGGER_WHEN);
  return db;
}

type Row = Record<string, unknown>;

function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`bad identifier ${name}`);
  return `"${name}"`;
}

/** PostgREST's HTTP status for a Postgres error code (the subset the mirror tells apart). */
function statusOf(code: string): number {
  if (code === "23505" || code === "23503") return 409;
  if (code === "42501") return 403;
  if (code.startsWith("08") || code.startsWith("53") || code === "57014") return 503;
  return 400;
}

/**
 * service_role PostgREST over a PGlite database: POST (insert/upsert), PATCH, DELETE, GET, HEAD, rpc.
 * A GET or HEAD with `Prefer: count=exact` answers the total in Content-Range, as PostgREST does.
 */
export class PgliteRest {
  calls: Array<{ method: string; path: string; status: number }> = [];
  /** Answer the next calls with this status instead of running them (a down Supabase). */
  outage: number | null = null;

  constructor(readonly db: PGlite) {}

  private async asService<T>(run: () => Promise<T>): Promise<T> {
    await this.db.exec("set role service_role");
    try {
      return await run();
    } finally {
      await this.db.exec("reset role");
    }
  }

  private where(url: URL, from: number): { sql: string; params: string[] } {
    const parts: string[] = [];
    const params: string[] = [];
    for (const [name, value] of url.searchParams) {
      if (["on_conflict", "select", "order", "limit", "offset"].includes(name)) continue;
      const match = /^eq\.([\s\S]*)$/.exec(value);
      if (!match) throw new Error(`unsupported filter ${name}=${value}`);
      params.push(match[1]);
      parts.push(`${ident(name)}::text = $${from + params.length - 1}`);
    }
    return { sql: parts.length ? `where ${parts.join(" and ")}` : "", params };
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace("/rest/v1/", "");
    if (this.outage !== null) {
      this.calls.push({ method: request.method, path, status: this.outage });
      return new Response(JSON.stringify({ code: "XX000" }), { status: this.outage });
    }
    const text = request.method === "GET" || request.method === "HEAD" || request.method === "DELETE" ? "" : await request.text();
    try {
      const result = await this.asService(() => this.run(request.method, path, url, text, request.headers));
      this.calls.push({ method: request.method, path, status: result.status });
      return result;
    } catch (error) {
      const code = String((error as { code?: string }).code ?? "XX000");
      const status = statusOf(code);
      this.calls.push({ method: request.method, path, status });
      return new Response(JSON.stringify({ code, message: (error as Error).message }), { status, headers: { "content-type": "application/json" } });
    }
  }

  private async run(method: string, path: string, url: URL, text: string, headers: Headers): Promise<Response> {
    if (path.startsWith("rpc/")) {
      const fn = path.slice(4);
      if (fn === "mirror_run") {
        await this.db.query("select public.mirror_run($1::text)", [text]);
        return new Response(null, { status: 204 });
      }
      if (fn === "mirror_favorite_tournament_play") {
        const body = JSON.parse(text) as Row;
        const { rows } = await this.db.query("select public.mirror_favorite_tournament_play($1::text, $2::jsonb, $3::jsonb) as r", [
          body.p_env, JSON.stringify(body.p_play), JSON.stringify(body.p_stats),
        ]);
        return Response.json((rows[0] as Row).r);
      }
      throw new Error(`no rpc ${fn}`);
    }
    const table = `public.${ident(path)}`;
    if (method === "GET" || method === "HEAD") {
      const where = this.where(url, 1);
      const select = url.searchParams.get("select") ?? "*";
      const columns = select === "*" ? "*" : select.split(",").map(ident).join(", ");
      const order = url.searchParams.get("order");
      const orderSql = order ? `order by ${order.split(",").map((part) => {
        const [col, dir] = part.split(".");
        return `${ident(col)} ${dir === "desc" ? "desc" : "asc"}`;
      }).join(", ")}` : "";
      const limit = url.searchParams.get("limit");
      const offset = url.searchParams.get("offset");
      const { rows } = await this.db.query(
        `select ${columns} from ${table} ${where.sql} ${orderSql} ${limit ? `limit ${Number(limit)}` : ""} ${offset ? `offset ${Number(offset)}` : ""}`,
        where.params,
      );
      const out = new Headers();
      if ((headers.get("prefer") ?? "").includes("count=exact")) {
        const counted = await this.db.query<{ n: number }>(`select count(*)::int as n from ${table} ${where.sql}`, where.params);
        const first = Number(offset ?? 0);
        out.set("content-range", `${rows.length ? `${first}-${first + rows.length - 1}` : "*"}/${counted.rows[0].n}`);
      }
      return method === "HEAD" ? new Response(null, { status: 200, headers: out }) : Response.json(rows, { headers: out });
    }
    if (method === "DELETE") {
      const where = this.where(url, 1);
      await this.db.query(`delete from ${table} ${where.sql}`, where.params);
      return new Response(null, { status: 204 });
    }
    const body = JSON.parse(text) as Row | Row[];
    const records = Array.isArray(body) ? body : [body];
    if (method === "PATCH") {
      const row = records[0];
      const cols = Object.keys(row);
      const where = this.where(url, 2);
      if (cols.length) {
        await this.db.query(
          `update ${table} set (${cols.map(ident).join(", ")}) = (select ${cols.map(ident).join(", ")} from json_populate_record(null::${table}, $1::json)) ${where.sql}`,
          [JSON.stringify(row), ...where.params],
        );
      }
      return new Response(null, { status: 204 });
    }
    if (method === "POST") {
      const prefer = headers.get("prefer") ?? "";
      const conflict = (url.searchParams.get("on_conflict") ?? "").split(",").filter(Boolean);
      for (const row of records) {
        const cols = Object.keys(row);
        let onConflict = "";
        if (conflict.length) {
          const updates = cols.filter((col) => !conflict.includes(col));
          onConflict = prefer.includes("resolution=merge-duplicates") && updates.length
            ? `on conflict (${conflict.map(ident).join(", ")}) do update set ${updates.map((col) => `${ident(col)} = excluded.${ident(col)}`).join(", ")}`
            : `on conflict (${conflict.map(ident).join(", ")}) do nothing`;
        }
        await this.db.query(
          `insert into ${table} (${cols.map(ident).join(", ")}) select ${cols.map(ident).join(", ")} from json_populate_record(null::${table}, $1::json) ${onConflict}`,
          [JSON.stringify(row)],
        );
      }
      return new Response(null, { status: 201 });
    }
    throw new Error(`unsupported ${method}`);
  }
}
