import assert from "node:assert/strict";
import {
  COMMENT_MAX_CHARS,
  COMMENT_STORAGE_MAX_CHARS,
  CHEMICAL_POST_MAX_CHARS,
  charCountWarnRemaining,
  isCharCountNearLimit,
} from "../src/lib/content-limits";

assert.equal(COMMENT_MAX_CHARS, 200);
assert.equal(CHEMICAL_POST_MAX_CHARS, 30);
assert.ok(COMMENT_STORAGE_MAX_CHARS >= COMMENT_MAX_CHARS);

assert.equal(charCountWarnRemaining(30), 5);
assert.equal(charCountWarnRemaining(200), 20);

assert.equal(isCharCountNearLimit(24, 30), false);
assert.equal(isCharCountNearLimit(25, 30), true);
assert.equal(isCharCountNearLimit(179, 200), false);
assert.equal(isCharCountNearLimit(180, 200), true);
assert.equal(isCharCountNearLimit(200, 200), true);

console.log("content-limits.spec.ts: ok");
