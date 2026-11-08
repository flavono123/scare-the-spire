/**
 * Design 6 shadow reads over a real Supabase backup: the backup's schema and rows go into PGlite (the
 * Supabase side, behind the PostgREST stand-in), each env's rows go through the first-copy path into a
 * SQLite copy of the D1 schema, and every step-1 read route is asked with parameters taken from the
 * data (every post, run, thread key, user with activity, feed page). Every pair must compare equal
 * under the design-6 rules (known differences such as orphan bodies count as expected).
 *
 *   pnpm exec tsx scripts/d1-shadow-backup-check.ts <backup dir with public.dump and public-schema.sql> [--work <dir>] [--verbose]
 *
 * Skipped (exit 0) when no backup directory is given. The backup holds personal data: the extracted
 * SQL goes to --work (default: a temp directory removed at the end), nothing is written into the
 * repository, and the report prints route ids, counts and difference paths only (values with --verbose).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PGlite } from "@electric-sql/pglite";

import { isThreadKey } from "../src/lib/engagement-keys";
import { parseCopyLine } from "../src/lib/d1-sync/pg-text";
import { TOYBOX_RPC_FEED_SERVICES } from "../src/lib/toybox-api-rules";
import type { SupabaseApiConfig } from "../workers/api/supabase-rest";
import { SqliteD1 } from "./d1-shadow/d1-shim";
import { fakePostgrest, TEST_SUPABASE_URL } from "./d1-shadow/fake-postgrest";
import { firstCopy } from "./d1-shadow/fixture";
import { harness } from "./d1-shadow/harness";
import { loadRows, openSupabase } from "./d1-shadow/supabase-pglite";
import { compareShadow } from "../workers/api/shadow/shadow";
import { SHADOW_SPECS } from "../workers/api/shadow/specs";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const workFlag = args.indexOf("--work");
const workArg = workFlag >= 0 ? args[workFlag + 1] : undefined;
const backupDir = args.find((arg, i) => !arg.startsWith("--") && (workFlag < 0 || i !== workFlag + 1)) ?? process.env.D1_SYNC_BACKUP_DIR;
const dumpPath = backupDir ? join(backupDir, "public.dump") : "";
const schemaPath = backupDir ? join(backupDir, "public-schema.sql") : "";
if (!backupDir || !existsSync(dumpPath) || !existsSync(schemaPath)) {
  console.log("d1 shadow backup check skipped (no backup directory with public.dump and public-schema.sql given)");
  process.exit(0);
}

function pgRestoreBin(): string {
  if (process.env.PG_RESTORE) return process.env.PG_RESTORE;
  const brew = "/opt/homebrew/opt/libpq/bin/pg_restore";
  return existsSync(brew) ? brew : "pg_restore";
}

function literal(value: string | null): string {
  return value === null ? "null" : `'${value.replace(/'/g, "''")}'`;
}

/** COPY blocks of a pg_restore --data-only text as INSERTs (identity values kept). */
function insertsFrom(text: string): string[] {
  const out: string[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = /^COPY public\.(\w+) \((.*)\) FROM stdin;$/.exec(lines[i]);
    if (!match) continue;
    const columns = match[2];
    for (i += 1; lines[i] !== "\\."; i++) {
      const fields = parseCopyLine(lines[i]);
      out.push(`insert into public.${match[1]} (${columns}) overriding system value values (${fields.map(literal).join(", ")});`);
    }
  }
  return out;
}

type Ask = { route: string; query?: string; user?: string | null };

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function column(db: PGlite, sql: string): Promise<string[]> {
  return (await db.query<{ v: string }>(sql)).rows.map((row) => String(row.v));
}

/** Parameters taken from the data of one env: the shapes the clients send, over every row. */
async function asks(db: PGlite, env: string): Promise<Ask[]> {
  const e = `'${env}'`;
  const list: Ask[] = [{ route: "read.nav" }, { route: "read.engagement-counts" }, { route: "read.profile.nicknames" }];
  const threadKeys = (await column(db, `select distinct story_id as v from public.comments where env = ${e} order by 1`)).filter(isThreadKey);
  for (const group of chunks(threadKeys, 24)) list.push({ route: "read.engagement", query: `threads=${group.join(",")}` });
  const likeKeys = (await column(db, `select distinct story_id as v from public.likes where env = ${e} order by 1`)).filter(isThreadKey);
  for (const group of chunks(likeKeys, 16)) list.push({ route: "read.engagement", query: `likes=${group.join(",")}` });
  const targets = await column(db, `select distinct resource_type || ':' || resource_id || ':' || game_version as v from public.resource_reaction_counts where env = ${e} order by 1`);
  for (const group of chunks(targets.filter((key) => /^[a-z_-]{1,32}:[A-Za-z0-9._-]{1,128}:[A-Za-z0-9._-]{1,32}$/.test(key)), 64)) {
    list.push({ route: "read.engagement", query: `reactions=${group.join(",")}` });
  }
  const resources = (await column(db, `select distinct resource_type || ':' || resource_id as v from public.colorful_philosopher_posts where env = ${e} order by 1`))
    .filter((key) => /^[a-z_-]{1,32}:[A-Za-z0-9._-]{1,128}$/.test(key));
  for (const group of chunks(resources, 4)) list.push({ route: "read.engagement", query: `philosophers=${group.join(",")}` });

  const activeUsers = await column(db, `select v from (
      select user_id::text as v from public.comments where env = ${e}
      union all select user_id::text from public.likes where env = ${e}
      union all select user_id::text from public.resource_reactions where env = ${e}
      union all select user_id::text from public.community_stories where env = ${e} and user_id is not null
      union all select donor_user_id::text from public.runs where env = ${e} and donor_user_id is not null
      union all select user_id::text from public.contact_inquiries where env = ${e} and user_id is not null
      union all select user_id::text from public.puzzlebox_best where env = ${e}
      union all select user_id::text from public.pagestorm_drafts where env = ${e}
      union all select user_id::text from public.this_or_that_post_votes where env = ${e}
    ) a group by v order by count(*) desc, v limit 8`);
  for (const user of activeUsers) {
    const liked = (await column(db, `select distinct c.story_id as v from public.comment_likes l join public.comments c on c.id = l.comment_id where l.user_id = '${user}' and c.env = ${e}`)).filter(isThreadKey);
    for (const group of chunks(liked, 24)) list.push({ route: "me.engagement", query: `threads=${group.join(",")}`, user });
    const mine = (await column(db, `select story_id as v from public.likes where user_id = '${user}' and env = ${e}`)).filter(isThreadKey);
    for (const group of chunks(mine, 16)) list.push({ route: "me.engagement", query: `likes=${group.join(",")}`, user });
    const reacted = await column(db, `select resource_type || ':' || resource_id || ':' || game_version as v from public.resource_reactions where user_id = '${user}' and env = ${e}`);
    for (const group of chunks(reacted, 64)) list.push({ route: "me.engagement", query: `reactions=${group.join(",")}`, user });
    list.push({ route: "me.mailbox", user }, { route: "me.profile.stats", user }, { route: "me.profile.inquiries", user }, { route: "me.history-runs", user });
    list.push({ route: "me.pagestorm.drafts", user });
    for (const category of ["all", "stories", "chemical_x", "this_or_that", "combo", "comments", "history_course"]) {
      for (const sort of ["latest", "likes"]) {
        for (const offset of category === "all" ? [0, 20] : [0]) list.push({ route: "me.profile.activity", query: `category=${category}&sort=${sort}&offset=${offset}`, user });
      }
    }
  }

  list.push({ route: "read.colorful-philosophers.week" }, { route: "read.colorful-philosophers.reel" });
  for (const id of await column(db, `select id::text as v from public.colorful_philosopher_posts where env = ${e}`)) {
    list.push({ route: "read.colorful-philosophers.post", query: `id=${id}` });
  }

  for (const game of ["connections", "beta-quiz"]) {
    const boards = (await db.query<{ board: string; top: number }>(`select board, max(score) as top from public.puzzlebox_best where env = ${e} and game = '${game}' group by board order by board::int`)).rows;
    if (!boards.length) continue;
    const map = boards.map((row) => `${row.board}:${Math.max(0, Number(row.top))}`).join(",");
    for (const board of ["total", ...boards.slice(0, 5).map((row) => row.board)]) {
      for (const offset of [0, 10]) list.push({ route: "read.puzzlebox.leaderboard", query: `game=${game}&boards=${map}&board=${board}&offset=${offset}&around_me=0` });
    }
    for (const user of (await column(db, `select distinct user_id::text as v from public.puzzlebox_best where env = ${e} and game = '${game}' limit 5`))) {
      list.push({ route: "me.puzzlebox.leaderboard", query: `game=${game}&boards=${map}&board=total&offset=0&around_me=1`, user });
      list.push({ route: "me.puzzlebox.standings", query: `game=${game}&boards=${map}`, user });
    }
  }

  list.push({ route: "read.history-runs", query: "view=recent" }, { route: "read.history-runs", query: "view=reference" });
  const runIds = (await column(db, `select id as v from public.runs where env = ${e} order by created_at desc`)).filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id));
  for (const id of runIds) {
    for (const view of ["detail", "meta", "cover"]) list.push({ route: "read.history-run", query: `id=${id}&view=${view}` });
  }
  for (const group of chunks(runIds, 100)) list.push({ route: "read.history-runs.engagement", query: `ids=${group.join(",")}` });

  for (const limit of [100, 200, 1000]) list.push({ route: "read.stories", query: `limit=${limit}` });
  for (const source of (await column(db, `select distinct source as v from public.community_stories where env = ${e} and source is not null`)).filter((value) => /^[A-Za-z0-9._-]{1,64}$/.test(value))) {
    list.push({ route: "read.stories", query: `limit=200&source=${source}` });
  }

  const tables: Record<string, string> = {
    combo: "combo_posts", transfigure: "transfigure_posts", this_or_that: "this_or_that_posts", chemical_x: "chemical_posts",
    decisions_decisions: "decisions_decisions_posts", favorite_tournament: "favorite_tournament_posts", pagestorm: "pagestorm_posts",
  };
  for (const [service, table] of Object.entries(tables)) {
    for (const id of await column(db, `select id::text as v from public.${table} where env = ${e}`)) list.push({ route: "read.toybox-post", query: `service=${service}&id=${id}` });
  }
  list.push({ route: "read.favorite-tournament.presets" }, { route: "read.pagestorm.posts" });
  for (const id of await column(db, `select id::text as v from public.favorite_tournament_posts where env = ${e}`)) {
    list.push({ route: "read.favorite-tournament.stats", query: `id=${id}` });
  }
  for (const row of (await db.query<{ s: string; i: string }>(`select source_service as s, source_id::text as i from public.defragment_bodies where env = ${e}`)).rows) {
    list.push({ route: "read.defragment-body", query: `service=${row.s}&id=${row.i}` });
  }
  for (const row of (await db.query<{ u: string; i: string }>(`select user_id::text as u, id::text as i from public.pagestorm_drafts where env = ${e}`)).rows) {
    list.push({ route: "me.pagestorm.drafts", query: `id=${row.i}`, user: row.u });
  }
  const totIds = await column(db, `select id::text as v from public.this_or_that_posts where env = ${e}`);
  for (const group of chunks(totIds, 100)) list.push({ route: "read.this-or-that.like-counts", query: `ids=${group.join(",")}` });
  for (const group of chunks(totIds, 50)) list.push({ route: "read.this-or-that.vote-summaries", query: `ids=${group.join(",")}` });
  for (const user of await column(db, `select distinct user_id::text as v from (select user_id from public.this_or_that_post_votes where env = ${e} union select user_id from public.this_or_that_post_likes where env = ${e}) a limit 8`)) {
    for (const group of chunks(totIds, 100)) {
      list.push({ route: "me.this-or-that.votes", query: `ids=${group.join(",")}`, user }, { route: "me.this-or-that.likes", query: `ids=${group.join(",")}`, user });
    }
  }
  return list;
}

type Tally = { asked: number; same: number; expected: number; differed: number; nonEmpty: number; skipped: Record<string, number>; failures: string[] };

/** An answer with at least one row or entry (so a "same" is not two empty answers). */
function hasContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, item]) => key !== "v" && key !== "env" && (Array.isArray(item) ? item.length > 0 : item !== null && typeof item === "object" ? Object.keys(item).length > 0 : typeof item === "boolean"));
}

async function main() {
  const workDir = workArg ?? mkdtempSync(join(tmpdir(), "d1-shadow-check-"));
  const sqlPath = join(workDir, "public-data.sql");
  try {
    execFileSync(pgRestoreBin(), ["--data-only", "-f", sqlPath, dumpPath], { stdio: ["ignore", "ignore", "inherit"] });
    const { db } = await openSupabase(schemaPath);
    const inserts = insertsFrom(readFileSync(sqlPath, "utf8"));
    for (const group of chunks(inserts, 200)) await loadRows(db, group.join("\n"));
    console.log(`loaded ${inserts.length} rows from ${dumpPath.split("/").slice(-2).join("/")}`);
    const fake = fakePostgrest(db);
    const realFetch = globalThis.fetch;
    globalThis.fetch = fake.fetch as typeof fetch;
    let failed = false;
    try {
      for (const env of ["development", "production"] as const) {
        const { sqlite, report } = await firstCopy(db, env);
        const rejects = report.rejects.reduce<Record<string, number>>((acc, item) => ({ ...acc, [`${item.table}:${item.reason}`]: (acc[`${item.table}:${item.reason}`] ?? 0) + 1 }), {});
        console.log(`${env}: first copy rejects ${JSON.stringify(rejects)}`);
        // Postgres sorts NULL first in DESC, SQLite last: the picker (R2, start_time DESC) differs if any run has none.
        const nullStart = (await db.query<{ n: number }>(`select count(*)::int as n from public.runs where env = '${env}' and start_time is null`)).rows[0].n;
        console.log(`${env}: runs without start_time ${nullStart}`);
        const config: SupabaseApiConfig = { url: TEST_SUPABASE_URL, key: "sb_publishable_test", dataEnv: env };
        const h = harness(new SqliteD1(sqlite), config);
        const tallies = new Map<string, Tally>();
        const all = await asks(db, env);
        // Feeds: every page of every service and sort, following the client's cursor.
        const walks: Ask[] = [];
        for (const service of TOYBOX_RPC_FEED_SERVICES) {
          for (const sort of ["latest", "recommended", "comments", "vote_rate_high", "vote_rate_low", "play_count"]) walks.push({ route: "read.toybox-feed", query: `service=${service}&sort=${sort}` });
        }
        for (const sort of ["latest", "recommended", "comments"]) walks.push({ route: "read.defragment-feed", query: `sort=${sort}` }, { route: "read.defragment-runs", query: `sort=${sort}` });
        const queue = [...all, ...walks];
        while (queue.length) {
          const ask = queue.shift()!;
          const tally = tallies.get(ask.route) ?? { asked: 0, same: 0, expected: 0, differed: 0, nonEmpty: 0, skipped: {}, failures: [] };
          tallies.set(ask.route, tally);
          tally.asked += 1;
          const { side, shadow, status } = await h.supabaseSide(ask.route, ask.query ?? "", ask.user ?? null);
          if (status !== 200 || !side.ok) {
            const reason = status !== 200 ? `status_${status}` : side.ok ? "" : side.reason;
            tally.skipped[reason] = (tally.skipped[reason] ?? 0) + 1;
            continue;
          }
          const outcome = await compareShadow(SHADOW_SPECS[ask.route], shadow, side, { maxBytes: Number.MAX_SAFE_INTEGER });
          if (hasContent(side.answer)) tally.nonEmpty += 1;
          if (outcome.kind === "same") tally.same += 1;
          else if (outcome.kind === "expected") tally.expected += 1;
          else if (outcome.kind === "skipped") tally.skipped[outcome.reason] = (tally.skipped[outcome.reason] ?? 0) + 1;
          else {
            tally.differed += 1;
            const paths = outcome.entries.slice(0, 4).map((entry) => entry.path).join(", ");
            tally.failures.push(verbose ? `${ask.query ?? ""}: ${JSON.stringify(outcome.entries).slice(0, 2000)}` : `${outcome.kind} at ${paths}`);
          }
          // Next page of a feed walk.
          if ((ask.route === "read.toybox-feed" || ask.route.startsWith("read.defragment-")) && Array.isArray(side.answer) && side.answer.length === 20) {
            const params = new URLSearchParams(ask.query ?? "");
            const sort = params.get("sort") ?? "latest";
            const last = side.answer[side.answer.length - 1] as Record<string, unknown> & { post?: Record<string, unknown> };
            const post = last.post ?? {};
            const total = Number(post.left_vote_count) + Number(post.right_vote_count);
            const score = sort === "comments" ? last.comment_count
              : sort === "recommended" ? last.like_count
              : sort === "vote_rate_high" ? total
              : sort === "vote_rate_low" ? 1_000_000_000 - total
              : sort === "play_count" ? post.play_count
              : last.recommend_score ?? last.like_count;
            params.set("score", String(score));
            params.set("created_at", String(post.created_at ?? last.created_at));
            params.set("cursor_id", String(last.id));
            queue.push({ route: ask.route, query: params.toString() });
          }
        }
        for (const [route, tally] of [...tallies].sort()) {
          const skipped = Object.keys(tally.skipped).length ? ` skipped ${JSON.stringify(tally.skipped)}` : "";
          console.log(`${env} ${route}: ${tally.asked} asked (${tally.nonEmpty} with rows), ${tally.same} same, ${tally.expected} expected, ${tally.differed} differed${skipped}`);
          for (const failure of tally.failures.slice(0, verbose ? 20 : 5)) console.log(`  ${failure}`);
          if (tally.differed) failed = true;
        }
      }
    } finally {
      globalThis.fetch = realFetch;
      await db.close();
    }
    if (failed) {
      console.error("d1 shadow backup check found differences");
      process.exit(1);
    }
    console.log("d1 shadow backup check passed");
  } finally {
    if (!workArg) rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
