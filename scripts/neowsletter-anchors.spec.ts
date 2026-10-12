import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { commentThreadHref } from "../src/lib/comment-threads";
import {
  neowsletterBodyLines,
  neowsletterClaimHref,
  neowsletterLineKind,
} from "../src/lib/neowsletter-anchors";
import { splitNeowsletterDocument } from "../src/lib/neowsletters";

assert.equal(neowsletterLineKind("## 로드맵"), "heading");
assert.equal(neowsletterLineKind(""), "skip");
assert.equal(neowsletterLineKind("- Steam 창작마당 지원"), "body");
assert.equal(
  commentThreadHref("neowsletter:2026-08:ascension-10"),
  neowsletterClaimHref("2026-08", "ascension-10"),
);
assert.equal(
  neowsletterClaimHref("2026-08", "roadmap"),
  "/patches/neowsletters/2026-08#roadmap",
);

const notesDir = path.join(process.cwd(), "data/sts2-neowsletters");
const ko = splitNeowsletterDocument(fs.readFileSync(path.join(notesDir, "2026-08.ko.md"), "utf8"));
const en = splitNeowsletterDocument(fs.readFileSync(path.join(notesDir, "2026-08.md"), "utf8"));
const ascension = ko.claims.find((claim) => claim.id === "ascension-10");
assert.equal(neowsletterBodyLines(ascension?.markdown ?? "").length, 2);
assert.equal(neowsletterBodyLines(ascension?.markdown ?? "")[1]?.startsWith("Casey:"), true);

for (const claim of ko.claims) {
  const translated = en.claims.find((item) => item.id === claim.id);
  assert.ok(translated, claim.id);
  assert.equal(
    neowsletterBodyLines(claim.markdown).length,
    neowsletterBodyLines(translated.markdown).length,
    `${claim.id} line count`,
  );
}
