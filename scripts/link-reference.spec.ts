import assert from "node:assert/strict";
import {
  isTitledLinkUrl,
  normalizeLinkTitle,
  splitTextUrls,
} from "../src/lib/link-reference";
import { blocksToTiptapDocument, tiptapToBlocks } from "../src/lib/chemical-utils";

assert.equal(isTitledLinkUrl("https://m.dcinside.com/board/slay/501657?recommend=1"), true);
assert.equal(isTitledLinkUrl("https://gall.dcinside.com/mgallery/board/view/?id=slay&no=1"), true);
assert.equal(isTitledLinkUrl("https://notdcinside.com/x"), false);
assert.equal(isTitledLinkUrl("https://www.youtube.com/watch?v=uC_k4W41Gg4"), false);
assert.equal(isTitledLinkUrl("javascript:alert(1)"), false);

assert.equal(normalizeLinkTitle("  짤  모음 ", "https://a.example"), "짤 모음");
assert.equal(normalizeLinkTitle("", "https://a.example"), "https://a.example");

assert.deepEqual(
  splitTextUrls("https://m.dcinside.com/board/slay/501657?recommend=1 깔대기"),
  [
    { kind: "url", href: "https://m.dcinside.com/board/slay/501657?recommend=1" },
    { kind: "text", text: " 깔대기" },
  ],
);
assert.deepEqual(splitTextUrls("보세요 (https://example.com/a)."), [
  { kind: "text", text: "보세요 (" },
  { kind: "url", href: "https://example.com/a" },
  { kind: "text", text: ")." },
]);
assert.deepEqual(splitTextUrls("링크 없음"), [{ kind: "text", text: "링크 없음" }]);

const blocks = [
  { type: "text" as const, text: "참고 " },
  { type: "link" as const, href: "https://m.dcinside.com/board/slay/501657", title: "마음의 평안을 주는 짤" },
];
assert.deepEqual(tiptapToBlocks(blocksToTiptapDocument(blocks)), blocks);

console.log("link-reference.spec.ts: ok");
