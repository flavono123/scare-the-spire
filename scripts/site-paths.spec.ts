import assert from "node:assert/strict";
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
    labelKo: "니오우스레터/2026년 8월#로드맵, 다시",
    labelEn: "Neowsletter/August#Roadmap",
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
assert.equal(anchors[0]?.labelKo, "니오우스레터/2026년 8월#로드맵, 다시");
