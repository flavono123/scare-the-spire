/**
 * The Supabase change-log migration the D1 sync reads (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.1),
 * on PGlite (Postgres in WASM). The public schema is rebuilt from the repo's own supabase/*.sql and
 * supabase/migrations/*.sql with stand-ins for the Supabase auth schema and roles, then the migration
 * and its rollback script run on it.
 * Usage: tsx scripts/d1-change-log.spec.ts
 * SUPABASE_PUBLIC_SCHEMA=<pg_dump --schema-only of public> also compares the 27 logged tables (columns,
 * constraints, indexes, triggers, policies, grants, and the functions they call) with that dump.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = "supabase/migrations";
const CHANGE_LOG = readdirSync(MIGRATIONS).filter((file) => file.endsWith("_d1_change_log.sql"));
const ROLLBACK = "docs/release/d1-change-log/rollback_d1_change_log.sql";

// Design 4 and 7: every public table except nav_indicators, debate_cycles,
// colorful_philosopher_reactions and defragment_posts.
const LOGGED_TABLES = [
  "comments", "comment_likes", "likes", "this_or_that_post_likes", "this_or_that_post_votes",
  "favorite_tournament_plays", "resource_reactions", "resource_reaction_counts", "runs",
  "combo_posts", "transfigure_posts", "this_or_that_posts", "chemical_posts", "decisions_decisions_posts",
  "favorite_tournament_posts", "pagestorm_posts", "favorite_tournament_candidate_stats", "community_stories",
  "defragment_bodies", "pagestorm_drafts", "contact_inquiries", "colorful_philosopher_posts",
  "profile_character_nickname_pools", "puzzlebox_players", "puzzlebox_runs", "puzzlebox_best",
  "puzzlebox_board_stats",
];
const UNLOGGED_TABLES = ["nav_indicators", "debate_cycles", "colorful_philosopher_reactions", "defragment_posts"];
const ENVLESS_TABLES = new Set(["profile_character_nickname_pools", "puzzlebox_players"]);

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const COMMENT_PARENT = "c0000000-0000-4000-8000-000000000000";
const TOT_PARENT = "70000000-0000-4000-8000-000000000000";
const FT_PARENT = "f0000000-0000-4000-8000-000000000000";

// Stand-ins for what Supabase provides before any repo SQL runs: the API roles, auth.users with
// the columns repo functions read, auth.uid() from the request claims, and the realtime publication.
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

// The default privileges Supabase sets on public: ALL to anon, authenticated and service_role.
// A pg_dump sets its own at the end, so the dump replay does not take these.
const SUPABASE_DEFAULT_PRIVILEGES = `
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

type Json = Record<string, unknown>;
type LogRow = {
  id: number;
  env: string | null;
  table_name: string;
  op: string;
  new_row: Json | null;
  old_row: Json | null;
  heavy_changed: boolean;
  row_bytes: number;
};

function historicalFiles(): string[] {
  const top = readdirSync("supabase").filter((file) => /^migration-\d{3}-.*\.sql$/.test(file)).sort();
  const cli = readdirSync(MIGRATIONS).filter((file) => file.endsWith(".sql") && !CHANGE_LOG.includes(file)).sort();
  return [
    "supabase/setup.sql",
    "supabase/migrate-env.sql",
    ...top.map((file) => `supabase/${file}`),
    ...cli.map((file) => `${MIGRATIONS}/${file}`),
  ];
}

async function freshSupabase(defaultPrivileges = true): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP);
  if (defaultPrivileges) await db.exec(SUPABASE_DEFAULT_PRIVILEGES);
  return db;
}

async function repoSchema(): Promise<PGlite> {
  const db = await freshSupabase();
  for (const file of historicalFiles()) await applyFile(db, file);
  return db;
}

// Each file runs as one implicit transaction, like the CLI pipeline and the SQL editor.
async function applyFile(db: PGlite, file: string) {
  try {
    await db.exec(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file}: ${(error as Error).message}`);
  }
}

async function asRole<T>(db: PGlite, role: string, sub: string | null, run: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await run();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function errorCode(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    return String((error as { code?: string }).code ?? (error as Error).message);
  }
  return "no error";
}

// --- Schema check against a dump of the live public schema ------------------------------------

const DESCRIBE_TABLE = `
select jsonb_build_object(
  'columns', (select jsonb_agg(jsonb_build_array(a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull,
      pg_get_expr(d.adbin, d.adrelid), a.attgenerated, a.attidentity,
      (select jsonb_agg(g order by g) from (select x.grantee::regrole::text || ':' || x.privilege_type as g
         from aclexplode(a.attacl) x where x.grantee <> c.relowner) as col_grants)) order by a.attname)
    from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
  'constraints', (select jsonb_agg(jsonb_build_array(k.conname, pg_get_constraintdef(k.oid)) order by k.conname)
    from pg_constraint k where k.conrelid = c.oid),
  'indexes', (select jsonb_agg(def order by def)
    from (select pg_get_indexdef(i.indexrelid) as def from pg_index i where i.indrelid = c.oid) as defs),
  'triggers', (select jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname)
    from pg_trigger t where t.tgrelid = c.oid and not t.tgisinternal),
  'policies', (select jsonb_agg(jsonb_build_array(p.polname, p.polpermissive, p.polcmd,
      (select jsonb_agg(role order by role) from (select case when r = 0 then 'public' else r::regrole::text end as role
         from unnest(p.polroles) as r) as roles),
      pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid)) order by p.polname)
    from pg_policy p where p.polrelid = c.oid),
  'rls', jsonb_build_array(c.relrowsecurity, c.relforcerowsecurity),
  'grants', (select jsonb_agg(g order by g) from (select case when x.grantee = 0 then 'public'
      else x.grantee::regrole::text end || ':' || x.privilege_type as g
    from aclexplode(c.relacl) x where x.grantee <> c.relowner) as table_grants)
) as description,
(select jsonb_agg(a.attname order by a.attnum) from pg_attribute a
  where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as column_order
from pg_class c where c.oid = ('public.' || $1)::regclass
`;

// A dump replay parses each CHECK once more, which flattens nested ANDs that BETWEEN leaves in a
// deparse. Re-adding each CHECK from its own text puts the repo side through the same round trip.
const roundTripChecks = (tables: string[]) => `
do $$
declare
  k record;
begin
  for k in
    select c.conrelid::regclass as tbl, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid = any (array[${tables.map((table) => `'public.${table}'`).join(", ")}]::regclass[])
  loop
    execute format('alter table %s drop constraint %I, add constraint %I %s', k.tbl, k.conname, k.conname, k.def);
  end loop;
end
$$;
`;

const DESCRIBE_FUNCTION = `
select coalesce(jsonb_agg(pg_get_functiondef(p.oid) order by pg_get_function_identity_arguments(p.oid)), '[]'::jsonb) as defs
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = $1
`;

async function describe(db: PGlite, tables: string[]) {
  await db.query("select set_config('search_path', '', false)");
  const out: Record<string, unknown> = {};
  const columnOrder: Record<string, unknown> = {};
  const functions = new Set<string>();
  for (const table of tables) {
    const { rows } = await db.query<{ description: Json; column_order: unknown }>(DESCRIBE_TABLE, [table]);
    out[table] = rows[0].description;
    columnOrder[table] = rows[0].column_order;
    for (const match of JSON.stringify(rows[0].description).matchAll(/public\.(\w+)\(/g)) functions.add(match[1]);
  }
  for (const fn of [...functions].sort()) {
    out[`function ${fn}`] = (await db.query<{ defs: unknown }>(DESCRIBE_FUNCTION, [fn])).rows[0].defs;
  }
  await db.query("select set_config('search_path', '\"$user\", public', false)");
  return { out, columnOrder };
}

// Column order is reported, not failed: the log and the sync read columns by name.
async function compareWithDump(dumpFile: string) {
  const dump = readFileSync(dumpFile, "utf8")
    .split("\n")
    .filter((line) => !line.startsWith("\\"))
    .join("\n")
    .replace(/^CREATE SCHEMA public;$/m, "");
  const live = await freshSupabase(false);
  await live.exec(dump);
  const repo = await repoSchema();
  await repo.exec(roundTripChecks(LOGGED_TABLES));
  const expected = await describe(live, LOGGED_TABLES);
  const actual = await describe(repo, LOGGED_TABLES);
  const differing = Object.keys(expected.out).filter(
    (key) => JSON.stringify(expected.out[key]) !== JSON.stringify(actual.out[key]),
  );
  for (const key of differing) {
    console.error(`schema differs: ${key}\n  dump: ${JSON.stringify(expected.out[key])}\n  repo: ${JSON.stringify(actual.out[key])}`);
  }
  for (const table of LOGGED_TABLES) {
    if (JSON.stringify(expected.columnOrder[table]) !== JSON.stringify(actual.columnOrder[table])) {
      console.log(`column order differs (not failed): ${table}\n  dump: ${JSON.stringify(expected.columnOrder[table])}\n  repo: ${JSON.stringify(actual.columnOrder[table])}`);
    }
  }
  assert.deepEqual(differing, [], "the repo SQL rebuilds the logged tables as the dump has them");
  console.log(`schema check: ${Object.keys(expected.out).length} tables and functions match ${path.basename(dumpFile)}`);
  await live.close();
  await repo.close();
}

// --- Change-log checks -------------------------------------------------------------------------

type Case = {
  table: string;
  insert: string;
  key: string;
  set: [string, string];
  env: string | null;
  heavy?: string[];
};

const CASES: Case[] = [
  {
    table: "comments",
    insert: `insert into public.comments (id, story_id, user_id, nickname, content, env)
      values ('c1000000-0000-4000-8000-000000000000', 'byrdispatch', '${U1}', '닉', 'hello', 'development')`,
    key: "id = 'c1000000-0000-4000-8000-000000000000'",
    set: ["content", "'hello again'"],
    env: "development",
  },
  {
    table: "comment_likes",
    insert: `insert into public.comment_likes (comment_id, user_id) values ('${COMMENT_PARENT}', '${U1}')`,
    key: `comment_id = '${COMMENT_PARENT}' and user_id = '${U1}'`,
    set: ["created_at", "'2026-11-01 00:00:00+00'"],
    env: "development",
  },
  {
    table: "likes",
    insert: `insert into public.likes (story_id, user_id, env) values ('byrdispatch', '${U1}', 'development')`,
    key: `story_id = 'byrdispatch' and user_id = '${U1}'`,
    set: ["reaction_type", "'heart'"],
    env: "development",
  },
  {
    table: "this_or_that_post_likes",
    insert: `insert into public.this_or_that_post_likes (post_id, user_id, env) values ('${TOT_PARENT}', '${U1}', 'development')`,
    key: `post_id = '${TOT_PARENT}' and user_id = '${U1}'`,
    set: ["created_at", "'2026-11-01 00:00:00+00'"],
    env: "development",
  },
  {
    table: "this_or_that_post_votes",
    insert: `insert into public.this_or_that_post_votes (post_id, user_id, choice, created_surface, env)
      values ('${TOT_PARENT}', '${U1}', 'left', 'index', 'development')`,
    key: `post_id = '${TOT_PARENT}' and user_id = '${U1}'`,
    set: ["created_surface", "'detail'"],
    env: "development",
  },
  {
    table: "favorite_tournament_plays",
    insert: `insert into public.favorite_tournament_plays (id, tournament_id, user_id, env, starting_size, champion_type, champion_id, matches)
      values ('f1000000-0000-4000-8000-000000000000', '${FT_PARENT}', '${U1}', 'development', 2, 'card', 'BASH', '[]')`,
    key: "id = 'f1000000-0000-4000-8000-000000000000'",
    set: ["starting_size", "4"],
    env: "development",
  },
  {
    table: "resource_reactions",
    insert: `insert into public.resource_reactions (env, resource_type, resource_id, game_version, user_id, kind)
      values ('development', 'card', 'BASH', '0.1.0', '${U1}', 'buff')`,
    key: `resource_id = 'BASH' and user_id = '${U1}'`,
    set: ["kind", "'nerf'"],
    env: "development",
  },
  {
    table: "resource_reaction_counts",
    insert: `insert into public.resource_reaction_counts (env, resource_type, resource_id, game_version, buff_count)
      values ('development', 'relic', 'ANCHOR', '0.1.0', 1)`,
    key: "resource_id = 'ANCHOR'",
    set: ["buff_count", "2"],
    env: "development",
  },
  {
    table: "runs",
    insert: `insert into public.runs (id, raw, seed, build, "character", ascension, win, acts_count, donor_user_id, env, donor_nickname)
      values ('r1testrun', repeat('{"floor":1}', 500), 'SEED1', 'v0.1', 'IRONCLAD', 0, true, 3, '${U1}', 'development', '닉')`,
    key: "id = 'r1testrun'",
    set: ["ascension", "1"],
    env: "development",
    heavy: ["raw"],
  },
  {
    table: "combo_posts",
    insert: `insert into public.combo_posts (id, user_id, nickname, content, content_text, resources, env)
      values ('a1000000-0000-4000-8000-000000000000', '${U1}', '닉', '[]', 'combo text', '[{"type":"card","id":"BASH"},{"type":"card","id":"STRIKE"}]', 'development')`,
    key: "id = 'a1000000-0000-4000-8000-000000000000'",
    set: ["content_text", "'combo text 2'"],
    env: "development",
  },
  {
    table: "transfigure_posts",
    insert: `insert into public.transfigure_posts (id, user_id, nickname, resource_type, resource_id, source_text, source_game_locale, content, content_text, env)
      values ('a2000000-0000-4000-8000-000000000000', '${U1}', '닉', 'card', 'BASH', 'src', 'kor', '[]', 'text', 'development')`,
    key: "id = 'a2000000-0000-4000-8000-000000000000'",
    set: ["content_text", "'text 2'"],
    env: "development",
  },
  {
    table: "this_or_that_posts",
    insert: `insert into public.this_or_that_posts (id, user_id, nickname, left_type, left_id, right_type, right_id, reason, env)
      values ('a3000000-0000-4000-8000-000000000000', '${U1}', '닉', 'card', 'BASH', 'card', 'STRIKE', 'a reason', 'development')`,
    key: "id = 'a3000000-0000-4000-8000-000000000000'",
    set: ["reason", "'another reason'"],
    env: "development",
  },
  {
    table: "chemical_posts",
    insert: `insert into public.chemical_posts (id, user_id, nickname, content, content_text, env)
      values ('a4000000-0000-4000-8000-000000000000', '${U1}', '닉', '[]', 'chem text', 'development')`,
    key: "id = 'a4000000-0000-4000-8000-000000000000'",
    set: ["content_text", "'chem text 2'"],
    env: "development",
  },
  {
    table: "decisions_decisions_posts",
    insert: `insert into public.decisions_decisions_posts (id, user_id, nickname, title, preset_key, game_version, rows, placements, env)
      values ('a5000000-0000-4000-8000-000000000000', '${U1}', '닉', 'title', 'preset', '0.1', '[]', '[]', 'development')`,
    key: "id = 'a5000000-0000-4000-8000-000000000000'",
    set: ["title", "'title 2'"],
    env: "development",
  },
  {
    table: "favorite_tournament_posts",
    insert: `insert into public.favorite_tournament_posts (id, user_id, nickname, title, preset_key, game_version, pool, env)
      values ('a6000000-0000-4000-8000-000000000000', '${U1}', '닉', 'title', 'custom', '0.1', '[]', 'development')`,
    key: "id = 'a6000000-0000-4000-8000-000000000000'",
    set: ["title", "'title 2'"],
    env: "development",
  },
  {
    table: "pagestorm_posts",
    insert: `insert into public.pagestorm_posts (id, user_id, nickname, title, content, content_text, env)
      values ('a7000000-0000-4000-8000-000000000000', '${U1}', '닉', 'title', '{}', 'text', 'development')`,
    key: "id = 'a7000000-0000-4000-8000-000000000000'",
    set: ["title", "'title 2'"],
    env: "development",
  },
  {
    table: "favorite_tournament_candidate_stats",
    insert: `insert into public.favorite_tournament_candidate_stats (tournament_id, env, resource_type, resource_id)
      values ('${FT_PARENT}', 'development', 'card', 'BASH')`,
    key: `tournament_id = '${FT_PARENT}' and resource_id = 'BASH'`,
    set: ["match_wins", "1"],
    env: "development",
  },
  {
    table: "community_stories",
    insert: `insert into public.community_stories (id, user_id, nickname, sentence, env)
      values ('a8000000-0000-4000-8000-000000000000', '${U1}', '닉', 'a sentence', 'development')`,
    key: "id = 'a8000000-0000-4000-8000-000000000000'",
    set: ["sentence", "'another sentence'"],
    env: "development",
  },
  {
    table: "defragment_bodies",
    insert: `insert into public.defragment_bodies (env, source_service, source_id, user_id, nickname, content, content_text)
      values ('development', 'combo', 'a1000000-0000-4000-8000-000000000000', '${U1}', '닉', '[]', 'body text')`,
    key: "source_id = 'a1000000-0000-4000-8000-000000000000'",
    set: ["content_text", "'body text 2'"],
    env: "development",
  },
  {
    table: "pagestorm_drafts",
    insert: `insert into public.pagestorm_drafts (id, user_id, nickname, title, content, content_text, env)
      values ('a9000000-0000-4000-8000-000000000000', '${U1}', '닉', 'title', '{}', 'text', 'development')`,
    key: "id = 'a9000000-0000-4000-8000-000000000000'",
    set: ["title", "'title 2'"],
    env: "development",
  },
  {
    // A guest inquiry: the rate-limit trigger only accepts user_id = auth.uid(), null for the service role.
    table: "contact_inquiries",
    insert: `insert into public.contact_inquiries (id, category, message, page_path, service_locale, game_locale, env)
      values ('b1000000-0000-4000-8000-000000000000', 'bug', 'a message long enough', '/codex', 'ko', 'kor', 'development')`,
    key: "id = 'b1000000-0000-4000-8000-000000000000'",
    set: ["status", "'reviewing'"],
    env: "development",
  },
  {
    table: "colorful_philosopher_posts",
    insert: `insert into public.colorful_philosopher_posts (id, env, week_start, slot, resource_type, resource_id, name_ko, name_en, body, game_version)
      values ('b2000000-0000-4000-8000-000000000000', 'development', '2026-11-02', 'card', 'card', 'BASH', '강타', 'Bash', 'body', '0.1')`,
    key: "id = 'b2000000-0000-4000-8000-000000000000'",
    set: ["body", "'body 2'"],
    env: "development",
  },
  {
    // The migration seeds every (character, locale) pair; the spec setup deletes this one first.
    table: "profile_character_nickname_pools",
    insert: `insert into public.profile_character_nickname_pools (character_id, locale, nicknames)
      select 'DEFECT', 'en', nicknames from public.profile_character_nickname_pools where character_id = 'DEFECT' and locale = 'ko'`,
    key: "character_id = 'DEFECT' and locale = 'en'",
    set: ["updated_at", "'2026-11-01 00:00:00+00'"],
    env: null,
  },
  {
    table: "puzzlebox_players",
    insert: `insert into public.puzzlebox_players (user_id, nickname) values ('${U1}', '닉')`,
    key: `user_id = '${U1}'`,
    set: ["nickname", "'닉2'"],
    env: null,
  },
  {
    table: "puzzlebox_runs",
    insert: `insert into public.puzzlebox_runs (env, game, board, user_id, attempt, score, perfect, run)
      values ('development', 'connections', '7', '${U1}', 1, 10, false, '{}')`,
    key: `board = '7' and user_id = '${U1}'`,
    set: ["score", "20"],
    env: "development",
  },
  {
    table: "puzzlebox_best",
    insert: `insert into public.puzzlebox_best (env, game, board, user_id, score, perfect, run_id, achieved_at, attempts)
      select 'development', 'connections', '1', '${U1}', 10, false, id, now(), 1 from public.puzzlebox_runs where board = '1'`,
    key: `board = '1' and user_id = '${U1}'`,
    set: ["score", "11"],
    env: "development",
  },
  {
    table: "puzzlebox_board_stats",
    insert: `insert into public.puzzlebox_board_stats (env, game, board) values ('development', 'connections', '1')`,
    key: "board = '1'",
    set: ["players", "1"],
    env: "development",
  },
];

// Rows the cases point at, written before the migration so they are not logged.
const SETUP = `
insert into auth.users (id) values ('${U1}'), ('${U2}');
insert into public.comments (id, story_id, user_id, nickname, content, env)
  values ('${COMMENT_PARENT}', 'byrdispatch', '${U2}', '닉', 'parent', 'development');
insert into public.this_or_that_posts (id, user_id, nickname, left_type, left_id, right_type, right_id, reason, env)
  values ('${TOT_PARENT}', '${U2}', '닉', 'card', 'BASH', 'relic', 'ANCHOR', 'parent post', 'development');
insert into public.favorite_tournament_posts (id, user_id, nickname, title, preset_key, game_version, pool, env)
  values ('${FT_PARENT}', '${U2}', '닉', 'parent', 'custom', '0.1', '[]', 'development');
insert into public.puzzlebox_runs (env, game, board, user_id, attempt, score, perfect, run)
  values ('development', 'connections', '1', '${U2}', 1, 5, false, '{}');
delete from public.profile_character_nickname_pools where character_id = 'DEFECT' and locale = 'en';
`;

async function logRows(db: PGlite, table?: string): Promise<LogRow[]> {
  const where = table ? "where table_name = $1" : "";
  const { rows } = await db.query<LogRow>(
    `select id, env, table_name, op, new_row, old_row, heavy_changed, row_bytes from public.d1_change_log ${where} order by id`,
    table ? [table] : [],
  );
  return rows;
}

async function clearLog(db: PGlite) {
  await db.exec("truncate public.d1_change_log");
}

async function rowImage(db: PGlite, table: string, key: string, heavy: string[] = []): Promise<Json> {
  const strip = heavy.map((column) => ` - '${column}'`).join("");
  const { rows } = await db.query<{ image: Json }>(`select to_jsonb(t)${strip} as image from public.${table} t where ${key}`);
  assert.equal(rows.length, 1, `${table}: the key finds one row`);
  return rows[0].image;
}

async function assertRowBytes(db: PGlite) {
  const { rows } = await db.query<{ bad: number }>(`select count(*)::int as bad from public.d1_change_log
    where row_bytes <> coalesce(octet_length(new_row::text), 0) + coalesce(octet_length(old_row::text), 0)`);
  assert.equal(rows[0].bad, 0, "row_bytes is the byte length of both images");
}

async function service<T>(db: PGlite, run: () => Promise<T>) {
  return asRole(db, "service_role", null, run);
}

async function checkCase(db: PGlite, c: Case) {
  const heavy = c.heavy ?? [];
  const label = c.table;

  await clearLog(db);
  await service(db, () => db.query(c.insert));
  let rows = await logRows(db, c.table);
  assert.equal(rows.length, 1, `${label}: one I row`);
  assert.equal(rows[0].op, "I", label);
  assert.equal(rows[0].env, c.env, `${label}: env of I`);
  assert.deepEqual(rows[0].new_row, await rowImage(db, c.table, c.key, heavy), `${label}: I is the whole row`);
  assert.equal(rows[0].old_row, null, `${label}: I has no old image`);
  assert.equal(rows[0].heavy_changed, heavy.length > 0, `${label}: heavy_changed of I`);

  await clearLog(db);
  const before = await rowImage(db, c.table, c.key, heavy);
  const [column, value] = c.set;
  const updated = await service(db, () => db.query(`update public.${c.table} set ${column} = ${value} where ${c.key}`));
  assert.equal(updated.affectedRows, 1, `${label}: the update hits one row`);
  rows = await logRows(db, c.table);
  assert.equal(rows.length, 1, `${label}: one U row`);
  assert.equal(rows[0].op, "U", label);
  assert.equal(rows[0].env, c.env, `${label}: env of U`);
  const after = await rowImage(db, c.table, c.key, heavy);
  assert.deepEqual(rows[0].new_row, { [column]: after[column] }, `${label}: U has only the changed column`);
  assert.deepEqual(rows[0].old_row, before, `${label}: U old image is the whole old row`);
  assert.equal(rows[0].heavy_changed, false, `${label}: heavy_changed of U`);

  await clearLog(db);
  const noop = await service(db, () => db.query(`update public.${c.table} set ${column} = ${column} where ${c.key}`));
  assert.equal(noop.affectedRows, 1, `${label}: the no-op update still hits the row`);
  assert.equal((await logRows(db, c.table)).length, 0, `${label}: a no-op update writes no log row`);

  await clearLog(db);
  const gone = await rowImage(db, c.table, c.key, heavy);
  const deleted = await service(db, () => db.query(`delete from public.${c.table} where ${c.key}`));
  assert.equal(deleted.affectedRows, 1, `${label}: the delete hits one row`);
  rows = await logRows(db, c.table);
  assert.equal(rows.length, 1, `${label}: one D row`);
  assert.equal(rows[0].op, "D", label);
  assert.equal(rows[0].env, c.env, `${label}: env of D`);
  assert.equal(rows[0].new_row, null, `${label}: D has no new image`);
  assert.deepEqual(rows[0].old_row, gone, `${label}: D is the whole old row`);
  assert.equal(rows[0].heavy_changed, false, `${label}: heavy_changed of D`);
  await assertRowBytes(db);
}

async function checkRunsRaw(db: PGlite) {
  await clearLog(db);
  await service(db, () => db.query(`insert into public.runs (id, raw, seed, build, "character", ascension, win, acts_count, donor_user_id, env, donor_nickname)
    values ('r2testrun', '{"v":1}', 'SEED2', 'v0.1', 'SILENT', 0, false, 2, '${U1}', 'production', '닉')`));
  await service(db, () => db.query(`update public.runs set raw = '{"v":2}' where id = 'r2testrun'`));
  await service(db, () => db.query(`update public.runs set raw = '{"v":3}', seed = 'SEED3' where id = 'r2testrun'`));
  await service(db, () => db.query(`update public.runs set like_count = like_count + 1 where id = 'r2testrun'`));
  await service(db, () => db.query(`delete from public.runs where id = 'r2testrun'`));
  const rows = await logRows(db, "runs");
  assert.deepEqual(rows.map((row) => [row.op, row.heavy_changed]), [["I", true], ["U", true], ["U", true], ["U", false], ["D", false]]);
  assert.deepEqual(rows.map((row) => row.env), ["production", "production", "production", "production", "production"]);
  for (const row of rows) {
    assert.equal(Boolean(row.new_row && "raw" in row.new_row), false, "raw is never in the new image");
    assert.equal(Boolean(row.old_row && "raw" in row.old_row), false, "raw is never in the old image");
  }
  assert.deepEqual(rows[1].new_row, {}, "a raw-only update logs an empty new image and heavy_changed");
  assert.deepEqual(rows[2].new_row, { seed: "SEED3" });
  assert.deepEqual(rows[3].new_row, { like_count: 1 });
  assert.equal(rows[3].old_row?.id, "r2testrun", "the old image carries the key");
  await assertRowBytes(db);
}

async function checkCommentLikeEnv(db: PGlite) {
  const comment = "c2000000-0000-4000-8000-000000000000";
  await service(db, () => db.query(`insert into public.comments (id, story_id, user_id, nickname, content)
    values ('${comment}', 'sts2-codex:card:BASH', '${U2}', '닉', 'parent with the default env')`));
  await service(db, () => db.query(`insert into public.comment_likes (comment_id, user_id) values ('${comment}', '${U1}'), ('${comment}', '${U2}')`));
  await clearLog(db);
  await service(db, () => db.query(`delete from public.comment_likes where comment_id = '${comment}' and user_id = '${U2}'`));
  await service(db, () => db.query(`delete from public.comments where id = '${comment}'`));
  // The order of the comment's own log row and its cascade is Postgres's trigger order; the sync
  // collapses by key, so only the set matters.
  const rows = await logRows(db);
  assert.deepEqual(
    rows.map((row) => JSON.stringify([row.table_name, row.op, row.env, row.old_row?.user_id])).sort(),
    [
      ["comment_likes", "D", "production", U2],
      ["comment_likes", "D", null, U1],
      ["comments", "D", "production", U2],
    ].map((row) => JSON.stringify(row)).sort(),
    "comment_likes takes the parent's env, and null in the cascade after the parent is gone",
  );
  assert.ok(rows.every((row) => row.table_name === "comments" || row.old_row?.comment_id === comment));
}

async function checkPrivileges(db: PGlite) {
  const { rows } = await db.query<Json>(`select
      (select relrowsecurity from pg_class where oid = 'public.d1_change_log'::regclass) as rls,
      (select count(*)::int from pg_policy where polrelid = 'public.d1_change_log'::regclass) as policies,
      has_table_privilege('anon', 'public.d1_change_log', 'select, insert, update, delete, truncate, references, trigger') as anon_table,
      has_table_privilege('authenticated', 'public.d1_change_log', 'select, insert, update, delete, truncate, references, trigger') as authenticated_table,
      has_sequence_privilege('anon', 'public.d1_change_log_id_seq', 'usage, select, update') as anon_sequence,
      has_sequence_privilege('authenticated', 'public.d1_change_log_id_seq', 'usage, select, update') as authenticated_sequence,
      has_function_privilege('anon', 'public.d1_log_change()', 'execute') as anon_function,
      has_function_privilege('authenticated', 'public.d1_log_change()', 'execute') as authenticated_function,
      has_table_privilege('service_role', 'public.d1_change_log', 'select') as service_select,
      has_table_privilege('service_role', 'public.d1_change_log', 'delete') as service_delete,
      (select prosecdef from pg_proc where oid = 'public.d1_log_change()'::regprocedure) as definer,
      (select proconfig from pg_proc where oid = 'public.d1_log_change()'::regprocedure) as config`);
  assert.deepEqual(rows[0], {
    rls: true, policies: 0,
    anon_table: false, authenticated_table: false,
    anon_sequence: false, authenticated_sequence: false,
    anon_function: false, authenticated_function: false,
    service_select: true, service_delete: true,
    definer: true, config: ["search_path=\"\""],
  });
  for (const role of ["anon", "authenticated"]) {
    assert.equal(await errorCode(() => asRole(db, role, U1, () => db.query("select * from public.d1_change_log"))), "42501", `${role} cannot read the log`);
    assert.equal(await errorCode(() => asRole(db, role, U1, () => db.query(
      "insert into public.d1_change_log (table_name, op, row_bytes) values ('likes', 'I', 0)"))), "42501", `${role} cannot write the log`);
  }
  const read = await service(db, () => db.query<{ n: number }>("select count(*)::int as n from public.d1_change_log"));
  assert.equal(typeof read.rows[0].n, "number", "the service role reads the log");
}

async function checkClientWrites(db: PGlite) {
  // Writes RLS allows: each succeeds with the row it would have written anyway, and is logged.
  await clearLog(db);
  const postId = "a1100000-0000-4000-8000-000000000000";
  const post = await asRole(db, "authenticated", U1, () => db.query<Json>(
    `insert into public.combo_posts (id, user_id, nickname, content, content_text, resources, env, like_count, created_at)
     values ('${postId}', '${U1}', '닉', '[]', 'combo text', '[{"type":"card","id":"BASH"},{"type":"card","id":"STRIKE"}]', 'development', 99, '2000-01-01')
     returning to_jsonb(combo_posts) as image`));
  const stored = await rowImage(db, "combo_posts", `id = '${postId}'`);
  assert.deepEqual(post.rows[0].image, stored, "the insert returns the row it stored");
  assert.equal(stored.like_count, 0, "the guard trigger still sets the server columns");
  assert.deepEqual((await logRows(db, "combo_posts"))[0].new_row, stored, "the log has the row as stored after the guard trigger");
  const like = await asRole(db, "authenticated", U1, () => db.query<Json>(
    `insert into public.likes (story_id, user_id, env) values ('c-c-c-combo:${postId}', '${U1}', 'development') returning *`));
  assert.equal(like.rows.length, 1);
  const anonLike = await asRole(db, "anon", U2, () => db.query<Json>(
    `insert into public.likes (story_id, user_id, env) values ('byrdispatch', '${U2}', 'production') returning *`));
  assert.equal(anonLike.rows.length, 1, "an anon write that RLS allows succeeds");
  const edited = await asRole(db, "authenticated", U1, () => db.query(
    `update public.combo_posts set content_text = 'edited text' where id = 'a1100000-0000-4000-8000-000000000000'`));
  assert.equal(edited.affectedRows, 1);
  const inquiry = await asRole(db, "authenticated", U1, () => db.query(
    `insert into public.contact_inquiries (user_id, category, message, page_path, service_locale, game_locale, env)
     values ('${U1}', 'feedback', '  a message long enough  ', '/codex', 'ko', 'kor', 'production')`));
  assert.equal(inquiry.affectedRows, 1, "column grants and the rate-limit trigger still pass");
  const totLike = await asRole(db, "authenticated", U1, () => db.query(
    `insert into public.this_or_that_post_likes (post_id, user_id, env) values ('${TOT_PARENT}', '${U1}', 'development')`));
  assert.equal(totLike.affectedRows, 1);
  const unliked = await asRole(db, "authenticated", U2, () => db.query(
    `delete from public.likes where story_id = 'byrdispatch' and user_id = '${U2}'`));
  assert.equal(unliked.affectedRows, 1);

  const rows = await logRows(db);
  assert.deepEqual(rows.map((row) => [row.table_name, row.op, row.env]), [
    ["combo_posts", "I", "development"],
    ["likes", "I", "development"],
    ["combo_posts", "U", "development"],
    ["likes", "I", "production"],
    ["combo_posts", "U", "development"],
    ["contact_inquiries", "I", "production"],
    ["this_or_that_post_likes", "I", "development"],
    ["this_or_that_posts", "U", "development"],
    ["likes", "D", "production"],
  ], "client writes are logged, with the counter updates they cause");
  assert.deepEqual(rows[2].new_row, { like_count: 1 }, "the like's counter update logs only like_count");
  assert.deepEqual(rows[4].new_row, { content_text: "edited text" });
  const inquiryRow = rows.find((row) => row.table_name === "contact_inquiries");
  assert.equal(inquiryRow?.new_row?.message, "a message long enough", "the log has the row as the BEFORE trigger left it");
  await assertRowBytes(db);

  // Writes RLS refuses: nothing reaches the log.
  await clearLog(db);
  assert.equal(await errorCode(() => asRole(db, "authenticated", U1, () => db.query(
    `insert into public.likes (story_id, user_id, env) values ('byrdispatch', '${U2}', 'development')`))), "42501");
  assert.equal(await errorCode(() => asRole(db, "anon", null, () => db.query(
    `insert into public.likes (story_id, user_id, env) values ('byrdispatch', '${U1}', 'development')`))), "42501");
  const foreignEdit = await asRole(db, "authenticated", U2, () => db.query(
    `update public.combo_posts set content_text = 'not mine' where id = 'a1100000-0000-4000-8000-000000000000'`));
  assert.equal(foreignEdit.affectedRows, 0);
  const foreignDelete = await asRole(db, "authenticated", U2, () => db.query(
    `delete from public.likes where user_id = '${U1}'`));
  assert.equal(foreignDelete.affectedRows, 0);
  assert.equal(await errorCode(() => asRole(db, "authenticated", U2, () => db.query(
    `insert into public.contact_inquiries (user_id, category, message, page_path, service_locale, game_locale, env)
     values ('${U1}', 'feedback', 'someone else''s inquiry', '/codex', 'ko', 'kor', 'production')`))), "42501");
  assert.deepEqual(await logRows(db), [], "refused writes log nothing");
}

async function triggerTables(db: PGlite): Promise<string[]> {
  const { rows } = await db.query<{ table_name: string }>(`select c.relname as table_name
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where t.tgname = 'd1_change_log' and not t.tgisinternal order by 1`);
  return rows.map((row) => row.table_name);
}

async function main() {
  assert.equal(CHANGE_LOG.length, 1, "one change-log migration");
  assert.equal(LOGGED_TABLES.length, 27);
  assert.equal(new Set(CASES.map((c) => c.table)).size, 27);
  assert.deepEqual([...CASES.map((c) => c.table)].sort(), [...LOGGED_TABLES].sort(), "every logged table has a case");
  assert.ok(existsSync(ROLLBACK), "rollback script in place");

  const dump = process.env.SUPABASE_PUBLIC_SCHEMA;
  if (dump) await compareWithDump(dump);
  else console.log("schema check skipped: set SUPABASE_PUBLIC_SCHEMA to a public schema dump");

  const db = await repoSchema();
  const { rows: publicTables } = await db.query<{ relname: string }>(
    "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1");
  assert.deepEqual(publicTables.map((row) => row.relname), [...LOGGED_TABLES, ...UNLOGGED_TABLES].sort(),
    "the repo SQL builds the 27 logged tables and the four the design leaves behind");

  await db.exec(SETUP);
  const migration = `${MIGRATIONS}/${CHANGE_LOG[0]}`;
  await applyFile(db, migration);
  assert.deepEqual(await triggerTables(db), [...LOGGED_TABLES].sort(), "one trigger on each logged table");
  const { rows: runsTrigger } = await db.query<{ def: string }>(
    "select pg_get_triggerdef(oid) as def from pg_trigger where tgname = 'd1_change_log' and tgrelid = 'public.runs'::regclass");
  assert.match(runsTrigger[0].def, /d1_log_change\('raw'\)$/, "runs names raw as its heavy column");

  for (const c of CASES) await checkCase(db, c);
  await checkRunsRaw(db);
  await checkCommentLikeEnv(db);
  await checkPrivileges(db);
  await checkClientWrites(db);

  // The cases expect a null env only where the table has no env column.
  for (const table of ENVLESS_TABLES) {
    const { rows } = await db.query<{ has_env: boolean }>(
      "select exists (select 1 from pg_attribute where attrelid = ('public.' || $1)::regclass and attname = 'env') as has_env", [table]);
    assert.equal(rows[0].has_env, false, `${table} has no env column`);
  }

  // Applying the file again changes nothing.
  await applyFile(db, migration);
  assert.deepEqual(await triggerTables(db), [...LOGGED_TABLES].sort());

  await applyFile(db, ROLLBACK);
  const { rows: leftovers } = await db.query<Json>(`select
      to_regclass('public.d1_change_log') as log_table,
      to_regclass('public.d1_change_log_id_seq') as log_sequence,
      to_regprocedure('public.d1_log_change()') as log_function,
      (select count(*)::int from pg_trigger where tgname = 'd1_change_log') as triggers`);
  assert.deepEqual(leftovers[0], { log_table: null, log_sequence: null, log_function: null, triggers: 0 }, "the rollback leaves nothing");
  const afterRollback = await asRole(db, "authenticated", U1, () => db.query(
    `insert into public.likes (story_id, user_id, env) values ('byrdispatch', '${U1}', 'production')`));
  assert.equal(afterRollback.affectedRows, 1, "writes work after the rollback");

  await db.close();
  console.log(`d1-change-log spec passed (${CASES.length} tables)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
