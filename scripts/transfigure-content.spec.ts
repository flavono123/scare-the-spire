import assert from "node:assert/strict";
import type { EntityInfo } from "../src/components/patch-note-renderer";
import {
  getTransfigureInitialBlocks,
  getTransfigureSourceCost,
  getTransfigureSourceText,
  getTransfigureUpgradeInitialBlocks,
  getTransfigureUpgradeSourceCost,
  getTransfigureUpgradeSourceText,
  isTransfigureChanged,
  isTransfiguredContent,
  normalizeTransfigureCostInput,
  normalizeTransfigureCost,
  normalizeTransfigureName,
  transfigureBlocksToGameDescription,
} from "../src/lib/transfigure-types";
import { serviceMessages } from "../src/messages/service";

const expertise = {
  id: "EXPERTISE",
  nameEn: "Expertise",
  nameKo: "전문성",
  imageUrl: "/images/sts2/cards/expertise.webp",
  color: "silent",
  type: "card",
  cardData: {
    cost: 1,
    isXCost: false,
    description: "카드를 {Cards:diff()}장 뽑습니다.\n그 카드가 이번 턴에\n[gold]보존[/gold]을 얻습니다.",
    descriptionRaw: "카드를 {Cards:diff()}장 뽑습니다.\n그 카드가 이번 턴에\n[gold]보존[/gold]을 얻습니다.",
    vars: { Cards: 2 },
    upgrade: { Cards: "+1", cost: 0 },
    maxUpgradeLevel: 1,
  },
} as unknown as EntityInfo;

const retain = {
  id: "RETAIN",
  nameEn: "Retain",
  nameKo: "보존",
  imageUrl: null,
  color: "colorless",
  type: "keyword",
  keywordData: {
    description: "보존된 카드는 턴 종료 시 버려지지 않습니다.",
  },
} as unknown as EntityInfo;

const sourceText = getTransfigureSourceText(expertise);
const sourceBlocks = getTransfigureInitialBlocks(expertise, [expertise, retain]);
const upgradeSourceText = getTransfigureUpgradeSourceText(expertise);
const upgradeSourceBlocks = getTransfigureUpgradeInitialBlocks(
  expertise,
  [expertise, retain],
);

assert.equal(
  sourceText,
  "카드를 {Cards:diff()}장 뽑습니다. 그 카드가 이번 턴에 보존을 얻습니다.",
);
assert.deepEqual(sourceBlocks, [
  { type: "text", text: "카드를 {Cards:diff()}장 뽑습니다. 그 카드가 이번 턴에 " },
  {
    type: "keyword",
    text: "보존",
    keyword: "보존",
    description: "보존된 카드는 턴 종료 시 버려지지 않습니다.",
    entityId: "RETAIN",
    entityType: "keyword",
  },
  { type: "text", text: "을 얻습니다." },
]);
assert.equal(
  transfigureBlocksToGameDescription(sourceBlocks),
  "카드를 {Cards:diff()}장 뽑습니다. 그 카드가 이번 턴에 [gold]보존[/gold]을 얻습니다.",
);
assert.equal(getTransfigureSourceCost(expertise), "1");
assert.equal(getTransfigureUpgradeSourceCost(expertise), "0");
assert.equal(
  upgradeSourceText,
  "카드를 3장 뽑습니다. 그 카드가 이번 턴에 보존을 얻습니다.",
);
assert.deepEqual(upgradeSourceBlocks, [
  { type: "text", text: "카드를 3장 뽑습니다. 그 카드가 이번 턴에 " },
  {
    type: "keyword",
    text: "보존",
    keyword: "보존",
    description: "보존된 카드는 턴 종료 시 버려지지 않습니다.",
    entityId: "RETAIN",
    entityType: "keyword",
  },
  { type: "text", text: "을 얻습니다." },
]);
assert.equal(normalizeTransfigureCostInput("x"), "X");
assert.equal(normalizeTransfigureCostInput("12"), "12");
assert.equal(normalizeTransfigureCostInput("1x"), "X");
assert.equal(normalizeTransfigureName("", "전문성"), null);
assert.equal(normalizeTransfigureName("전문가", "전문성"), "전문가");
assert.equal(normalizeTransfigureCost("1", "1"), null);
assert.equal(normalizeTransfigureCost("x", "1"), "X");
for (const [locale, messages] of Object.entries(serviceMessages)) {
  assert.ok(
    messages.transfigure.defaultNickname.length <= 20,
    `${locale} Transfigure default nickname must fit the database limit`,
  );
}
assert.equal(isTransfiguredContent(sourceBlocks, sourceText ?? "", sourceBlocks), false);
assert.equal(
  isTransfigureChanged({
    blocks: sourceBlocks,
    sourceText: sourceText ?? "",
    sourceBlocks,
    transformedName: "",
    sourceName: "전문성",
    transformedCost: "",
    sourceCost: "1",
  }),
  false,
);
assert.equal(
  isTransfigureChanged({
    blocks: sourceBlocks,
    sourceText: sourceText ?? "",
    sourceBlocks,
    transformedName: "",
    sourceName: "전문성",
    transformedCost: "",
    sourceCost: "1",
    upgradedBlocks: upgradeSourceBlocks,
    sourceUpgradeText: upgradeSourceText,
    sourceUpgradeBlocks: upgradeSourceBlocks,
    transformedUpgradeCost: "",
    sourceUpgradeCost: "0",
    showUpgrade: true,
  }),
  true,
);
assert.equal(
  isTransfigureChanged({
    blocks: sourceBlocks,
    sourceText: sourceText ?? "",
    sourceBlocks,
    transformedName: "전문가",
    sourceName: "전문성",
    transformedCost: "",
    sourceCost: "1",
  }),
  true,
);
assert.equal(
  isTransfigureChanged({
    blocks: sourceBlocks,
    sourceText: sourceText ?? "",
    sourceBlocks,
    transformedName: "",
    sourceName: "전문성",
    transformedCost: "",
    sourceCost: "1",
    upgradedBlocks: [
      ...(upgradeSourceBlocks ?? []).slice(0, -1),
      { type: "text", text: "을 두 번 얻습니다." },
    ],
    sourceUpgradeText: upgradeSourceText,
    sourceUpgradeBlocks: upgradeSourceBlocks,
    transformedUpgradeCost: "",
    sourceUpgradeCost: "0",
  }),
  true,
);
assert.equal(
  isTransfigureChanged({
    blocks: sourceBlocks,
    sourceText: sourceText ?? "",
    sourceBlocks,
    transformedName: "",
    sourceName: "전문성",
    transformedCost: "",
    sourceCost: "1",
    upgradedBlocks: upgradeSourceBlocks,
    sourceUpgradeText: upgradeSourceText,
    sourceUpgradeBlocks: upgradeSourceBlocks,
    transformedUpgradeCost: "X",
    sourceUpgradeCost: "0",
  }),
  true,
);
assert.equal(
  isTransfigureChanged({
    blocks: sourceBlocks,
    sourceText: sourceText ?? "",
    sourceBlocks,
    transformedName: "",
    sourceName: "전문성",
    transformedCost: "0",
    sourceCost: "1",
  }),
  true,
);
assert.equal(
  isTransfiguredContent(
    [
      ...sourceBlocks.slice(0, -1),
      { type: "text", text: "을 두 번 얻습니다." },
    ],
    sourceText ?? "",
    sourceBlocks,
  ),
  true,
);

console.log("Transfigure rich keyword preservation: ok");
