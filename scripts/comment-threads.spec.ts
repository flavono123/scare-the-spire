import assert from "node:assert/strict";
import { commentThreadHref } from "../src/lib/comment-threads";

assert.equal(
  commentThreadHref("community:11111111-2222-4333-8333-444444444444"),
  "/#community:11111111-2222-4333-8333-444444444444",
);
assert.equal(commentThreadHref("blade-dance-shivs"), "/#blade-dance-shivs");
assert.equal(commentThreadHref("sts2-patch:0.111.0"), "/patches/0.111.0#comments");
assert.equal(
  commentThreadHref("sts2-codex:card:STRIKE"),
  "/compendium/cards/strike#comments",
);
assert.equal(
  commentThreadHref("c-c-c-combo:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"),
  "/c-c-c-combo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee#comments",
);
assert.equal(commentThreadHref("byrdispatch"), "/byrdispatch#comments");

console.log("comment-threads.spec.ts ok");
