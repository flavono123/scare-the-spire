/**
 * Supabase side of step 5 on PGlite (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.5): the mirror
 * migration and its rollback, and the TypeScript ports the D1 path uses in place of Supabase
 * functions, compared with the real functions run on the same inputs:
 *   - puzzlebox_score_run / puzzlebox_run_display (scoring and every refusal),
 *   - submit_puzzlebox_run's player normalization.
 * Usage: tsx scripts/d1-step5-supabase.spec.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { normalizePuzzleboxPlayer, puzzleboxScoreRun, PuzzleboxRunError } from "../workers/api/d1-write/puzzlebox-score";
import { repoSupabase } from "./d1-sync/pglite-supabase";

const ROLLBACK = "docs/release/d1-step5-mirror/rollback_d1_step5_mirror.sql";
let checks = 0;

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    checks += 1;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

/** A small seeded PRNG so failures reproduce. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)];
}

const ODD_NUMBERS = [0, 1, 2, 3, -0.5, 0.5, 1.5, 2.5, 3.0000001, -1, 4, 1e10];

function randomShown(random: () => number, corrupt: boolean): unknown {
  if (corrupt) return pick(random, [{ token: false, local: false, original: false }, { token: 1, local: true, original: true }, null, { token: true }]);
  const shown = { token: random() < 0.6, local: random() < 0.6, original: random() < 0.6 };
  if (!shown.token && !shown.local && !shown.original) shown.original = true;
  return shown;
}

/** A finished game most of the time; one field corrupted in about a quarter of the runs. */
function randomConnections(random: () => number): unknown {
  const corrupt = random() < 0.25 ? Math.floor(random() * 7) : -1;
  const solved: number[] = [];
  let mistakes = 0;
  const guesses: unknown[] = [];
  while (solved.length < 4 && mistakes < 4) {
    if (random() < 0.55) {
      const open = [0, 1, 2, 3].filter((level) => !solved.includes(level));
      const level = pick(random, open);
      solved.push(level);
      guesses.push([level, level, level, level]);
    } else {
      mistakes += 1;
      const level = Math.floor(random() * 4);
      guesses.push(random() < 0.2 && solved.length ? [solved[0], solved[0], solved[0], solved[0]] : [level, (level + 1) % 4, level, level]);
    }
  }
  if (corrupt === 0) guesses.pop();
  if (corrupt === 1) guesses.push([0, 0, 0, 0]);
  if (corrupt === 2) guesses[0] = [1, 1, 1];
  if (corrupt === 3) (guesses[0] as unknown[])[1] = pick(random, ODD_NUMBERS);
  const rocks = Math.floor(random() * 4);
  const run: Record<string, unknown> = {
    guesses,
    rocks: corrupt === 4 ? pick(random, ODD_NUMBERS) : random() < 0.1 ? rocks + 0.4 : rocks,
    rocksLeft: corrupt === 5 ? pick(random, [4, -1, "1", 2.5]) : Math.floor(random() * (4 - rocks)),
    shown: randomShown(random, corrupt === 6),
  };
  return run;
}

function randomQuiz(random: () => number): unknown {
  const corrupt = random() < 0.25 ? Math.floor(random() * 6) : -1;
  const questions = corrupt === 0 ? pick(random, [0, 31, 2.5, -1, 1.4999]) : 1 + Math.floor(random() * 12);
  const total = Math.max(1, Math.round(Number(questions)));
  const answers: Record<string, unknown>[] = [];
  let wrong = 0;
  while (answers.length < total && wrong < 3) {
    const correct = random() < 0.7;
    if (!correct) wrong += 1;
    answers.push({
      pick: Math.floor(random() * 4),
      correct,
      ms: random() < 0.3 ? pick(random, [-5, 0.5, 1000.5, 9999.5, 9550, 12000, 700000, 5500.4999, 1000, 10000]) : Math.floor(random() * 15000),
      shown: randomShown(random, corrupt === 1 && answers.length === 0),
    });
  }
  if (corrupt === 2) answers.pop();
  if (corrupt === 3 && answers[0]) answers[0].pick = pick(random, [4, -1, 1.5, "2"]);
  if (corrupt === 4 && answers[0]) delete answers[0].correct;
  if (corrupt === 5) answers.push({ pick: 0, correct: true, ms: 100, shown: { token: true, local: true, original: true } });
  return { questions, answers };
}

async function main() {
  const db = await repoSupabase();

  await check("the step 5 migration: functions for service_role only, puzzlebox_runs.id by default", async () => {
    const { rows } = await db.query<{ attidentity: string }>(
      "select attidentity from pg_attribute where attrelid = 'public.puzzlebox_runs'::regclass and attname = 'id'",
    );
    assert.equal(rows[0].attidentity, "d");
    for (const fn of ["mirror_run(text)", "mirror_favorite_tournament_play(text,jsonb,jsonb)"]) {
      for (const role of ["anon", "authenticated"]) {
        const { rows: grant } = await db.query<{ ok: boolean }>(`select has_function_privilege('${role}', 'public.${fn}', 'execute') as ok`);
        assert.equal(grant[0].ok, false, `${role} may not call ${fn}`);
      }
      const { rows: service } = await db.query<{ ok: boolean }>(`select has_function_privilege('service_role', 'public.${fn}', 'execute') as ok`);
      assert.equal(service[0].ok, true);
    }
  });

  await check("TS puzzlebox_score_run equals the SQL function on 1,500 random runs (scores and refusals)", async () => {
    const random = rng(20261108);
    let refused = 0;
    let scored = 0;
    for (let i = 0; i < 1500; i += 1) {
      const game = i % 3 === 0 ? "beta-quiz" : i % 97 === 0 ? "chess" : "connections";
      const run = game === "beta-quiz" ? randomQuiz(random) : randomConnections(random);
      let sql: { ok: true; value: unknown } | { ok: false; code: string };
      try {
        const { rows } = await db.query<{ r: unknown }>("select public.puzzlebox_score_run($1, $2::jsonb) as r", [game, JSON.stringify(run)]);
        sql = { ok: true, value: rows[0].r };
      } catch (error) {
        sql = { ok: false, code: String((error as { code?: string }).code) };
      }
      let ts: { ok: true; value: unknown } | { ok: false };
      try {
        ts = { ok: true, value: puzzleboxScoreRun(game, run) };
      } catch (error) {
        if (!(error instanceof PuzzleboxRunError)) throw error;
        ts = { ok: false };
      }
      const label = `${game} ${JSON.stringify(run)}`;
      assert.equal(ts.ok, sql.ok, `${label}: TS ${ts.ok ? "scored" : "refused"}, SQL ${sql.ok ? "scored" : `refused (${(sql as { code: string }).code})`}`);
      if (sql.ok && ts.ok) {
        scored += 1;
        const want = sql.value as Record<string, unknown>;
        const got = ts.value as Record<string, unknown>;
        for (const field of ["score", "perfect", "cleared", "mistakes", "rocks", "solved", "questions", "picks", "corrects", "speed"]) {
          if (field in want) assert.deepEqual(got[field], want[field], `${label}: ${field}`);
        }
        assert.deepEqual(JSON.parse(JSON.stringify(got.run)), want.run, `${label}: run`);
      } else {
        refused += 1;
        assert.ok(["22023", "22003", "22P02"].includes((sql as { code: string }).code), `${label}: SQL code`);
      }
    }
    assert.ok(scored > 300 && refused > 100, `both outcomes exercised (scored ${scored}, refused ${refused})`);
  });

  await check("TS player normalization equals submit_puzzlebox_run's", async () => {
    const players: Array<Record<string, unknown>> = [
      { nickname: "  닉네임  ", avatar_id: "IRONCLAD", avatar_kind: "character", palette_id: "red", palette_swapped: true },
      { nickname: "", avatar_id: "bad id", avatar_kind: "monster", palette_id: "RED", palette_swapped: true },
      { nickname: "x".repeat(30), palette_id: "a-b_c", palette_swapped: "yes" },
      { nickname: 12345, palette_swapped: 1 },
      { palette_id: "p", palette_swapped: "f" },
      { palette_id: "p", palette_swapped: "of" },
      { palette_id: "p" },
    ];
    const fields = "nickname, avatar_id, avatar_kind, palette_id, palette_swapped";
    for (const player of players) {
      const { rows } = await db.query<Record<string, unknown>>(`
        with p as (select $1::jsonb as p_player),
        n as (select nullif(left(pg_catalog.btrim(coalesce(p_player ->> 'nickname', '')), 24), '') as nickname,
                     p_player ->> 'avatar_kind' as kind, p_player ->> 'avatar_id' as aid, p_player ->> 'palette_id' as pid, p_player from p)
        select coalesce(nickname, '?') as nickname,
               case when aid is not null and aid !~ '^[A-Z0-9_]{1,40}$' then null else aid end as avatar_id,
               case when kind is not null and kind not in ('character', 'boss') then null else kind end as avatar_kind,
               case when pid is not null and pid !~ '^[a-z0-9_-]{1,40}$' then null else pid end as palette_id,
               coalesce((p_player ->> 'palette_swapped')::boolean, false)
                 and (case when pid is not null and pid !~ '^[a-z0-9_-]{1,40}$' then null else pid end) is not null as palette_swapped
        from n`, [JSON.stringify(player)]);
      assert.deepEqual(normalizePuzzleboxPlayer(player), rows[0], `${fields}: ${JSON.stringify(player)}`);
    }
    assert.throws(() => normalizePuzzleboxPlayer({ palette_swapped: "maybe" }), PuzzleboxRunError);
    await assert.rejects(db.query("select ('maybe')::boolean"));
  });

  await check("the rollback script removes the functions and restores the identity", async () => {
    await db.exec(readFileSync(ROLLBACK, "utf8"));
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from pg_proc where proname in ('mirror_run', 'mirror_favorite_tournament_play')");
    assert.equal(rows[0].n, 0);
    const { rows: identity } = await db.query<{ attidentity: string }>(
      "select attidentity from pg_attribute where attrelid = 'public.puzzlebox_runs'::regclass and attname = 'id'",
    );
    assert.equal(identity[0].attidentity, "a");
    await db.exec(readFileSync("supabase/migrations/20261109010000_d1_step5_mirror.sql", "utf8"));
  });

  await db.close();
  console.log(`d1-step5-supabase: ${checks} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
