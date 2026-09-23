import assert from "node:assert/strict";
import {
  HISTORY_COURSE_INDEX_SORTS,
  sortHistoryCourseIndexRuns,
  type HistoryCourseIndexSortKey,
} from "../src/lib/history-course-index-sort";

const runs: HistoryCourseIndexSortKey[] = [
  {
    runId: "b",
    createdAtMs: 200,
    likeCount: 1,
    commentCount: 4,
  },
  {
    runId: "a",
    createdAtMs: 300,
    likeCount: 5,
    commentCount: 1,
  },
  {
    runId: "c",
    createdAtMs: 100,
    likeCount: 5,
    commentCount: 0,
  },
];

assert.deepEqual([...HISTORY_COURSE_INDEX_SORTS], [
  "latest",
  "recommended",
  "comments",
]);

assert.deepEqual(
  sortHistoryCourseIndexRuns(runs, "latest").map((run) => run.runId),
  ["a", "b", "c"],
);
assert.deepEqual(
  sortHistoryCourseIndexRuns(runs, "recommended").map((run) => run.runId),
  ["a", "c", "b"],
);
assert.deepEqual(
  sortHistoryCourseIndexRuns(runs, "comments").map((run) => run.runId),
  ["b", "a", "c"],
);

console.log("history-course-index-sort.spec.ts: ok");
