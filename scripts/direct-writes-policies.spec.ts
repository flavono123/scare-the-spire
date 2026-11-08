/**
 * The step 4 scripts that close and restore the browser's direct writes to Supabase
 * (docs/release/step4-direct-writes/*.sql, docs/supabase-exit/STEP4_WRITE_GATE.md 7), on PGlite with the
 * public schema rebuilt from the repo's supabase SQL plus the step 4 migration. Closing must leave
 * anon and authenticated no way to write (no write policy, no write RPC) while the service role still
 * writes through the Worker's paths; restoring must bring back exactly the policies and grants of today.
 * The step 4 migration's rollback must bring back today's triggers, functions and grants exactly.
 * Usage: tsx scripts/direct-writes-policies.spec.ts
 * SUPABASE_PUBLIC_SCHEMA=<pg_dump --schema-only of public> also restores onto that dump and compares.
 */
import assert from "node:assert/strict";

import type { PGlite } from "@electric-sql/pglite";

import { applySqlFile, repoSchemaFiles, supabaseFromDump, supabaseFromRepo } from "./lib/supabase-pglite";

const MIGRATION = "supabase/migrations/20261108160000_worker_write_actor.sql";
const ROLLBACK = "docs/release/worker-write-actor/rollback_worker_write_actor.sql";
const CLOSE = "docs/release/step4-direct-writes/close_direct_writes.sql";
const RESTORE = "docs/release/step4-direct-writes/restore_direct_writes.sql";
const U1 = "11111111-1111-4111-8111-111111111111";
const COMBO = "a1000000-0000-4000-8000-000000000001";
const FAV = "f0000000-0000-4000-8000-000000000001";
const POOL = JSON.stringify([{ type: "card", id: "BASH" }, { type: "card", id: "STRIKE" }]);

// Grants as sorted lists: a revoke and grant back can reorder an ACL without changing it.
const SNAPSHOT = `
select jsonb_build_object(
  'policies', (select jsonb_agg(jsonb_build_array(tablename, policyname, permissive, roles, cmd, qual, with_check) order by tablename, policyname)
    from pg_catalog.pg_policies where schemaname = 'public'),
  'functions', (select jsonb_agg(jsonb_build_array(p.proname, (select jsonb_agg(a::text order by a::text) from unnest(p.proacl) a)) order by p.proname)
    from pg_catalog.pg_proc p where p.pronamespace = 'public'::regnamespace),
  'tables', (select jsonb_agg(jsonb_build_array(c.relname, (select jsonb_agg(a::text order by a::text) from unnest(c.relacl) a), c.relrowsecurity) order by c.relname)
    from pg_catalog.pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v'))
) as snapshot`;

async function snapshot(db: PGlite) {
  await db.exec("set search_path = ''");
  const { rows } = await db.query<{ snapshot: unknown }>(SNAPSHOT);
  await db.exec("reset search_path");
  return rows[0].snapshot;
}

async function as<T>(db: PGlite, role: "authenticated" | "service_role", sub: string | null, sql: string): Promise<{ ok: true; rows: T[]; affected: number } | { ok: false; code: string }> {
  try {
    const result = await db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [sub ?? ""]);
      return tx.query<T>(sql);
    });
    return { ok: true, rows: result.rows, affected: result.affectedRows ?? 0 };
  } catch (error) {
    return { ok: false, code: String((error as { code?: string }).code) };
  }
}

const insertComment = `insert into public.comments (story_id, user_id, nickname, content, env) values ('k', '${U1}', '닉', 'hello', 'development')`;
const updateCombo = `update public.combo_posts set content_text = 'edited' where id = '${COMBO}'`;
const deleteCombo = `delete from public.combo_posts where id = '${COMBO}'`;
const play = (fn: string, actor: string) => `select public.${fn}(${actor}'${FAV}', 'development', 2, 'card', 'BASH',
  '[{"left_type":"card","left_id":"BASH","right_type":"card","right_id":"STRIKE","winner":"left"}]'::jsonb)`;
const inquiry = (owner: string) => `insert into public.contact_inquiries (user_id, category, message, page_path, service_locale, game_locale, env)
  values (${owner}, 'bug', 'a long enough question', '/codex', 'ko', 'kor', 'development')`;

async function check(db: PGlite, label: string) {
  await db.exec(`
    insert into auth.users (id) values ('${U1}');
    insert into public.combo_posts (id, user_id, nickname, content, content_text, resources, env)
      values ('${COMBO}', '${U1}', '닉', '[]', 'combo', '${POOL}', 'development');
    insert into public.favorite_tournament_posts (id, user_id, nickname, title, preset_key, game_version, pool, env)
      values ('${FAV}', '${U1}', '닉', 'cup', 'custom', '0.1', '${POOL}', 'development');
  `);
  const before = await snapshot(db);

  // Every public table has RLS on, and the one view takes no writes, so policies are the only way in.
  const { rows: noRls } = await db.query<{ relname: string }>(
    "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity");
  assert.deepEqual(noRls, [], `${label}: every table has RLS`);
  const { rows: writableViews } = await db.query<{ table_name: string }>(
    "select table_name from information_schema.views where table_schema = 'public' and (is_insertable_into = 'YES' or is_updatable = 'YES')");
  assert.deepEqual(writableViews, [], `${label}: no writable view`);

  // Today: the browser writes through its policies.
  assert.equal((await as(db, "authenticated", U1, insertComment)).ok, true);
  assert.equal((await as(db, "authenticated", U1, updateCombo) as { affected: number }).affected, 1);

  await applySqlFile(db, CLOSE);
  await applySqlFile(db, CLOSE);
  const { rows: left } = await db.query<{ n: number }>(
    "select count(*)::int as n from pg_policies where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')");
  assert.equal(left[0].n, 0, `${label}: no write policy left`);
  const { rows: reads } = await db.query<{ n: number }>("select count(*)::int as n from pg_policies where schemaname = 'public' and cmd = 'SELECT'");
  assert.equal(reads[0].n, (before as { policies: unknown[] }).policies.length - 50, `${label}: the read policies stay`);

  assert.deepEqual(await as(db, "authenticated", U1, insertComment), { ok: false, code: "42501" }, `${label}: closed insert`);
  assert.equal((await as(db, "authenticated", U1, updateCombo) as { affected: number }).affected, 0, `${label}: closed update`);
  assert.equal((await as(db, "authenticated", U1, deleteCombo) as { affected: number }).affected, 0, `${label}: closed delete`);
  assert.deepEqual(await as(db, "authenticated", U1, play("complete_favorite_tournament_play", "")), { ok: false, code: "42501" }, `${label}: closed rpc`);
  assert.deepEqual(await as(db, "authenticated", U1, inquiry(`'${U1}'`)), { ok: false, code: "42501" }, `${label}: closed inquiry`);

  // The Worker's service-role paths still write.
  assert.equal((await as(db, "service_role", null, insertComment)).ok, true, `${label}: service insert`);
  assert.equal((await as(db, "service_role", null, updateCombo) as { affected: number }).affected, 1, `${label}: service update`);
  assert.equal((await as(db, "service_role", null, play("worker_complete_favorite_tournament_play", `'${U1}', `))).ok, true, `${label}: service rpc`);
  assert.equal((await as(db, "service_role", null, inquiry(`'${U1}'`))).ok, true, `${label}: service inquiry (trigger skipped)`);
  assert.deepEqual(await as(db, "authenticated", U1, play("worker_complete_favorite_tournament_play", `'${U1}', `)), { ok: false, code: "42501" }, `${label}: the wrapper is service-only`);

  await applySqlFile(db, RESTORE);
  await applySqlFile(db, RESTORE);
  assert.deepEqual(await snapshot(db), before, `${label}: restore brings back today's policies and grants`);
  assert.equal((await as(db, "authenticated", U1, insertComment)).ok, true, `${label}: restored insert`);
  console.log(`${label}: close and restore ok`);
}

const TRIGGERS = `
select coalesce(jsonb_agg(jsonb_build_array(c.relname, t.tgname, pg_catalog.pg_get_triggerdef(t.oid)) order by c.relname, t.tgname), '[]'::jsonb) as triggers
from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid
where c.relnamespace = 'public'::regnamespace and not t.tgisinternal`;

async function triggers(db: PGlite) {
  const { rows } = await db.query<{ triggers: unknown }>(TRIGGERS);
  return rows[0].triggers;
}

/** The step 4 migration on a database without it, then its rollback (twice): back to today. */
async function rollbackCheck(db: PGlite, label: string) {
  await db.exec(`insert into auth.users (id) values ('${U1}')`);
  const before = { grants: await snapshot(db), triggers: await triggers(db) };
  // Today the service role cannot write an inquiry with a user (auth.uid() is NULL): design 5.5.
  assert.deepEqual(await as(db, "service_role", null, inquiry(`'${U1}'`)), { ok: false, code: "42501" }, `${label}: today service inquiry`);

  await applySqlFile(db, MIGRATION);
  assert.equal((await as(db, "service_role", null, inquiry(`'${U1}'`))).ok, true, `${label}: service inquiry after the migration`);
  assert.deepEqual(await as(db, "authenticated", U1, inquiry(`'${COMBO}'`)), { ok: false, code: "42501" }, `${label}: the trigger still checks browser roles`);
  assert.notDeepEqual(await triggers(db), before.triggers, `${label}: the migration changed the trigger`);

  await applySqlFile(db, ROLLBACK);
  await applySqlFile(db, ROLLBACK);
  assert.deepEqual(await snapshot(db), before.grants, `${label}: rollback brings back today's policies, functions and grants`);
  assert.deepEqual(await triggers(db), before.triggers, `${label}: rollback brings back today's triggers`);
  assert.deepEqual(await as(db, "service_role", null, inquiry(`'${U1}'`)), { ok: false, code: "42501" }, `${label}: service inquiry refused again`);
  console.log(`${label}: migration rollback ok`);
}

async function main() {
  const today = await supabaseFromRepo(repoSchemaFiles((file) => file.endsWith("_d1_change_log.sql") || file === MIGRATION));
  await rollbackCheck(today, "repo schema");
  await today.close();
  const repo = await supabaseFromRepo(repoSchemaFiles((file) => file.endsWith("_d1_change_log.sql")));
  await check(repo, "repo schema + step 4 migration");
  await repo.close();
  const dump = process.env.SUPABASE_PUBLIC_SCHEMA;
  if (dump) {
    const step4 = repoSchemaFiles().filter((file) => file.endsWith("_worker_write_actor.sql"));
    const live = await supabaseFromDump(dump, step4);
    await check(live, "dump + step 4 migration");
    await live.close();
    const liveToday = await supabaseFromDump(dump);
    await rollbackCheck(liveToday, "dump");
    await liveToday.close();
  } else {
    console.log("dump check skipped: set SUPABASE_PUBLIC_SCHEMA to a public schema dump");
  }
  console.log("direct-writes policies spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
