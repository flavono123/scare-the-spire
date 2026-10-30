import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { commentThreadHref } from "../src/lib/comment-threads";
import {
  neowsletterBodyLines,
  neowsletterClaimHeadingAnchorIds,
  neowsletterClaimHref,
  neowsletterHeadingFollowsBody,
  neowsletterLineKind,
  neowsletterSectionHeading,
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
assert.equal(neowsletterBodyLines(ascension?.markdown ?? "")[1]?.startsWith("[b]Casey:[/b]"), true);

// Emphasis uses [b], [i], and [s]. Bare ** paints gold and bare * or ~~ prints
// literally. Both locales carry the original's spans claim by claim.
function emphasisTags(markdown: string): string {
  return (markdown.match(/\[[bis]\]/g) ?? []).sort().join("");
}
for (const file of fs.readdirSync(notesDir).filter((name) => name.endsWith(".ko.md"))) {
  const id = file.replace(".ko.md", "");
  const koMarkdown = fs.readFileSync(path.join(notesDir, file), "utf8");
  const enMarkdown = fs.readFileSync(path.join(notesDir, `${id}.md`), "utf8");
  for (const markdown of [koMarkdown, enMarkdown]) {
    const prose = markdown.split("\n").filter((line) => neowsletterLineKind(line) === "body").join("\n");
    assert.equal(/\*\*[^*\s]|~~/.test(prose), false, `${id} still has ** or ~~`);
  }
  const enClaims = new Map(splitNeowsletterDocument(enMarkdown).claims.map((claim) => [claim.id, claim.markdown]));
  for (const claim of splitNeowsletterDocument(koMarkdown).claims) {
    assert.equal(emphasisTags(claim.markdown), emphasisTags(enClaims.get(claim.id) ?? ""), `${id}#${claim.id} emphasis differs`);
  }
}

const september = splitNeowsletterDocument(fs.readFileSync(path.join(notesDir, "2026-09.ko.md"), "utf8"));
const septemberEn = splitNeowsletterDocument(fs.readFileSync(path.join(notesDir, "2026-09.md"), "utf8"));
function section(claims: typeof september.claims, id: string): string {
  return neowsletterSectionHeading(claims, claims.findIndex((claim) => claim.id === id));
}
assert.equal(section(september.claims, "upcoming-content"), "");
assert.equal(section(september.claims, "spire-spotting"), "첨탑 관측");
assert.equal(section(september.claims, "mana-wave-nycc"), "굿즈 광기");
assert.equal(section(september.claims, "connections-26"), "커넥션스 코너");
assert.equal(section(september.claims, "map-knowledge-demon"), "지도 걸작선");
assert.equal(section(september.claims, "cover-collage"), "커뮤니티 코너");
assert.equal(section(septemberEn.claims, "spire-spotting"), "Spire Spotting");
assert.equal(section(septemberEn.claims, "mana-wave-nycc"), "Merch Madness");
assert.equal(section(septemberEn.claims, "map-knowledge-demon"), "Map Masterpieces");
const spottingIndex = september.claims.findIndex((claim) => claim.id === "spire-spotting");
assert.deepEqual(neowsletterClaimHeadingAnchorIds(september.claims, spottingIndex), ["spire-spotting"]);
assert.equal(section(ko.claims, "roadmap"), "로드맵, 다시");

for (const fileName of fs.readdirSync(notesDir)) {
  if (!fileName.endsWith(".ko.md")) continue;
  const koDocument = splitNeowsletterDocument(fs.readFileSync(path.join(notesDir, fileName), "utf8"));
  const enDocument = splitNeowsletterDocument(fs.readFileSync(path.join(notesDir, fileName.replace(/\.ko\.md$/, ".md")), "utf8"));
  assert.deepEqual(
    koDocument.claims.map((claim) => claim.id),
    enDocument.claims.map((claim) => claim.id),
    `${fileName} claim ids`,
  );
  for (const document of [koDocument, enDocument]) {
    for (const claim of document.claims) {
      assert.equal(
        neowsletterHeadingFollowsBody(claim.markdown),
        false,
        `${fileName} claim ${claim.id} has a heading after body text`,
      );
    }
  }
}

for (const claim of ko.claims) {
  const translated = en.claims.find((item) => item.id === claim.id);
  assert.ok(translated, claim.id);
  assert.equal(
    neowsletterBodyLines(claim.markdown).length,
    neowsletterBodyLines(translated.markdown).length,
    `${claim.id} line count`,
  );
}
