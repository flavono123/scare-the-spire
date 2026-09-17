import assert from "node:assert/strict";
import {
  parsePagestormJson,
  parsePagestormScript,
} from "../src/components/pagestorm/script-parser";
import {
  CARD_ART_IMAGE_ASPECT,
  clampAssetWidth,
  defaultAssetBox,
  sizedAssetBox,
  WIDE_ART_MAX_WIDTH,
  WIDE_ART_MIN_WIDTH,
} from "../src/components/pagestorm/sample";
import {
  pagestormDropZone,
  pagestormPointerZone,
} from "../src/components/pagestorm/asset-layout";
import {
  PAGESTORM_BACKGROUND_SRC,
  PAGESTORM_BETA_ART_SRC,
  pagestormFirstAssetThumb,
  pagestormIndexThumb,
  type PagestormDoc,
} from "../src/lib/pagestorm";
import {
  isPagestormToyboxPickerHref,
  pagestormToyboxEmbedHeight,
  pagestormToyboxFederatedFromHref,
  pagestormToyboxPickerMode,
  pagestormToyboxJsonArray,
  pagestormToyboxNodeAttrs,
  pagestormToyboxPostHref,
  pagestormToyboxServiceHref,
  parsePagestormTransfigurePreview,
} from "../src/lib/pagestorm-toybox";

const doc: PagestormDoc = {
  type: "doc",
  content: [
    {
      type: "gameAsset",
      attrs: {
        kind: "card",
        presentation: "tile",
        imageUrl: "/images/sts2/cards/pagestorm.webp",
        name: "서류 폭풍",
      },
    },
    {
      type: "gameAsset",
      attrs: {
        kind: "event",
        presentation: "art",
        imageUrl: "/images/sts2/events/abyssal_baths.webp",
        name: "심연의 욕탕",
      },
    },
  ],
};

const thumb = pagestormFirstAssetThumb(doc);
assert.ok(thumb);
assert.equal(thumb.kind, "event");
assert.equal(thumb.imageUrl, "/images/sts2/events/abyssal_baths.webp");

const tileOnly = pagestormFirstAssetThumb({
  type: "doc",
  content: [doc.content![0]],
});
assert.ok(tileOnly);
assert.equal(tileOnly.kind, "card");

assert.equal(pagestormFirstAssetThumb({ type: "doc", content: [] }), null);

const characterThenCard: PagestormDoc = {
  type: "doc",
  content: [
    {
      type: "gameAsset",
      attrs: {
        kind: "character",
        presentation: "art",
        imageUrl: "/images/sts2/characters/char_select_ironclad.webp",
        name: "아이언클래드",
      },
    },
    {
      type: "gameAsset",
      attrs: {
        kind: "card",
        presentation: "art",
        imageUrl: PAGESTORM_BACKGROUND_SRC,
        name: "서류 폭풍",
      },
    },
  ],
};
const artOverPortrait = pagestormFirstAssetThumb(characterThenCard);
assert.ok(artOverPortrait);
assert.equal(artOverPortrait.kind, "card");
assert.equal(artOverPortrait.imageUrl, PAGESTORM_BACKGROUND_SRC);

const relicOnly = pagestormFirstAssetThumb({
  type: "doc",
  content: [{
    type: "gameAsset",
    attrs: {
      kind: "relic",
      presentation: "art",
      imageUrl: "/images/sts2/relics/chemical_x.webp",
      name: "케미컬 X",
    },
  }],
});
assert.ok(relicOnly);
assert.equal(relicOnly.kind, "relic");

const emptyIndex = pagestormIndexThumb({ type: "doc", content: [] });
assert.equal(emptyIndex.imageUrl, PAGESTORM_BETA_ART_SRC);
assert.equal(emptyIndex.kind, "card");

assert.equal(clampAssetWidth("card", 2000, "art"), WIDE_ART_MAX_WIDTH);
assert.equal(clampAssetWidth("event", 2000, "art"), WIDE_ART_MAX_WIDTH);
assert.equal(clampAssetWidth("epoch", 2000, "art"), WIDE_ART_MAX_WIDTH);
assert.equal(clampAssetWidth("card", 2000, "tile"), 380);

const wideCardArt = sizedAssetBox("card", 1080, 10, "art");
assert.equal(wideCardArt.width, WIDE_ART_MAX_WIDTH);
assert.equal(wideCardArt.height, Math.round(WIDE_ART_MAX_WIDTH / CARD_ART_IMAGE_ASPECT));

const tileBox = sizedAssetBox("card", 150, 211, "tile");
assert.equal(tileBox.width, 150);
assert.equal(tileBox.height, 211);

const artDefault = defaultAssetBox("card", "art");
assert.equal(artDefault.width, WIDE_ART_MIN_WIDTH);
assert.equal(artDefault.height, Math.round(WIDE_ART_MIN_WIDTH / CARD_ART_IMAGE_ASPECT));

assert.equal(pagestormDropZone(0.2, 0.1), "before");
assert.equal(pagestormDropZone(0.8, 0.9), "after");
assert.equal(pagestormDropZone(0.2, 0.25), "left");
assert.equal(pagestormDropZone(0.2, 0.5), "left");
assert.equal(pagestormDropZone(0.8, 0.5), "right");
assert.equal(pagestormPointerZone(0.5, -0.2, false, 0.2), "before");
assert.equal(pagestormPointerZone(0.5, 1.2, false, 0.8), "after");
assert.equal(pagestormPointerZone(-0.2, 0.5, false, 0.5), "left");
assert.equal(pagestormPointerZone(1.2, 0.5, false, 0.5), "right");
assert.equal(pagestormPointerZone(0.2, 0.5, true, 0.8), "left");

const nestedArt = pagestormFirstAssetThumb({
  type: "doc",
  content: [{
    type: "assetRow",
    content: [
      {
        type: "gameAsset",
        attrs: {
          kind: "card",
          presentation: "tile",
          imageUrl: "/images/sts2/cards/strike.webp",
          name: "타격",
        },
      },
      {
        type: "gameAsset",
        attrs: {
          kind: "card",
          presentation: "art",
          imageUrl: PAGESTORM_BACKGROUND_SRC,
          name: "서류 폭풍",
        },
      },
    ],
  }],
});
assert.ok(nestedArt);
assert.equal(nestedArt.presentation, "art");
assert.equal(nestedArt.imageUrl, PAGESTORM_BACKGROUND_SRC);

assert.equal(pagestormToyboxFederatedFromHref("/this-or-that"), "this_or_that");
assert.equal(pagestormToyboxFederatedFromHref("/en/decisions-decisions"), "decisions_decisions");
assert.equal(pagestormToyboxFederatedFromHref("/pagestorm"), "pagestorm");
assert.equal(pagestormToyboxFederatedFromHref("/history-course"), null);
assert.equal(pagestormToyboxPickerMode(null), "all");
assert.equal(pagestormToyboxPickerMode("/defragment"), "unsupported");
assert.equal(pagestormToyboxPickerMode("/history-course"), "unsupported");
assert.equal(pagestormToyboxPickerMode("/pagestorm"), "unsupported");
assert.equal(isPagestormToyboxPickerHref("/chemical-x"), false);
assert.equal(isPagestormToyboxPickerHref("/c-c-c-combo"), false);
assert.equal(isPagestormToyboxPickerHref("/defragment"), false);
assert.equal(isPagestormToyboxPickerHref("/transfigure"), true);
assert.equal(isPagestormToyboxPickerHref("/this-or-that"), true);
assert.equal(isPagestormToyboxPickerHref("/history-course"), false);
assert.equal(isPagestormToyboxPickerHref("/pagestorm"), false);
assert.equal(pagestormToyboxServiceHref("this_or_that"), "/this-or-that");
assert.equal(pagestormToyboxEmbedHeight("/this-or-that"), 248);
assert.equal(pagestormToyboxEmbedHeight("/transfigure", "card"), 420);
assert.equal(pagestormToyboxEmbedHeight("/transfigure", "relic"), 448);
assert.equal(pagestormToyboxEmbedHeight("/transfigure", "potion"), 340);
assert.equal(
  pagestormToyboxPostHref("this_or_that", "post-1", "ko", "kor"),
  "/this-or-that/post-1",
);
assert.equal(
  pagestormToyboxPostHref("/this-or-that", "post-1", "ko", "kor"),
  "/this-or-that/post-1",
);
assert.deepEqual(
  pagestormToyboxJsonArray('[{"id":"a"}]'),
  [{ id: "a" }],
);
const snapshotAttrs = pagestormToyboxNodeAttrs({
  id: "live-1",
  service: "/this-or-that",
  userId: "u1",
  title: "높이맞음?",
  nickname: "디황",
  leftType: "card",
  leftId: "strike",
  rightType: "card",
  rightId: "defend",
  rows: [],
  placements: [],
  pool: [],
  tokenSrc: "/images/sts2/relics/choices_paradox.webp",
  transfigure: null,
});
assert.equal(snapshotAttrs.postId, "live-1");
assert.equal(snapshotAttrs.leftType, "card");
assert.equal(snapshotAttrs.height, 248);
assert.equal(snapshotAttrs.rowsJson, "[]");
assert.equal(snapshotAttrs.transfigureJson, "null");

const transfigurePreview = parsePagestormTransfigurePreview({
  blocks: [{ type: "text", text: "장갑이 따뜻하다" }],
  transformedName: "따뜻한 장갑",
  cardTopKeywords: [],
  cardBottomKeywords: [],
  upgradedCardTopKeywords: [],
  upgradedCardBottomKeywords: [],
  showUpgrade: false,
  tokenColor: "gold",
  tokenWax: "",
});
assert.ok(transfigurePreview);
assert.equal(transfigurePreview.transformedName, "따뜻한 장갑");
assert.equal(transfigurePreview.tokenColor, "gold");
assert.equal(transfigurePreview.omitEnergyCost, false);
assert.equal(parsePagestormTransfigurePreview("null"), null);
assert.equal(parsePagestormTransfigurePreview(""), null);

const transfigureAttrs = pagestormToyboxNodeAttrs({
  id: "tf-1",
  service: "/transfigure",
  userId: "u1",
  title: "따뜻한 장갑(리워크)",
  nickname: "디황",
  leftType: "relic",
  leftId: "TOASTY_MITTENS",
  rightType: "",
  rightId: "",
  rows: [],
  placements: [],
  pool: [],
  tokenSrc: "",
  transfigure: transfigurePreview,
});
assert.equal(transfigureAttrs.height, 448);
assert.match(transfigureAttrs.transfigureJson, /따뜻한 장갑/);

// Script parser test
const sampleScript = `
# 리젠트 공략
작성자: 첨탑러
https://youtu.be/gYFnuuIL5ro

<서류 폭풍>
{서류 폭풍 카드는 매우 강력합니다.}
{리젠트의 핵심 카드 중 하나입니다.}

<서류 폭풍, 우주 먼지>
{두 카드를 연계하면 좋습니다.}

<일반 짤: 인트로 화면>
{시작 대사}
`;

const mockEntities = [
  {
    id: "PAGESTORM",
    type: "card" as const,
    nameKo: "서류 폭풍",
    imageUrl: "/images/sts2/cards/pagestorm.webp",
    href: "/compendium/cards/PAGESTORM",
  },
  {
    id: "STARDUST",
    type: "card" as const,
    nameKo: "우주 먼지",
    imageUrl: "/images/sts2/cards/stardust.webp",
    href: "/compendium/cards/STARDUST",
  },
];

const parsedScript = parsePagestormScript(sampleScript, mockEntities);
assert.ok(parsedScript);
assert.equal(parsedScript.title, "리젠트 공략");
assert.equal(parsedScript.nickname, "첨탑러");
assert.ok(parsedScript.nodes.length >= 4);

// First node is youtubePlayer
assert.equal(parsedScript.nodes[0].type, "youtubePlayer");
assert.equal(parsedScript.nodes[0].attrs?.videoId, "gYFnuuIL5ro");

// Single asset node
assert.equal(parsedScript.nodes[2].type, "gameAsset");
assert.equal(parsedScript.nodes[2].attrs?.assetId, "PAGESTORM");

// Multi asset row node
assert.equal(parsedScript.nodes[4].type, "assetRow");
assert.equal(parsedScript.nodes[4].content?.length, 2);

// JSON parser test
const jsonString = JSON.stringify({
  title: "테스트 제목",
  nickname: "테스터",
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "테스트 내용" }] }],
  },
});
const parsedJson = parsePagestormJson(jsonString);
assert.ok(parsedJson);
assert.equal(parsedJson.title, "테스트 제목");
assert.equal(parsedJson.nickname, "테스터");
assert.equal(parsedJson.doc.type, "doc");

console.log("pagestorm.spec.ts: ok");

