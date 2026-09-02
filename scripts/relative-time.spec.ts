import assert from "node:assert/strict";
import {
  formatAbsoluteDate,
  formatTimeAgo,
  serviceDateLocale,
} from "../src/lib/relative-time";

const copy = {
  justNow: "방금",
  minutesAgo: "{count}분 전",
  hoursAgo: "{count}시간 전",
  daysAgo: "{count}일 전",
};

assert.equal(serviceDateLocale("ko"), "ko-KR");
assert.equal(serviceDateLocale("en"), "en-US");

const now = Date.parse("2026-09-02T12:00:00.000Z");
assert.equal(
  formatTimeAgo("2026-09-02T11:59:30.000Z", copy, "ko-KR", now),
  "방금",
);
assert.equal(
  formatTimeAgo("2026-09-02T11:50:00.000Z", copy, "ko-KR", now),
  "10분 전",
);

const older = "2026-06-01T00:00:00.000Z";
assert.equal(
  formatTimeAgo(older, copy, "ko-KR", now),
  formatAbsoluteDate(older, "ko-KR"),
);

console.log("relative-time.spec.ts: ok");
