import assert from "node:assert/strict";
import { patchSectionAnchorIds } from "../src/lib/patch-section-anchors";
import {
  canonicalSitePath,
  openSitePathQuery,
  rankSitePaths,
  type SitePathEntry,
} from "../src/lib/site-paths";

const entries: SitePathEntry[] = [
  {
    href: "/compendium/cards",
    kind: "page",
    labelKo: "카드",
    labelEn: "Cards",
    titleKo: "카드",
    titleEn: "Cards",
    previewKo: "",
    previewEn: "",
  },
  {
    href: "/patches/neowsletters",
    kind: "page",
    labelKo: "니오우스레터",
    labelEn: "Neowsletter",
    titleKo: "니오우스레터",
    titleEn: "Neowsletter",
    previewKo: "목록",
    previewEn: "Index",
  },
  {
    href: "/patches/neowsletters/2026-08",
    kind: "neowsletter",
    labelKo: "니오우스레터 — 2026년 8월",
    labelEn: "The Neowsletter - August 2026",
    titleKo: "니오우스레터 — 2026년 8월",
    titleEn: "The Neowsletter - August 2026",
    previewKo: "8월",
    previewEn: "August",
  },
  {
    href: "/patches/neowsletters/2026-08#roadmap",
    kind: "neowsletter-section",
    labelKo: "니오우스레터 — 2026년 8월#로드맵, 다시",
    labelEn: "Neowsletter — August#Roadmap",
    titleKo: "니오우스레터 — 2026년 8월",
    titleEn: "August",
    previewKo: "로드맵",
    previewEn: "Roadmap",
  },
];

assert.equal(openSitePathQuery("본문 /patches/neo"), "/patches/neo");
assert.equal(openSitePathQuery("https://example.com"), null);
assert.equal(
  canonicalSitePath("http://localhost:3000/en/patches/neowsletters/2026-08#roadmap"),
  "/patches/neowsletters/2026-08#roadmap",
);
assert.equal(canonicalSitePath("https://example.com/patches"), null);
const root = rankSitePaths("/", entries, "ko");
assert.equal(root.some((entry) => entry.href.startsWith("/compendium")), false);
assert.equal(root.find((entry) => entry.href === "/patches/neowsletters")?.action, "drill");

const drilled = rankSitePaths("/patches/neowsletters", entries, "ko");
assert.equal(drilled[0]?.href, "/patches/neowsletters/2026-08");
assert.equal(drilled[0]?.action, "commit");
assert.equal(drilled.at(-1)?.href, "/patches/neowsletters");
assert.equal(drilled.at(-1)?.action, "commit");

const top = rankSitePaths("/patches/neow", entries, "ko");
assert.equal(top[0]?.action, "drill");

const anchors = rankSitePaths("/patches/neowsletters/2026-08#", entries, "ko");
assert.equal(anchors[0]?.href, "/patches/neowsletters/2026-08#roadmap");
assert.equal(anchors[0]?.labelKo, "니오우스레터 — 2026년 8월#로드맵, 다시");

const withPatches: SitePathEntry[] = [
  ...entries,
  {
    href: "/patches",
    kind: "page",
    labelKo: "패치 노트",
    labelEn: "Patch Notes",
    titleKo: "패치 노트",
    titleEn: "Patch Notes",
    previewKo: "",
    previewEn: "",
  },
  {
    href: "/patches/0.111.0",
    kind: "patch",
    labelKo: "패치 노트 — 베타 패치 노트 - v0.111.0",
    labelEn: "Patch Notes — Beta Patch Notes - v0.111.0",
    titleKo: "베타 패치 노트 - v0.111.0",
    titleEn: "Beta Patch Notes - v0.111.0",
    previewKo: "",
    previewEn: "",
  },
  {
    href: "/patches/0.111.0#content-and-balance",
    kind: "patch-section",
    labelKo: "패치 노트 — 베타 패치 노트 - v0.111.0#콘텐츠 및 밸런스",
    labelEn: "Patch Notes — Beta Patch Notes - v0.111.0#Content & Balance",
    titleKo: "베타 패치 노트 - v0.111.0",
    titleEn: "Beta Patch Notes - v0.111.0",
    previewKo: "",
    previewEn: "",
  },
  {
    href: "/pagestorm",
    kind: "page",
    labelKo: "서류 폭풍",
    labelEn: "Pagestorm",
    titleKo: "서류 폭풍",
    titleEn: "Pagestorm",
    previewKo: "",
    previewEn: "",
  },
];

assert.equal(rankSitePaths("/", withPatches, "ko").some((entry) => entry.href === "/pagestorm"), false);
const patchDrill = rankSitePaths("/patches", withPatches, "ko");
assert.equal(patchDrill[0]?.href, "/patches/0.111.0");
assert.equal(patchDrill[0]?.action, "commit");
assert.equal(patchDrill.at(-1)?.href, "/patches");
assert.equal(patchDrill.at(-1)?.action, "commit");
const patchAnchors = rankSitePaths("/patches/0.111.0#", withPatches, "ko");
assert.equal(patchAnchors[0]?.labelKo, "패치 노트 — 베타 패치 노트 - v0.111.0#콘텐츠 및 밸런스");
assert.deepEqual(
  patchSectionAnchorIds(
    "## Content & Balance\n### Enemies\n## Bug Fixes\n### Enemies\n",
    "## 콘텐츠\n### 적\n## 버그\n### 적\n",
  ),
  ["content-and-balance", "enemies", "bug-fixes", "enemies-2"],
);
