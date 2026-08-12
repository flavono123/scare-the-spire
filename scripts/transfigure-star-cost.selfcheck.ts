import assert from "node:assert/strict";
import type { EntityInfo } from "../src/components/patch-note-renderer";
import {
  getTransfigureSourceStarCost,
  getTransfigureUpgradeSourceStarCost,
  isTransfigureChanged,
  normalizeTransfigureCost,
  normalizeTransfigureCostInput,
} from "../src/lib/transfigure-types";

function cardEntity(cardData: {
  id: string;
  starCost: number | null;
  isXStarCost?: boolean;
  upgrade?: Record<string, string | number> | null;
}): EntityInfo {
  return {
    id: cardData.id,
    nameEn: cardData.id,
    nameKo: cardData.id,
    imageUrl: null,
    color: "regent",
    type: "card",
    cardData: {
      id: cardData.id,
      name: cardData.id,
      nameEn: cardData.id,
      description: "test",
      descriptionEn: "test",
      descriptionRaw: "test",
      descriptionRawEn: "test",
      vars: {},
      cost: 1,
      isXCost: false,
      isXStarCost: cardData.isXStarCost ?? false,
      starCost: cardData.starCost,
      type: "스킬",
      typeLabel: "스킬",
      rarity: "일반",
      rarityLabel: "일반",
      color: "regent",
      damage: null,
      block: null,
      hitCount: null,
      keywords: [],
      keywordLabels: {},
      tags: [],
      appliedPowerIds: [],
      upgrade: cardData.upgrade ?? null,
      maxUpgradeLevel: 1,
      imageUrl: null,
      betaImageUrl: null,
    },
  };
}

assert.equal(normalizeTransfigureCostInput("3x"), "X");
assert.equal(normalizeTransfigureCostInput("12"), "12");
assert.equal(normalizeTransfigureCost("2", "1"), "2");
assert.equal(normalizeTransfigureCost("1", "1"), null);

const numeric = cardEntity({ id: "STAR_ORB", starCost: 1 });
assert.equal(getTransfigureSourceStarCost(numeric), "1");
assert.equal(getTransfigureUpgradeSourceStarCost(numeric), "1");

const xStar = cardEntity({
  id: "STARDUST",
  starCost: null,
  isXStarCost: true,
});
assert.equal(getTransfigureSourceStarCost(xStar), "X");

const upgraded = cardEntity({
  id: "STAR_UP",
  starCost: 2,
  upgrade: { starCost: 1 },
});
assert.equal(getTransfigureUpgradeSourceStarCost(upgraded), "1");

assert.equal(
  isTransfigureChanged({
    blocks: [{ type: "text", text: "same" }],
    sourceText: "same",
    sourceBlocks: [{ type: "text", text: "same" }],
    transformedName: "",
    sourceName: "Star Orb",
    transformedCost: "",
    sourceCost: "1",
    transformedStarCost: "3",
    sourceStarCost: "1",
  }),
  true,
);

assert.equal(
  isTransfigureChanged({
    blocks: [{ type: "text", text: "same" }],
    sourceText: "same",
    sourceBlocks: [{ type: "text", text: "same" }],
    transformedName: "",
    sourceName: "Star Orb",
    transformedCost: "",
    sourceCost: "1",
    transformedStarCost: "1",
    sourceStarCost: "1",
  }),
  false,
);

console.log("transfigure-star-cost.selfcheck: ok");
