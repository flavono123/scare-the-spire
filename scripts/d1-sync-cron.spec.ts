/**
 * The step-2 1-minute sync (workers/sync/run-sync.ts, docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.3 and
 * the sync tests of 9) against an in-memory PostgREST that writes d1_change_log like the real
 * trigger, and a node:sqlite D1 built from d1/migrations. Synthetic rows only.
 *   pnpm exec tsx scripts/d1-sync-cron.spec.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { mapChange, mergeChanges, type ChangeEntry } from "../src/lib/d1-sync/row-mapper";
import { runSync, type SyncReport } from "../workers/sync/run-sync";
import { S1, S11, S13, S13C, S13D, S4, S4D } from "../workers/sync/sync-sql";
import { FakePostgrest, type Row } from "./d1-sync/fake-postgrest";
import {
  ENV,
  OTHER_ENV,
  RAW,
  TS,
  U,
  body,
  candidateStat,
  combo,
  comment,
  commentLike,
  like,
  pagestorm,
  run,
  thisOrThat,
  thisOrThatLike,
  tournament,
  tournamentPlay,
} from "./d1-sync/fixtures";
import { SqliteD1 } from "./d1-sync/sqlite-d1";

const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";
const MINUTE = 60_000;

let checks = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    checks += 1;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

type Harness = {
  d1: SqliteD1;
  rest: FakePostgrest;
  env: Record<string, unknown>;
  logs: string[];
  /** One cron run at the current clock (+ offset), with the per-run limits asserted. */
  sync(options?: { offsetMs?: number; scheduledTime?: number }): Promise<SyncReport>;
  advance(ms: number): void;
  state(): { low_watermark: number; high_seen: number; applied_above: string; fail_count: number; last_error: string };
};

function harness(options: { start?: number | null; flag?: string | null; env?: Record<string, unknown> } = {}): Harness {
  const d1 = new SqliteD1();
  const rest = new FakePostgrest();
  const logs: string[] = [];
  const env = {
    API_RUNTIME_FLAGS: "d1",
    DB: d1,
    API_SUPABASE_URL: PROJECT,
    API_SUPABASE_SECRET_KEY: "sb_secret_spec",
    API_DATA_ENV: ENV,
    ...(options.env ?? {}),
  };
  const flag = options.flag === undefined ? "on" : options.flag;
  if (flag !== null) {
    d1.sqlite.prepare("INSERT INTO runtime_flags (key, value, updated_at) VALUES ('sync.enabled', ?1, '2026-11-08T00:00:00.000Z')").run(flag);
  }
  const start = options.start === undefined ? 1 : options.start;
  if (start !== null) {
    // The first copy's hand-over (design 5.2 step 7): low_watermark = high_seen = L0 - 1.
    d1.sqlite.prepare("INSERT INTO sync_state (name, low_watermark, high_seen) VALUES ('supabase_in', ?1, ?1)").run(start - 1);
  }
  let lastRun = 0;
  return {
    d1,
    rest,
    env,
    logs,
    advance(ms) {
      rest.clock += ms;
    },
    async sync({ offsetMs = 30_000, scheduledTime } = {}) {
      const now = Math.max(rest.clock + offsetMs, lastRun + MINUTE);
      lastRun = now;
      const statementsBefore = d1.statements;
      const callsBefore = rest.calls.length;
      const report = await runSync(env as never, {
        now: () => now,
        scheduledTime: scheduledTime ?? now,
        fetcher: rest.fetcher,
        log: (line) => logs.push(line),
      });
      const statements = d1.statements - statementsBefore;
      const subrequests = rest.calls.length - callsBefore;
      // A failed batch counts whole in the report (D1 may bill the statements it ran before the error).
      assert.ok(report.statements >= statements, "the report counts every D1 statement");
      assert.equal(report.subrequests, subrequests, "the report counts every fetch");
      assert.ok(report.statements <= 45, `D1 statements ${report.statements} <= 45 (limit 50)`);
      assert.ok(subrequests <= 50, `subrequests ${subrequests} <= 50`);
      assert.ok(report.rawBytes <= 2 * 1024 * 1024, "raw bytes per run <= 2 MB");
      return report;
    },
    state() {
      return d1.one("SELECT low_watermark, high_seen, applied_above, fail_count, last_error FROM sync_state WHERE name = 'supabase_in'") as never;
    },
  };
}

/** Runs until a run processes nothing new (at most `max` runs). */
async function drain(h: Harness, max = 40, advanceMs = MINUTE): Promise<SyncReport[]> {
  const reports: SyncReport[] = [];
  for (let i = 0; i < max; i++) {
    h.advance(advanceMs);
    const report = await h.sync();
    reports.push(report);
    const st = h.state();
    if (report.processed.length === 0 && report.raws.length === 0 && JSON.parse(st.applied_above).length === 0) break;
  }
  return reports;
}

function count(h: Harness, sql: string): number {
  return Number(h.d1.one(sql)?.n ?? 0);
}

function queriesSqlStatement(id: string): string {
  const text = readFileSync("docs/supabase-exit/d1-schema/queries.sql", "utf8");
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`-- @ ${id} `));
  assert.ok(start >= 0, `queries.sql has ${id}`);
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("-- @") || (lines[i].trim() === "" && out.length > 0)) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();

async function main() {
  // ----------------------------------------------------------------------------- statements

  await check("S1, S4, S4d, S11, S13, S13c and S13d are queries.sql verbatim", () => {
    for (const [id, sql] of Object.entries({ S1, S4, S4d: S4D, S11, S13, S13c: S13C, S13d: S13D })) {
      assert.equal(norm(sql), norm(queriesSqlStatement(id)), id);
    }
  });

  // ----------------------------------------------------------------------------- inert by default

  await check("inert unless API_RUNTIME_FLAGS is d1, sync.enabled is on and the watermark was handed over", async () => {
    for (const value of ["off", undefined, ""]) {
      const h = harness({ env: { API_RUNTIME_FLAGS: value } });
      const report = await runSync(h.env as never, { fetcher: h.rest.fetcher, log: () => undefined });
      assert.equal(report.status, "off");
      assert.equal(h.d1.statements, 0, "no D1 query while the master var is off");
      assert.equal(h.rest.calls.length, 0);
    }
    for (const flag of [null, "off", "api"]) {
      const h = harness({ flag });
      const report = await runSync(h.env as never, { fetcher: h.rest.fetcher, log: () => undefined });
      assert.equal(report.status, "flag_off");
      assert.equal(h.d1.statements, 1, "one gate read");
      assert.equal(h.rest.calls.length, 0, "no Supabase call while sync.enabled is not on");
      assert.equal(count(h, "SELECT count(*) AS n FROM sync_state WHERE lease_until > 0"), 0, "no lease taken");
    }
    const notStarted = harness({ start: null });
    assert.equal((await runSync(notStarted.env as never, { fetcher: notStarted.rest.fetcher, log: () => undefined })).status, "not_started");
    assert.equal(count(notStarted, "SELECT count(*) AS n FROM sync_state"), 0, "the gate never creates sync_state");
    for (const key of [undefined, "sb_publishable_x", "eyJhbGciOi"]) {
      const h = harness({ env: { API_SUPABASE_SECRET_KEY: key } });
      assert.equal((await runSync(h.env as never, { fetcher: h.rest.fetcher, log: () => undefined })).status, "not_configured");
      assert.equal(h.rest.calls.length, 0);
    }
  });

  await check("every Supabase call uses the secret key and this env", async () => {
    const h = harness();
    h.rest.insert("comments", comment(1, "sts2-codex:card:bash"));
    h.rest.insert("comments", comment(2, "sts2-codex:card:bash", U(2), { env: OTHER_ENV }));
    await h.sync();
    assert.ok(h.rest.calls.length > 0);
    assert.ok(h.rest.calls.every((call) => call.apikey === "sb_secret_spec"));
    const headerCall = h.rest.calls.find((call) => call.table === "d1_change_log" && call.query.get("select")?.includes("row_bytes"));
    assert.equal(headerCall?.query.get("or"), `(env.eq.${ENV},env.is.null)`);
    assert.equal(count(h, "SELECT count(*) AS n FROM comments"), 1, "the other env's comment is not copied");
  });

  // ----------------------------------------------------------------------------- basic apply

  await check("comments, likes, a combo with resources and its body land with their recounts", async () => {
    const h = harness();
    const key = "sts2-codex:card:bash";
    h.rest.insert("comments", comment(1, key));
    h.rest.insert("comments", comment(2, key, U(2)));
    h.rest.insert("likes", like(key, U(3)));
    h.rest.insert("comment_likes", commentLike(U(100_001), U(3)));
    const post = combo(1);
    h.rest.insert("combo_posts", post);
    h.rest.insert("defragment_bodies", body("combo", String(post.id)));
    const report = await h.sync();
    assert.equal(report.status, "ok");
    assert.deepEqual(report.processed, [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(h.d1.one("SELECT like_count, comment_count, last_comment_at FROM threads WHERE thread_key = ?1", key), {
      like_count: 1, comment_count: 2, last_comment_at: "2026-11-08T02:00:00.123456Z",
    });
    assert.equal(h.d1.one("SELECT like_count FROM comments WHERE id = ?1", U(100_001))?.like_count, 1);
    assert.equal(count(h, "SELECT count(*) AS n FROM post_combo_resources"), 2);
    assert.equal(count(h, "SELECT count(*) AS n FROM defragment_bodies"), 1);
    const st = h.state();
    assert.equal(st.high_seen, 6);
    assert.equal(st.low_watermark, 0, "fresh rows stay above the watermark for 5 minutes");
    assert.deepEqual(JSON.parse(st.applied_above), [1, 2, 3, 4, 5, 6]);
    // Five minutes later an idle run absorbs the window.
    h.advance(6 * MINUTE);
    const idle = await h.sync();
    assert.deepEqual(idle.processed, []);
    assert.equal(h.state().low_watermark, 6);
    assert.deepEqual(JSON.parse(h.state().applied_above), []);
  });

  await check("partial U images overlay columns; a U for a row D1 lacks is re-read and applied whole", async () => {
    const h = harness();
    const post = combo(2);
    h.rest.insert("combo_posts", post);
    await h.sync();
    h.rest.update("combo_posts", { id: post.id }, { like_count: 4, content_text: "고친 설명" });
    await h.sync();
    assert.deepEqual(h.d1.one("SELECT p.like_count, p.summary, c.content_text FROM posts p JOIN post_combo c ON c.post_id = p.id WHERE p.id = ?1", String(post.id)), {
      like_count: 4, summary: "고친 설명", content_text: "고친 설명",
    });
    // A row that existed before the hand-over (not in D1): its U alone changes 0 rows.
    const before = combo(3);
    h.rest.table("combo_posts").push({ ...before });
    h.rest.update("combo_posts", { id: before.id }, { like_count: 9 });
    const report = await h.sync();
    assert.equal(report.rejects.length, 0, "the re-read settled it");
    assert.equal(h.d1.one("SELECT like_count FROM posts WHERE id = ?1", String(before.id))?.like_count, 9);
    assert.equal(count(h, "SELECT count(*) AS n FROM post_combo_resources WHERE post_id = '" + before.id + "'"), 2);
  });

  // ----------------------------------------------------------------------------- design 9 (1): burst

  await check("design 9 (1): a burst of more than 100 rows within 5 minutes still lets the next run read new rows", async () => {
    const h = harness();
    for (let i = 0; i < 260; i++) h.rest.insert("comments", comment(1000 + i, `sts2-codex:card:c${i % 7}`));
    const first = await h.sync();
    assert.ok(first.processed.length > 0 && first.processed.length < 100);
    const highAfterFirst = h.state().high_seen;
    const headerCalls = () => h.rest.calls.filter((call) => call.table === "d1_change_log" && call.query.get("select")?.includes("row_bytes"));
    const reports = [first];
    reports.push(await h.sync());
    const second = h.state();
    assert.equal(second.low_watermark, 0, "inside 5 minutes the watermark waits");
    assert.ok(second.high_seen > highAfterFirst, "high_seen moves on: the burst never blocks the read");
    assert.ok(reports[1].processed.length > 0 && reports[1].processed.every((id) => id > highAfterFirst), "the second run reads past the first page");
    for (let i = 0; i < 30 && count(h, "SELECT count(*) AS n FROM comments") < 260; i++) {
      h.advance(10_000);
      reports.push(await h.sync());
    }
    assert.equal(count(h, "SELECT count(*) AS n FROM comments"), 260, "every row of the burst arrives");
    assert.ok(headerCalls().length >= reports.length);
    // Newer rows during the burst are read too.
    h.rest.insert("comments", comment(5000, "sts2-codex:card:new"));
    await h.sync();
    assert.equal(count(h, "SELECT count(*) AS n FROM comments WHERE story_id = 'sts2-codex:card:new'"), 1);
    h.advance(6 * MINUTE);
    await h.sync();
    assert.equal(h.state().low_watermark, 261);
    for (let k = 0; k < 7; k++) {
      assert.equal(h.d1.one("SELECT comment_count FROM threads WHERE thread_key = ?1", `sts2-codex:card:c${k}`)?.comment_count,
        Array.from({ length: 260 }, (_, i) => i).filter((i) => i % 7 === k).length);
    }
  });

  // ----------------------------------------------------------------------------- design 9 (2): watermark behind a reject

  await check("design 9 (2): the watermark rises behind a rejected id while steady changes continue", async () => {
    const h = harness();
    h.rest.insert("comments", comment(1, "sts2-codex:card:a"));
    // A hand-crafted timestamp D1 cannot hold (design 3.1): a bad_timestamp reject.
    h.rest.insert("likes", like("sts2-codex:card:a", U(5), { created_at: "infinity" }));
    h.rest.insert("comments", comment(2, "sts2-codex:card:a"));
    const first = await h.sync();
    assert.deepEqual(first.rejects.map((reject) => [reject.ref, reject.reason, reject.closed]), [[2, "bad_timestamp", false]]);
    for (let i = 0; i < 8; i++) {
      h.advance(MINUTE);
      h.rest.insert("comments", comment(10 + i, "sts2-codex:card:a"));
      await h.sync();
    }
    const st = h.state();
    assert.ok(st.low_watermark > 2, `low_watermark ${st.low_watermark} passed the rejected id 2`);
    const reject = h.d1.one("SELECT reason, attempts, resolved_at FROM sync_rejects WHERE ref = 2");
    assert.equal(reject?.reason, "bad_timestamp");
    assert.equal(reject?.resolved_at, null, "a deterministic reject stays open for a human");
    assert.ok(Number(reject?.attempts) > 1, "retried by re-reading the current row each run");
    assert.equal(count(h, "SELECT count(*) AS n FROM likes"), 0, "never a different value");
  });

  // ----------------------------------------------------------------------------- design 9 (3): budget

  await check("design 9 (3): 100 run inserts and a 32-candidate world-cup play stay within the per-run limits", async () => {
    const h = harness();
    const cup = tournament(1, 32);
    h.rest.insert("favorite_tournament_posts", cup);
    for (let i = 0; i < 32; i++) h.rest.insert("favorite_tournament_candidate_stats", candidateStat(String(cup.id), i, i + 1));
    h.advance(10 * MINUTE);
    await drain(h);
    assert.equal(count(h, "SELECT count(*) AS n FROM favorite_tournament_candidate_stats"), 32);
    const startLow = h.state().low_watermark;

    for (let i = 0; i < 100; i++) h.rest.insert("runs", run(i));
    h.rest.insert("favorite_tournament_plays", tournamentPlay(1, String(cup.id), 32));
    h.rest.update("favorite_tournament_posts", { id: cup.id }, { play_count: 1 });
    for (let i = 0; i < 32; i++) {
      h.rest.update("favorite_tournament_candidate_stats", { tournament_id: cup.id, resource_id: `card-${i}`, env: ENV }, {
        match_appearances: 2, current_rank: 32 - i, rank_history: [{ at: "2026-11-08 02:00:00.123456", rank: i + 1 }, { at: "2026-11-08 03:10:00", rank: 32 - i }],
      });
    }
    const reports: SyncReport[] = [];
    let lows: number[] = [];
    for (let i = 0; i < 80; i++) {
      h.advance(MINUTE);
      const report = await h.sync();
      reports.push(report);
      lows.push(h.state().low_watermark);
      if (count(h, "SELECT count(*) AS n FROM post_history_course_file") === 100 && JSON.parse(h.state().applied_above).length === 0) break;
    }
    assert.equal(count(h, "SELECT count(*) AS n FROM posts WHERE service = 'history_course'"), 100);
    assert.equal(count(h, "SELECT count(*) AS n FROM post_history_course_file"), 100, "every raw arrives, 2 per run");
    assert.equal(h.d1.one("SELECT raw FROM post_history_course_file LIMIT 1")?.raw, RAW, "the raw is stored byte for byte");
    assert.equal(count(h, "SELECT count(*) AS n FROM favorite_tournament_plays"), 1);
    assert.equal(h.d1.one("SELECT play_count FROM post_favorite_tournament")?.play_count, 1);
    assert.equal(count(h, "SELECT count(*) AS n FROM favorite_tournament_candidate_stats WHERE match_appearances = 2"), 32);
    assert.ok(reports.every((report) => report.raws.filter((raw) => raw.outcome === "stored").length <= 2));
    const maxStatements = Math.max(...reports.map((report) => report.statements));
    const maxSubrequests = Math.max(...reports.map((report) => report.subrequests));
    assert.ok(maxStatements <= 45 && maxSubrequests <= 50);
    lows = [startLow, ...lows];
    assert.ok(lows.every((low, i) => i === 0 || low >= lows[i - 1]), "the watermark never goes back");
    assert.ok(lows.at(-1)! > startLow, "and it keeps rising");
    console.log(`  budget run: ${reports.length} runs, max ${maxStatements} D1 statements, max ${maxSubrequests} subrequests per run`);
  });

  // ----------------------------------------------------------------------------- design 9 (4): retries re-read

  await check("design 9 (4): a reject retry never writes an old image; it applies the current Supabase row", async () => {
    const h = harness();
    const inquiry: Row = {
      id: U(700), user_id: U(1), category: "bug", message: "버그가 있습니다 여기", reply_email: null, page_path: "/codex",
      service_locale: "ko", game_locale: "kor", viewport_width: 390, viewport_height: 844, env: ENV, status: "new",
      created_at: TS, admin_response: null, responded_at: null, reply_seen_at: null,
    };
    h.rest.insert("contact_inquiries", inquiry);
    await h.sync();
    // U1: a value D1 cannot hold -> reject. U2: another column. Both are folded or rejected, never replayed.
    h.rest.update("contact_inquiries", { id: inquiry.id }, { reply_seen_at: "infinity" });
    let report = await h.sync();
    assert.deepEqual(report.rejects.map((reject) => reject.reason), ["bad_timestamp"]);
    h.rest.update("contact_inquiries", { id: inquiry.id }, { admin_response: "확인했습니다", responded_at: "2026-11-08T04:00:00+00:00" });
    report = await h.sync();
    assert.equal(report.retries[0]?.outcome, "open", "the current row still holds the bad value");
    assert.equal(h.d1.one("SELECT admin_response FROM contact_inquiries")?.admin_response, null, "the folded U2 waits for the retry");
    // U3 fixes the value: the retry re-reads the current row (U2 and U3) and resolves.
    h.rest.update("contact_inquiries", { id: inquiry.id }, { reply_seen_at: "2026-11-08T05:00:00+00:00" });
    report = await h.sync();
    assert.equal(report.retries[0]?.outcome, "resolved");
    assert.deepEqual(h.d1.one("SELECT admin_response, reply_seen_at FROM contact_inquiries"), {
      admin_response: "확인했습니다", reply_seen_at: "2026-11-08T05:00:00.000000Z",
    });
    assert.equal(count(h, "SELECT count(*) AS n FROM sync_rejects WHERE resolved_at IS NULL"), 0);
    // A later U applies normally again.
    h.rest.update("contact_inquiries", { id: inquiry.id }, { status: "done" });
    await h.sync();
    assert.equal(h.d1.one("SELECT status FROM contact_inquiries")?.status, "done");
  });

  await check("a reject whose row is gone from Supabase closes itself and deletes the D1 row", async () => {
    const h = harness();
    const key = "sts2-codex:card:gone";
    const c = comment(9, key);
    h.rest.insert("comments", c);
    await h.sync();
    h.rest.update("comments", { id: c.id }, { created_at: "infinity" });
    const rejected = await h.sync();
    assert.equal(rejected.rejects[0]?.reason, "bad_timestamp");
    // The row disappears without a log row reaching D1 first (the D folds into the open reject).
    h.rest.delete("comments", { id: c.id });
    const report = await h.sync();
    assert.equal(report.retries[0]?.outcome, "resolved");
    assert.equal(count(h, "SELECT count(*) AS n FROM comments"), 0);
    assert.equal(h.d1.one("SELECT comment_count FROM threads WHERE thread_key = ?1", key)?.comment_count, 0, "recounted from D1's story_id");
  });

  // ----------------------------------------------------------------------------- deletes and cascades

  await check("deletes and cascades: a post takes its service row, children, votes, likes and body; a comment its likes", async () => {
    const h = harness();
    const post = thisOrThat(1);
    h.rest.insert("this_or_that_posts", post);
    h.rest.insert("this_or_that_post_likes", thisOrThatLike(String(post.id), U(3)));
    h.rest.insert("this_or_that_post_votes", { post_id: post.id, user_id: U(3), choice: "left", created_surface: "feed", env: ENV, created_at: TS });
    h.rest.insert("defragment_bodies", body("this_or_that", String(post.id)));
    const c = comment(30, `this-or-that:${post.id}`);
    h.rest.insert("comments", c);
    h.rest.insert("comment_likes", commentLike(String(c.id), U(4)));
    h.rest.insert("comment_likes", commentLike(String(c.id), U(5)));
    await h.sync();
    assert.equal(count(h, "SELECT count(*) AS n FROM this_or_that_post_votes"), 1);
    assert.equal(h.d1.one("SELECT like_count FROM comments")?.like_count, 2);

    // Supabase: the post delete cascades votes and likes (logged as D rows); the body stays (no FK there).
    h.rest.delete("this_or_that_post_votes", { post_id: post.id });
    h.rest.delete("this_or_that_post_likes", { post_id: post.id });
    h.rest.delete("this_or_that_posts", { id: post.id });
    // The comment delete cascades its likes; their log rows carry env null (the parent is gone).
    h.rest.delete("comments", { id: c.id });
    h.rest.delete("comment_likes", { comment_id: c.id, user_id: U(4) });
    h.rest.delete("comment_likes", { comment_id: c.id, user_id: U(5) });
    assert.equal(h.rest.log.at(-1)?.env, null);
    const report = await h.sync();
    assert.equal(report.rejects.length, 0);
    for (const table of ["posts", "post_this_or_that", "this_or_that_post_votes", "this_or_that_post_likes", "defragment_bodies", "comments", "comment_likes"]) {
      assert.equal(count(h, `SELECT count(*) AS n FROM ${table}`), 0, table);
    }
    assert.equal(h.d1.one("SELECT comment_count FROM threads WHERE thread_key = ?1", `this-or-that:${post.id}`)?.comment_count, 0);
  });

  // ----------------------------------------------------------------------------- cross_env

  await check("cross_env: a this-or-that like on another env's post is counted, skipped and closed", async () => {
    const h = harness();
    const foreign = thisOrThat(7, { env: OTHER_ENV });
    h.rest.table("this_or_that_posts").push(foreign);
    const own = thisOrThat(8);
    h.rest.insert("this_or_that_posts", own);
    h.rest.insert("this_or_that_post_likes", thisOrThatLike(String(foreign.id), U(3), ENV));
    h.rest.insert("this_or_that_post_likes", thisOrThatLike(String(own.id), U(3), ENV));
    const report = await h.sync();
    assert.deepEqual(report.rejects.map((reject) => [reject.table, reject.reason, reject.closed]), [["this_or_that_post_likes", "cross_env", true]]);
    assert.equal(count(h, "SELECT count(*) AS n FROM this_or_that_post_likes"), 1, "only the like on this env's post");
    assert.equal(count(h, "SELECT count(*) AS n FROM sync_rejects WHERE reason = 'cross_env' AND resolved_at IS NOT NULL"), 1);
    assert.equal(count(h, "SELECT count(*) AS n FROM sync_rejects WHERE resolved_at IS NULL"), 0, "nothing blocks the gate");
    assert.deepEqual(JSON.parse(h.state().applied_above), [1, 2, 3]);
  });

  await check("a window handed over again re-applies idempotently past ids whose rejects were closed before", async () => {
    const h = harness();
    const foreign = thisOrThat(7, { env: OTHER_ENV });
    h.rest.table("this_or_that_posts").push(foreign);
    h.rest.insert("this_or_that_post_likes", thisOrThatLike(String(foreign.id), U(3), ENV));
    h.rest.insert("defragment_bodies", body("combo", U(400_998)));
    h.rest.insert("comments", comment(1, "sts2-codex:card:again"));
    const first = await h.sync();
    assert.deepEqual(first.rejects.map((reject) => [reject.ref, reject.reason, reject.closed]).sort(), [[1, "cross_env", true], [2, "orphan", true]]);
    // The same ids again (pnpm sync:state start with an older L0, or a run whose S11 lost the lease).
    h.d1.sqlite.prepare("UPDATE sync_state SET low_watermark = 0, high_seen = 0, applied_above = '[]'").run();
    h.rest.insert("comments", comment(2, "sts2-codex:card:again"));
    const reports: SyncReport[] = [];
    for (let i = 0; i < 4; i++) reports.push(await h.sync());
    assert.ok(reports.every((report) => report.status === "ok"), reports.map((report) => report.error ?? "").join(" | "));
    assert.deepEqual(JSON.parse(h.state().applied_above), [1, 2, 3, 4], "every id is committed again");
    assert.equal(count(h, "SELECT count(*) AS n FROM comments"), 2);
    assert.equal(count(h, "SELECT count(*) AS n FROM sync_rejects"), 2, "one reject row per change-log id");
    assert.equal(count(h, "SELECT count(*) AS n FROM sync_rejects WHERE resolved_at IS NULL"), 0);
  });

  await check("an FK child whose parent arrives later is an open fk reject that the retry resolves", async () => {
    const h = harness();
    const post = thisOrThat(9);
    // The like commits first; the post's log row is not visible yet (a late commit).
    h.rest.table("this_or_that_posts").push({ ...post });
    h.rest.insert("this_or_that_post_likes", thisOrThatLike(String(post.id), U(3)));
    const first = await h.sync();
    assert.deepEqual(first.rejects.map((reject) => [reject.reason, reject.closed]), [["fk", false]]);
    h.rest.table("this_or_that_posts").splice(0, 1);
    h.rest.insert("this_or_that_posts", post);
    const second = await h.sync();
    assert.equal(count(h, "SELECT count(*) AS n FROM post_this_or_that"), 1);
    const third = await h.sync();
    assert.deepEqual([...second.retries, ...third.retries].map((retry) => retry.outcome).includes("resolved"), true);
    assert.equal(count(h, "SELECT count(*) AS n FROM this_or_that_post_likes"), 1);
    assert.equal(count(h, "SELECT count(*) AS n FROM sync_rejects WHERE resolved_at IS NULL"), 0);
  });

  await check("the 10-attempt limit stops only rejects whose current row fails a D1 CHECK; an fk child keeps its retry", async () => {
    const h = harness();
    const post = thisOrThat(11);
    // In Supabase but not in D1 (its log row has not come): the like is an open fk reject.
    h.rest.table("this_or_that_posts").push({ ...post });
    h.rest.insert("this_or_that_post_likes", thisOrThatLike(String(post.id), U(3)));
    h.rest.insert("likes", like("sts2-codex:card:limit", U(5), { created_at: "infinity" }));
    for (let i = 0; i < 13; i++) await h.sync();
    const attempts = (ref: number) => Number(h.d1.one("SELECT attempts FROM sync_rejects WHERE ref = ?1", ref)?.attempts);
    assert.equal(h.d1.one("SELECT reason FROM sync_rejects WHERE ref = 1")?.reason, "fk");
    assert.ok(attempts(1) > 10, `the fk reject is still retried (${attempts(1)} attempts)`);
    assert.equal(attempts(2), 10, "the bad_timestamp reject stops at 10 attempts and waits for the user");
    // The parent finally arrives through the log: the child's next retry resolves.
    h.rest.table("this_or_that_posts").splice(0, 1);
    h.rest.insert("this_or_that_posts", post);
    await h.sync();
    await h.sync();
    assert.equal(count(h, "SELECT count(*) AS n FROM this_or_that_post_likes"), 1);
    assert.deepEqual(h.d1.rows("SELECT ref FROM sync_rejects WHERE resolved_at IS NULL"), [{ ref: 2 }]);
  });

  // ----------------------------------------------------------------------------- late commits and the window

  await check("a late-committed lower id is applied from the window and holds the watermark until then", async () => {
    const h = harness();
    h.rest.insert("comments", comment(1, "sts2-codex:card:w"));
    const late = h.rest.insert("comments", comment(2, "sts2-codex:card:w"))!;
    h.rest.insert("comments", comment(3, "sts2-codex:card:w"));
    h.rest.hidden.add(late.id);
    await h.sync();
    assert.deepEqual(JSON.parse(h.state().applied_above), [1, 3]);
    h.advance(MINUTE);
    h.rest.hidden.delete(late.id);
    const report = await h.sync();
    assert.deepEqual(report.processed, [2], "the window re-read finds it");
    assert.equal(count(h, "SELECT count(*) AS n FROM comments"), 3);
    h.advance(6 * MINUTE);
    await h.sync();
    assert.equal(h.state().low_watermark, 3);
  });

  // ----------------------------------------------------------------------------- 0 rows and orphans

  await check("a 조각모음 body without its post is an orphan when Supabase has none either (counted and closed)", async () => {
    const h = harness();
    h.rest.insert("defragment_bodies", body("combo", U(400_999)));
    const report = await h.sync();
    assert.deepEqual(report.rejects.map((reject) => [reject.reason, reject.closed]), [["orphan", true]]);
    assert.equal(count(h, "SELECT count(*) AS n FROM defragment_bodies"), 0);
    // A body whose post is in Supabase but not yet in D1 stays open as zero_rows and is retried.
    const post = combo(50);
    h.rest.table("combo_posts").push({ ...post });
    h.rest.insert("defragment_bodies", body("combo", String(post.id)));
    const second = await h.sync();
    assert.deepEqual(second.rejects.map((reject) => [reject.reason, reject.closed]), [["zero_rows", false]]);
    h.rest.update("combo_posts", { id: post.id }, { like_count: 1 });
    await h.sync(); // the U re-reads and upserts the post
    const settled = await h.sync();
    assert.equal(settled.retries.at(-1)?.outcome, "resolved");
    assert.equal(count(h, "SELECT count(*) AS n FROM defragment_bodies"), 1);
  });

  // ----------------------------------------------------------------------------- halving

  await check("a constraint error halves the batch down to the one change, which becomes a reject", async () => {
    const h = harness();
    for (let i = 0; i < 12; i++) h.rest.insert("comments", comment(i, "sts2-codex:card:h"));
    // A nickname D1's CHECK refuses (a hand-crafted row): the mapper passes it, the batch fails.
    h.rest.insert("comments", comment(99, "sts2-codex:card:h", U(1), { nickname: "가".repeat(25) }));
    for (let i = 12; i < 40; i++) h.rest.insert("comments", comment(i, "sts2-codex:card:h"));
    const reports: SyncReport[] = [];
    for (let i = 0; i < 8 && count(h, "SELECT count(*) AS n FROM comments") < 40; i++) reports.push(await h.sync());
    const rejects = reports.flatMap((report) => report.rejects);
    assert.deepEqual(rejects.map((reject) => [reject.ref, reject.reason]), [[13, "check"]]);
    assert.equal(count(h, "SELECT count(*) AS n FROM comments"), 40, "every other change lands");
    assert.equal(h.d1.one("SELECT comment_count FROM threads")?.comment_count, 40);
    assert.ok(reports.length <= 6, `isolated within ${reports.length} runs`);
    assert.ok(String(h.d1.one("SELECT error FROM sync_rejects WHERE ref = 13")?.error).includes("CHECK constraint failed"));
    console.log(`  halving: the bad change was isolated in ${reports.length} runs (${reports.map((r) => r.statements).join(", ")} statements)`);
  });

  await check("a failing first batch with no budget left to split it notes the prefix; the next run starts at half", async () => {
    const h = harness();
    // The bad change first: nothing can commit before it, so only the note makes progress.
    h.rest.insert("comments", comment(98, "sts2-codex:card:n", U(1), { nickname: "가".repeat(25) }));
    for (let i = 0; i < 40; i++) h.rest.insert("comments", comment(i, "sts2-codex:card:n"));
    const reports: SyncReport[] = [];
    for (let i = 0; i < 8 && count(h, "SELECT count(*) AS n FROM sync_rejects") === 0; i++) reports.push(await h.sync());
    assert.match(String(reports[0].error), /^split:1:\d+$/, "the first run notes the failing prefix");
    assert.equal(count(h, "SELECT count(*) AS n FROM sync_rejects WHERE ref = 1 AND reason = 'check'"), 1);
    assert.ok(reports.length <= 4, `isolated within ${reports.length} runs`);
    for (let i = 0; i < 8 && count(h, "SELECT count(*) AS n FROM comments") < 40; i++) await h.sync();
    assert.equal(count(h, "SELECT count(*) AS n FROM comments"), 40);
  });

  await check("a transient D1 error stops the run and notes the failure; nothing is rejected", async () => {
    const h = harness();
    h.rest.insert("comments", comment(1, "sts2-codex:card:t"));
    h.d1.failBatch = (sql) => (sql[0]?.startsWith("PRAGMA") ? new Error("D1_ERROR: Network connection lost.") : null);
    const report = await h.sync();
    assert.equal(report.status, "failed");
    assert.equal(h.state().fail_count, 1);
    assert.equal(count(h, "SELECT count(*) AS n FROM sync_rejects"), 0);
    assert.equal(h.state().high_seen, 0, "the window did not move");
    h.d1.failBatch = null;
    await h.sync();
    assert.equal(count(h, "SELECT count(*) AS n FROM comments"), 1);
  });

  await check("a Supabase error on the log read fails the run without touching the window", async () => {
    const h = harness();
    h.rest.insert("comments", comment(1, "sts2-codex:card:s"));
    h.rest.intercept = (call) => (call.table === "d1_change_log" ? Response.json({ code: "XX000" }, { status: 503 }) : null);
    const report = await h.sync();
    assert.equal(report.status, "failed");
    assert.match(String(h.state().last_error), /log headers/);
    h.rest.intercept = null;
    await h.sync();
    assert.equal(count(h, "SELECT count(*) AS n FROM comments"), 1);
  });

  // ----------------------------------------------------------------------------- lease

  await check("an overlapping run finds the lease held and does nothing", async () => {
    const h = harness();
    h.rest.insert("comments", comment(1, "sts2-codex:card:l"));
    const now = h.rest.clock + 1000;
    h.d1.sqlite.prepare("UPDATE sync_state SET lease_until = ?1").run(now + 30_000);
    const report = await runSync(h.env as never, { now: () => now, fetcher: h.rest.fetcher });
    assert.equal(report.status, "lease_held");
    assert.equal(h.rest.calls.length, 0);
  });

  // ----------------------------------------------------------------------------- raws

  await check("raws: at most 2 per run under 2 MB, text bound as is, failures move to the back", async () => {
    const h = harness();
    const big = JSON.stringify({ seed: "BIG", pad: "x".repeat(1_200_000) });
    h.rest.insert("runs", run(1, { raw: big }));
    h.rest.insert("runs", run(2, { raw: big }));
    h.rest.insert("runs", run(3));
    await h.sync();
    assert.equal(count(h, "SELECT count(*) AS n FROM sync_pending_raw"), 3, "the run rows land first, raws queued");
    assert.equal(h.d1.one("SELECT summary_version FROM post_history_course LIMIT 1")?.summary_version, 0);
    const second = await h.sync();
    assert.deepEqual(second.raws.map((raw) => raw.outcome), ["stored", "deferred"], "the second big raw would pass 2 MB");
    const third = await h.sync();
    assert.deepEqual(third.raws.map((raw) => raw.outcome), ["stored", "stored"]);
    assert.equal(h.d1.one("SELECT raw FROM post_history_course_file WHERE post_id = ?1", String(run(1).id))?.raw, big);
    const textCall = h.rest.calls.find((call) => call.accept === "text/plain");
    assert.equal(textCall?.query.get("select"), "raw");

    // No text/plain support: counted, moved to the back, never blocking the watermark.
    h.rest.insert("runs", run(4));
    h.rest.textPlain = false;
    await h.sync();
    const failed = await h.sync();
    assert.deepEqual(failed.raws.map((raw) => raw.outcome), ["failed"]);
    assert.match(String(h.d1.one("SELECT last_error FROM sync_pending_raw")?.last_error), /fetch:PGRST107/);
    h.rest.textPlain = true;
    // A run deleted before its raw arrived drops out of the queue.
    h.rest.delete("runs", { id: run(4).id });
    const gone = await h.sync();
    assert.ok(gone.raws.some((raw) => raw.outcome === "gone") || count(h, "SELECT count(*) AS n FROM sync_pending_raw") === 0);
    await h.sync();
    assert.equal(count(h, "SELECT count(*) AS n FROM sync_pending_raw"), 0);
    assert.equal(count(h, "SELECT count(*) AS n FROM posts WHERE service = 'history_course'"), 3);
  });

  // ----------------------------------------------------------------------------- large rows

  await check("bodies are read under 512 KB per run; a bigger row is read alone", async () => {
    const h = harness();
    h.rest.insert("pagestorm_posts", pagestorm(1, 600_000));
    h.rest.insert("comments", comment(1, "sts2-codex:card:big"));
    const first = await h.sync();
    assert.deepEqual(first.processed, [1], "the big row alone");
    const bodyCall = h.rest.calls.find((call) => call.query.get("select")?.includes("new_row"));
    assert.equal(bodyCall?.query.get("id"), "in.(1)");
    const second = await h.sync();
    assert.deepEqual(second.processed, [2]);
  });

  // ----------------------------------------------------------------------------- cleanup

  await check("the daily cleanup deletes this env's and env-less rows older than 7 days below the watermark", async () => {
    const h = harness();
    h.rest.insert("comments", comment(1, "sts2-codex:card:old"));
    h.rest.insert("comments", comment(2, "sts2-codex:card:old", U(2), { env: OTHER_ENV }));
    h.rest.insert("profile_character_nickname_pools", { character_id: "IRONCLAD", locale: "ko", nicknames: ["철갑"], updated_at: TS });
    await h.sync();
    h.advance(8 * 24 * 60 * MINUTE);
    h.rest.insert("comments", comment(3, "sts2-codex:card:old"));
    await h.sync(); // absorbs 1..3 except fresh 4
    const day = Math.floor((h.rest.clock + 2 * MINUTE) / 86_400_000) * 86_400_000;
    const report = await h.sync({ scheduledTime: day + 19 * 60 * MINUTE });
    assert.equal(report.cleanup, true);
    assert.deepEqual(h.rest.log.map((row) => row.id), [2, 4], "the other env's row stays; the fresh row stays");
    const notToday = await h.sync({ scheduledTime: day + 19 * 60 * MINUTE + MINUTE });
    assert.equal(notToday.cleanup, false);
  });

  // ----------------------------------------------------------------------------- CPU

  await check("CPU: the JS work of a full run on realistic batches fits 10 ms", async () => {
    const results = await measureCpu();
    for (const [name, ms] of Object.entries(results)) console.log(`  cpu ${name}: ${ms.toFixed(2)} ms`);
    assert.ok(results["merge+map 100 changes (warm)"] < 10);
    assert.ok(results["parse 512 KB body (warm)"] < 10);
    assert.ok(results["whole run, 100 mixed rows (warm, D1 stubbed)"] < 10);
  });

  console.log(`d1-sync-cron spec passed (${checks} checks)`);
}

// --------------------------------------------------------------------------------------- CPU

function cpuMs(fn: () => void): number {
  const start = process.cpuUsage();
  fn();
  const used = process.cpuUsage(start);
  return (used.user + used.system) / 1000;
}

async function cpuMsAsync(fn: () => Promise<void>): Promise<number> {
  const start = process.cpuUsage();
  await fn();
  const used = process.cpuUsage(start);
  return (used.user + used.system) / 1000;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** A realistic window: comments, likes, posts, runs, and one big pagestorm row. */
function realisticLog(): FakePostgrest {
  const rest = new FakePostgrest();
  for (let i = 0; i < 40; i++) {
    rest.insert("comments", comment(i, `sts2-codex:card:c${i % 9}`, U(1), {
      content: "좋은 카드 ".repeat(40), content_blocks: [{ type: "text", text: "좋은 카드 ".repeat(40) }],
    }));
  }
  for (let i = 0; i < 30; i++) rest.insert("likes", like(`sts2-codex:card:c${i % 9}`, U(10 + i)));
  for (let i = 0; i < 10; i++) rest.insert("combo_posts", combo(100 + i, { content: [{ type: "text", text: "콤보 ".repeat(200) }] }));
  for (let i = 0; i < 10; i++) rest.insert("runs", run(100 + i));
  for (let i = 0; i < 9; i++) rest.update("combo_posts", { id: U(400_100 + i) }, { like_count: 1 });
  rest.insert("pagestorm_posts", pagestorm(9, 380_000));
  return rest;
}

async function measureCpu(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const rest = realisticLog();
  const bodies = rest.log.map((row) => ({ ...row }));
  const bodyText = JSON.stringify(bodies);
  console.log(`  cpu batch: ${bodies.length} log rows, body ${(Buffer.byteLength(bodyText) / 1024).toFixed(0)} KB`);
  const entries: ChangeEntry[] = bodies.map((row) => ({
    id: row.id, table: row.table_name, op: row.op, newRow: row.new_row, oldRow: row.old_row, heavyChanged: row.heavy_changed,
  }));
  const parse = () => void JSON.parse(bodyText);
  const map = () => {
    const merged = mergeChanges(entries);
    for (const change of merged.changes) mapChange(change, { nowMs: 1 });
  };
  out["parse 512 KB body (cold)"] = cpuMs(parse);
  out["merge+map 100 changes (cold)"] = cpuMs(map);
  out["parse 512 KB body (warm)"] = median(Array.from({ length: 15 }, () => cpuMs(parse)));
  out["merge+map 100 changes (warm)"] = median(Array.from({ length: 15 }, () => cpuMs(map)));

  // A whole run with D1 as an I/O stub (D1 work is not Worker CPU) and canned PostgREST answers.
  const headerText = JSON.stringify(bodies.map(({ id, table_name, op, row_bytes, changed_at }) => ({ id, table_name, op, row_bytes, changed_at })));
  const raw277 = JSON.stringify({ seed: "S", pad: "가".repeat(92_000) });
  const stubD1 = {
    prepare(sql: string) {
      const statement = {
        bind: () => statement,
        all: async () => ({ success: true, results: [], meta: { changes: 1 } }),
        run: async () => ({ success: true, results: [], meta: { changes: 1 } }),
        first: async () => (sql.includes("sync.enabled") ? { flag: "on", started: 1 } : null),
      };
      return statement;
    },
    async batch(statements: unknown[]) {
      return statements.map((_, i) => (i === 0
        ? { success: true, results: [{ low_watermark: 0, high_seen: 0, applied_above: "[]" }], meta: { changes: 1 } }
        : i === 3 ? { success: true, results: [{ post_id: "r1", attempts: 0 }, { post_id: "r2", attempts: 0 }], meta: { changes: 0 } }
          : { success: true, results: [], meta: { changes: 1 } }));
    },
  };
  const fetcher = async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/runs")) return new Response(raw277);
    const select = url.searchParams.get("select") ?? "";
    if (select.includes("row_bytes")) return new Response(headerText, { headers: { "content-type": "application/json" } });
    if (select.includes("new_row")) return new Response(bodyText, { headers: { "content-type": "application/json" } });
    return new Response("[]", { headers: { "content-type": "application/json" } });
  };
  const env = { API_RUNTIME_FLAGS: "d1", DB: stubD1, API_SUPABASE_URL: PROJECT, API_SUPABASE_SECRET_KEY: "sb_secret_x", API_DATA_ENV: ENV };
  const whole = () => runSync(env as never, { now: () => rest.clock + 30_000, fetcher: fetcher as never, log: () => undefined }).then(() => undefined);
  out["whole run, 100 mixed rows (cold, D1 stubbed)"] = await cpuMsAsync(whole);
  const warm: number[] = [];
  for (let i = 0; i < 15; i++) warm.push(await cpuMsAsync(whole));
  out["whole run, 100 mixed rows (warm, D1 stubbed)"] = median(warm);
  const raw19 = "x".repeat(1_900_000);
  const decode = () => void new TextDecoder().decode(new TextEncoder().encode(raw19));
  out["decode a 1.9 MB raw (warm)"] = median(Array.from({ length: 9 }, () => cpuMs(decode)));
  return out;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
