import assert from "node:assert/strict";
import type { PostBlock } from "../src/lib/chemical-types";
import { CHEMICAL_X_PAGE_OG_IMAGE } from "../src/lib/page-og-images";
import { composeToyBoxPostOgDescription } from "../src/lib/service-metadata";
import {
  chemicalPostOgImage,
  comboPostOgImage,
  firstChemicalKeywordResource,
  toyboxResourceOgImageUrl,
  truncateOgTitle,
} from "../src/lib/toybox-post-og";

assert.equal(truncateOgTitle("  bash   strike  "), "bash strike");
assert.equal(truncateOgTitle(""), "");
assert.ok(truncateOgTitle("한".repeat(90)).endsWith("…"));
assert.equal(truncateOgTitle("한".repeat(90)).length, 80);

assert.equal(
  composeToyBoxPostOgDescription({
    serviceLocale: "ko",
    serviceName: "변형",
    serviceDescription: "게임 요소를 고쳐 씁니다.",
  }),
  "슬레이 더 스파이어 2 · 슬서운 이야기 · 변형 · 게임 요소를 고쳐 씁니다.",
);
assert.equal(
  composeToyBoxPostOgDescription({
    serviceLocale: "en",
    serviceName: "Transfigure",
    serviceDescription: "Rewrite a game element.",
  }),
  "Slay the Spire 2 · Scare the Spire · Transfigure · Rewrite a game element.",
);

assert.equal(
  toyboxResourceOgImageUrl("card", "BASH"),
  "/images/sts2/cards/bash.webp",
);
assert.equal(
  toyboxResourceOgImageUrl("power", "ACCELERANT"),
  "/images/sts2/powers/accelerant_power.webp",
);
assert.equal(
  toyboxResourceOgImageUrl("character", "IRONCLAD"),
  "/images/sts2/characters/select_ironclad.webp",
);
assert.equal(
  toyboxResourceOgImageUrl("keyword", "BLOCK"),
  "/images/sts2/ui/topbar/submenu_history_icon.png",
);
assert.equal(toyboxResourceOgImageUrl("encounter", "SOME_FIGHT"), null);

const youtubeContent: PostBlock[] = [
  { type: "text", text: "combo" },
  { type: "youtube", videoId: "dQw4w9WgXcQ", title: "Never Gonna Give You Up" },
];
const youtubeImage = comboPostOgImage({
  content: youtubeContent,
  resources: [{ type: "card", id: "BASH" }],
});
assert.equal(
  youtubeImage?.url,
  "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "YouTube references should win over first resource art",
);

const firstArtImage = comboPostOgImage({
  content: [{ type: "text", text: "just cards" }],
  resources: [{ type: "relic", id: "AKABEKO" }],
});
assert.equal(
  firstArtImage?.url,
  "/images/sts2/relics/akabeko.webp",
  "missing YouTube and run refs should use the first resource art",
);

const historyRunImage = comboPostOgImage({
  content: [{
    type: "history-run",
    runId: "run-1",
    snapshot: {
      character: "CHARACTER.SILENT",
      startTime: null,
      ascension: 0,
      win: false,
      totalFloors: 1,
      runTime: null,
      build: "0.1",
      seed: "1",
      coverSpec: {
        background: { kind: "card-beta", cardId: "BACKSTAB" },
        phrase: "quiet",
        elements: [],
        auto: true,
        suggestSeed: "seed",
      },
    },
  }],
  resources: [{ type: "card", id: "BASH" }],
});
assert.equal(
  historyRunImage?.url,
  "/images/sts2/cards/backstab.webp",
  "history-run cover art should win over first resource art",
);

const keywordBlocks: PostBlock[] = [
  { type: "text", text: "hello " },
  {
    type: "keyword",
    text: "커스텀",
    description: "no art",
  },
  {
    type: "keyword",
    text: "Bash",
    description: "Deal damage",
    entityType: "card",
    entityId: "BASH",
  },
];
assert.deepEqual(
  firstChemicalKeywordResource(keywordBlocks),
  { type: "card", id: "BASH" },
);
assert.equal(
  chemicalPostOgImage(keywordBlocks).url,
  "/images/sts2/cards/bash.webp",
);
assert.equal(
  chemicalPostOgImage([{ type: "text", text: "no keywords" }]).url,
  CHEMICAL_X_PAGE_OG_IMAGE.url,
);

console.log("toybox-post-og.spec.ts: ok");
