import assert from "node:assert/strict";
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
assert.equal(pagestormDropZone(0.2, 0.5), "left");
assert.equal(pagestormDropZone(0.8, 0.5), "right");
assert.equal(pagestormPointerZone(-0.2, 0.5, false, 0.2), "before");
assert.equal(pagestormPointerZone(1.2, 0.5, false, 0.8), "after");
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

console.log("pagestorm.spec.ts: ok");
