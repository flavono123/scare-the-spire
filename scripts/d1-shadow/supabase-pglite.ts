/**
 * A Supabase stand-in for the shadow-read specs: Postgres in WASM (PGlite) with the public schema
 * rebuilt from the repo's supabase/*.sql and supabase/migrations/*.sql (as scripts/d1-change-log.spec.ts
 * does), or from a pg_dump --schema-only file when SUPABASE_PUBLIC_SCHEMA names one. The session runs
 * in UTC, as PostgREST's does, so JSON timestamps print as PostgREST prints them.
 */
import { readdirSync, readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = "supabase/migrations";

// What Supabase provides before any repo SQL runs: the API roles, auth.users, auth.uid() from the
// request claims and the realtime publication (same stand-ins as the change-log spec).
const SUPABASE_BOOTSTRAP = `
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
`;

const SUPABASE_DEFAULT_PRIVILEGES = `
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

function historicalFiles(): string[] {
  const top = readdirSync("supabase").filter((file) => /^migration-\d{3}-.*\.sql$/.test(file)).sort();
  // The change-log migration is not applied to Supabase yet; the shadow reads do not need it.
  const cli = readdirSync(MIGRATIONS).filter((file) => file.endsWith(".sql") && !file.endsWith("_d1_change_log.sql")).sort();
  return [
    "supabase/setup.sql",
    "supabase/migrate-env.sql",
    ...top.map((file) => `supabase/${file}`),
    ...cli.map((file) => `${MIGRATIONS}/${file}`),
  ];
}

export async function openSupabase(dumpFile = process.env.SUPABASE_PUBLIC_SCHEMA): Promise<{ db: PGlite; source: string }> {
  const db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP);
  if (dumpFile) {
    const dump = readFileSync(dumpFile, "utf8")
      .split("\n")
      .filter((line) => !line.startsWith("\\"))
      .join("\n")
      .replace(/^CREATE SCHEMA public;$/m, "");
    await db.exec(dump);
    // pg_dump's session settings: back to what PostgREST sessions run with.
    await db.exec("set row_security = on; select pg_catalog.set_config('search_path', '\"$user\", public', false);");
  } else {
    await db.exec(SUPABASE_DEFAULT_PRIVILEGES);
    for (const file of historicalFiles()) {
      try {
        await db.exec(readFileSync(file, "utf8"));
      } catch (error) {
        throw new Error(`${file}: ${(error as Error).message}`);
      }
    }
  }
  await db.exec("set time zone 'UTC'");
  return { db, source: dumpFile ? `dump ${dumpFile.split("/").pop()}` : "repo SQL" };
}

/** Runs `sql` with triggers and FK checks off (the fixture sets counters itself, as Supabase holds them). */
export async function loadRows(db: PGlite, sql: string): Promise<void> {
  await db.exec("set session_replication_role = replica");
  try {
    await db.exec(sql);
  } finally {
    await db.exec("set session_replication_role = origin");
  }
}
