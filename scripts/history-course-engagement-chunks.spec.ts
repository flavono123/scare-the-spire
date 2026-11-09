/**
 * History Course engagement counts over more runs than one Worker read takes (docs/supabase-exit/
 * STEP6_PLAN.md WP-H 3): ids go once each, only ids the api rule accepts, at most
 * HISTORY_RUN_ENGAGEMENT_IDS per request, and the answers merge into one map.
 */
import assert from "node:assert/strict";
import {
  historyCourseEngagementFromBody,
  historyCourseEngagementIdChunks,
  loadHistoryCourseEngagement,
  type HistoryCourseEngagementBody,
} from "../src/hooks/use-history-course-engagement";
import { HISTORY_RUN_ENGAGEMENT_IDS, parseRunIds } from "../src/lib/history-runs-api-rules";

const runId = (n: number) => `1run${String(n).padStart(4, "0")}`;
const ids150 = Array.from({ length: 150 }, (_, n) => runId(n));

async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  console.log(`ok - ${name}`);
}

/** A Worker stub: counts each requested id from a fixed table, logging the requests. */
function stubWorker(table: Record<string, { likes: number; comments: number }>) {
  const requests: string[][] = [];
  const fetchChunk = async (ids: string[]): Promise<HistoryCourseEngagementBody> => {
    requests.push(ids);
    // The Worker's own rule: the request must parse as it does in the route.
    assert.deepEqual(parseRunIds(ids.join(",")), ids, "every request passes the Worker's id rule");
    const likes: Record<string, number> = {};
    const comments: Record<string, number> = {};
    for (const id of ids) {
      if (table[id]?.likes) likes[id] = table[id].likes;
      if (table[id]?.comments) comments[id] = table[id].comments;
    }
    return { v: 1, likes, comments };
  };
  return { requests, fetchChunk };
}

async function main() {
  assert.equal(HISTORY_RUN_ENGAGEMENT_IDS, 100);

  await check("150 ids: two requests of 100 and 50, in order", () => {
    const chunks = historyCourseEngagementIdChunks(ids150);
    assert.deepEqual(chunks.map((chunk) => chunk.length), [100, 50]);
    assert.deepEqual(chunks.flat(), ids150);
  });

  await check("100 ids: one request; 0 ids: none", () => {
    assert.equal(historyCourseEngagementIdChunks(ids150.slice(0, 100)).length, 1);
    assert.deepEqual(historyCourseEngagementIdChunks([]), []);
  });

  await check("duplicates go once (a local run that is also shared)", () => {
    const chunks = historyCourseEngagementIdChunks([...ids150.slice(0, 60), ...ids150.slice(0, 60), ...ids150.slice(60, 101)]);
    assert.deepEqual(chunks.map((chunk) => chunk.length), [100, 1]);
    assert.equal(new Set(chunks.flat()).size, 101);
  });

  await check("ids outside the rule are left out", () => {
    const outside = ["", "has space", "slash/run", "x".repeat(65), "history-course:1abc"];
    assert.deepEqual(historyCourseEngagementIdChunks([...outside, runId(1)]), [[runId(1)]]);
    assert.deepEqual(historyCourseEngagementIdChunks(outside), []);
  });

  await check("150 ids with duplicates and outside ids: merged counts, outside ids show 0", async () => {
    const table: Record<string, { likes: number; comments: number }> = {
      [runId(0)]: { likes: 2, comments: 1 },
      [runId(99)]: { likes: 0, comments: 3 },
      [runId(100)]: { likes: 5, comments: 0 },
      [runId(149)]: { likes: 1, comments: 1 },
    };
    const worker = stubWorker(table);
    const input = [...ids150, runId(0), runId(120), "not a run", "x".repeat(65)];
    const counts = await loadHistoryCourseEngagement(input, worker.fetchChunk);
    assert.deepEqual(worker.requests.map((chunk) => chunk.length), [100, 50]);
    assert.deepEqual(counts, table);
    // The index reads counts[id] ?? 0 for every card.
    assert.equal(counts["not a run"]?.likes ?? 0, 0);
    assert.equal(counts[runId(50)]?.comments ?? 0, 0);
  });

  await check("only outside ids: no request, an empty map (ready, all 0)", async () => {
    const worker = stubWorker({});
    assert.deepEqual(await loadHistoryCourseEngagement(["not a run"], worker.fetchChunk), {});
    assert.equal(worker.requests.length, 0);
  });

  await check("one failed chunk fails the whole read (the index shows no counts, as one failed read did)", async () => {
    let calls = 0;
    await assert.rejects(loadHistoryCourseEngagement(ids150, async (ids) => {
      calls += 1;
      if (ids.length === 50) throw new Error("unavailable");
      return { v: 1, likes: {}, comments: {} };
    }));
    assert.equal(calls, 2);
  });

  await check("an answer that is not version 1 with both maps is rejected", async () => {
    assert.throws(() => historyCourseEngagementFromBody({ v: 2, likes: {}, comments: {} }));
    assert.throws(() => historyCourseEngagementFromBody({ v: 1, likes: {} }));
    assert.throws(() => historyCourseEngagementFromBody(null));
    await assert.rejects(loadHistoryCourseEngagement([runId(1)], async () => ({ v: 1, comments: {} })));
    assert.deepEqual(
      historyCourseEngagementFromBody({ v: 1, likes: { a: 1 }, comments: { b: 2 } }),
      { a: { likes: 1, comments: 0 }, b: { likes: 0, comments: 2 } },
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
