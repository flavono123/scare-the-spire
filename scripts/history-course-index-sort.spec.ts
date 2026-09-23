import assert from "node:assert/strict";
import {
  HISTORY_COURSE_INDEX_SORTS,
  sortHistoryCourseIndexRuns,
  type HistoryCourseIndexSortKey,
} from "../src/lib/history-course-index-sort";
import { serviceMessages } from "../src/messages/service";

const runs: HistoryCourseIndexSortKey[] = [
  {
    runId: "b",
    createdAtMs: 200,
    startTime: 10,
    likeCount: 1,
    commentCount: 4,
  },
  {
    runId: "a",
    createdAtMs: 300,
    startTime: 0,
    likeCount: 5,
    commentCount: 1,
  },
  {
    runId: "c",
    createdAtMs: 100,
    startTime: 50,
    likeCount: 5,
    commentCount: 0,
  },
];

assert.deepEqual([...HISTORY_COURSE_INDEX_SORTS], [
  "latest",
  "recommended",
  "comments",
  "run_start",
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
assert.deepEqual(
  sortHistoryCourseIndexRuns(runs, "run_start").map((run) => run.runId),
  ["c", "b", "a"],
);

assert.equal(serviceMessages.ko.feedSort.run_start, "도전 시각");
assert.equal(serviceMessages.en.feedSort.run_start, "Run start");

console.log("history-course-index-sort.spec.ts: ok");
