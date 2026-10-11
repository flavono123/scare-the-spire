import assert from "node:assert/strict";
import { canonicalSitePath, openSitePathQuery, rankSitePaths, type SitePathEntry } from "../src/lib/site-paths";

const entries: SitePathEntry[] = [
  {
    href: "/patches/neowsletters",
    kind: "page",
    labelKo: "니오우스레터",
    labelEn: "Neowsletter",
    titleKo: "니오우스레터",
    titleEn: "Neowsletter",
    previewKo: "",
    previewEn: "",
  },
  {
    href: "/patches/neowsletters/2026-08",
    kind: "neowsletter",
    labelKo: "2026년 8월",
    labelEn: "August 2026",
    titleKo: "2026년 8월",
    titleEn: "August 2026",
    previewKo: "",
    previewEn: "",
  },
  {
    href: "/patches/neowsletters/2026-08#claim-ascension-10-line-2",
    kind: "neowsletter-line",
    labelKo: "Casey: 대체로 승천 10",
    labelEn: "Casey: Ascension 10",
    titleKo: "2026년 8월 · C&A에게 묻다",
    titleEn: "August 2026 · Ask C&A",
    previewKo: "Casey: 대체로 승천 10이 이 게임에서 둘 가장 높은 난이도",
    previewEn: "Casey: Ascension 10",
  },
];

assert.equal(openSitePathQuery("본문 /patches/neo"), "/patches/neo");
assert.equal(openSitePathQuery("https://example.com"), null);
assert.equal(
  canonicalSitePath("http://localhost:3000/patches/neowsletters/2026-08#claim-ascension-10-line-2"),
  "/patches/neowsletters/2026-08#claim-ascension-10-line-2",
);
assert.equal(canonicalSitePath("https://example.com/patches"), null);

const matches = rankSitePaths("/patches/neowsletters/2026-08#claim-ascension", entries, "ko");
assert.equal(matches[0]?.href, "/patches/neowsletters/2026-08#claim-ascension-10-line-2");
assert.equal(rankSitePaths("/", entries, "ko").every((entry) => entry.kind === "page"), true);
