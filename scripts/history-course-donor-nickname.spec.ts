import assert from "node:assert/strict";
import { resolveHistoryCourseDonorNickname } from "../src/lib/user-profile";

assert.equal(resolveHistoryCourseDonorNickname(null), "닉");
assert.equal(resolveHistoryCourseDonorNickname(""), "닉");
assert.equal(
  resolveHistoryCourseDonorNickname(JSON.stringify({ nickname: "아이돌클라스" })),
  "아이돌클라스",
);
assert.equal(
  resolveHistoryCourseDonorNickname(JSON.stringify({ nickname: "   " })),
  "닉",
);

console.log("history-course-donor-nickname.spec.ts: ok");
