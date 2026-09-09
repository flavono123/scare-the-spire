import assert from "node:assert/strict";
import type { EntityInfo } from "../src/components/patch-note-renderer";
import {
  applyTransfigureCardMetadata,
  canSubmitTransfigure,
  canTransfigureCardMetadata,
  getTransfigureInitialBlocks,
  getTransfigureSourceCost,
  getTransfigureSourceText,
  getTransfigureUpgradeInitialBlocks,
  getTransfigureUpgradeSourceCost,
  getTransfigureUpgradeSourceText,
  isTransfigureChanged,
  isTransfiguredContent,
  normalizeTransfigureCardColor,
  normalizeTransfigureCardRarity,
  normalizeTransfigureCardType,
  normalizeTransfigureCostInput,
  normalizeTransfigureCost,
  normalizeTransfigureName,
  normalizeTransfigureTokenColor,
  normalizeTransfigureTokenWax,
  transfigureBlocksToGameDescription,
  transfigureHasExistingGameElementRefs,
  transfigureHasExistingRefsOrDiff,
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
    type: "스킬",
    typeLabel: "스킬",
    rarity: "고급",
    rarityLabel: "고급",
    color: "silent",
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
assert.equal(normalizeTransfigureCardType("스킬", "스킬"), null);
assert.equal(normalizeTransfigureCardType("공격", "스킬"), "공격");
assert.equal(normalizeTransfigureCardType("저주", "스킬"), null);
assert.equal(normalizeTransfigureCardRarity("고급", "고급"), null);
assert.equal(normalizeTransfigureCardRarity("희귀", "고급"), "희귀");
assert.equal(normalizeTransfigureCardRarity("토큰", "고급"), null);
assert.equal(normalizeTransfigureCardRarity("고대의 존재", "고급"), null);
assert.equal(normalizeTransfigureCardColor("silent", "silent"), null);
assert.equal(normalizeTransfigureCardColor("ironclad", "silent"), "ironclad");
assert.equal(normalizeTransfigureCardColor("curse", "silent"), "curse");
assert.equal(normalizeTransfigureCardColor("token", "silent"), "token");
assert.equal(canTransfigureCardMetadata("스킬", "고급"), true);
assert.equal(canTransfigureCardMetadata("스킬", "고대의 존재"), false);
assert.equal(canTransfigureCardMetadata("저주", "저주"), false);
const transformedCard = applyTransfigureCardMetadata(
  expertise.cardData!,
  [
    expertise,
    {
      ...expertise,
      id: "BASH",
      cardData: {
        ...expertise.cardData!,
        type: "공격",
        typeLabel: "Attack",
        rarity: "희귀",
        rarityLabel: "Rare",
      },
    } as EntityInfo,
  ],
  "공격",
  "희귀",
);
assert.deepEqual(
  [
    transformedCard.type,
    transformedCard.typeLabel,
    transformedCard.rarity,
    transformedCard.rarityLabel,
  ],
  ["공격", "Attack", "희귀", "Rare"],
);
assert.equal(transformedCard.color, "silent");
const characterPoolCard = applyTransfigureCardMetadata(
  expertise.cardData!,
  [expertise],
  null,
  null,
  "ironclad",
);
assert.deepEqual(
  [characterPoolCard.type, characterPoolCard.color, characterPoolCard.visualColor],
  ["스킬", "ironclad", "ironclad"],
);
const cursePoolCard = applyTransfigureCardMetadata(
  expertise.cardData!,
  [expertise],
  "스킬",
  null,
  "curse",
);
assert.deepEqual(
  [cursePoolCard.type, cursePoolCard.rarity, cursePoolCard.color, cursePoolCard.visualColor],
  ["스킬", "고급", "curse", "curse"],
);
const tokenPoolCard = applyTransfigureCardMetadata(
  expertise.cardData!,
  [expertise],
  null,
  null,
  "token",
);
assert.deepEqual(
  [tokenPoolCard.type, tokenPoolCard.color, tokenPoolCard.visualColor],
  ["스킬", "token", "token"],
);
const transformedAncientCard = applyTransfigureCardMetadata(
  {
    ...expertise.cardData!,
    rarity: "고대의 존재",
    rarityLabel: "고대의 존재",
  },
  [expertise],
  "공격",
  "희귀",
  "defect",
);
assert.deepEqual(
  [
    transformedAncientCard.type,
    transformedAncientCard.rarity,
    transformedAncientCard.color,
    transformedAncientCard.visualColor,
  ],
  ["스킬", "고대의 존재", "defect", "defect"],
);
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
    transformedName: "",
    sourceName: "전문성",
    transformedCost: "",
    sourceCost: "1",
    transformedCardType: "공격",
    sourceCardType: "스킬",
    sourceCardRarity: "고급",
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
    transformedCardRarity: "희귀",
    sourceCardType: "스킬",
    sourceCardRarity: "고급",
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
    sourceCardType: "스킬",
    sourceCardRarity: "고급",
    sourceCardColor: "silent",
    transformedCardColor: "ironclad",
  }),
  true,
);
assert.equal(
  isTransfigureChanged({
    blocks: sourceBlocks,
    sourceText: sourceText ?? "",
    sourceBlocks,
    transformedName: "",
    sourceName: "풍요",
    transformedCost: "",
    sourceCost: "1",
    transformedCardType: "공격",
    sourceCardType: "스킬",
    sourceCardRarity: "고대의 존재",
  }),
  false,
);
assert.equal(
  isTransfigureChanged({
    blocks: sourceBlocks,
    sourceText: sourceText ?? "",
    sourceBlocks,
    transformedName: "",
    sourceName: "풍요",
    transformedCost: "",
    sourceCost: "1",
    sourceCardType: "스킬",
    sourceCardRarity: "고대의 존재",
    sourceCardColor: "silent",
    transformedCardColor: "defect",
  }),
  true,
);
assert.equal(
  isTransfigureChanged({
    blocks: sourceBlocks,
    sourceText: sourceText ?? "",
    sourceBlocks,
    transformedName: "",
    sourceName: "상해",
    transformedCost: "",
    sourceCost: "",
    sourceCardType: "저주",
    sourceCardRarity: "저주",
    sourceCardColor: "curse",
    transformedCardColor: "ironclad",
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

assert.equal(
  isTransfigureChanged({
    blocks: sourceBlocks,
    sourceText: sourceText ?? "",
    sourceBlocks,
    transformedName: "",
    sourceName: "전문성",
    transformedCost: "",
    sourceCost: "1",
    resourceType: "relic",
    tokenColor: "gold",
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
    resourceType: "card",
    tokenColor: "gold",
    tokenWax: "wax",
  }),
  false,
);

assert.equal(normalizeTransfigureTokenColor("gold", "relic"), "gold");
assert.equal(normalizeTransfigureTokenColor("gold", "card"), null);
assert.equal(normalizeTransfigureTokenColor("ghost", "potion"), null);
assert.equal(normalizeTransfigureTokenWax("wax", "power"), "wax");
assert.equal(normalizeTransfigureTokenWax("melted", "relic"), "melted");
assert.equal(normalizeTransfigureTokenWax("off", "relic"), null);
assert.equal(normalizeTransfigureTokenWax("wax", "card"), null);

const plainBlocks = [{ type: "text" as const, text: "피해를 6 줍니다." }];
const plainRewrite = [{ type: "text" as const, text: "피해를 8 줍니다." }];
const customKeywordOnly = [{
  type: "keyword" as const,
  text: "농담",
  keyword: "농담",
  description: "없는 키워드",
}];
const unchangedPlain = {
  blocks: plainBlocks,
  sourceText: "피해를 6 줍니다.",
  sourceBlocks: plainBlocks,
  transformedName: "",
  sourceName: "타격",
  transformedCost: "",
  sourceCost: "1",
};

assert.equal(transfigureHasExistingGameElementRefs(sourceBlocks), true);
assert.equal(transfigureHasExistingGameElementRefs(plainBlocks), false);
assert.equal(transfigureHasExistingGameElementRefs(customKeywordOnly), false);

assert.equal(
  transfigureHasExistingRefsOrDiff({
    ...unchangedPlain,
    showUpgrade: true,
  }),
  false,
);
assert.equal(
  canSubmitTransfigure({
    ...unchangedPlain,
    showUpgrade: true,
  }),
  false,
);
assert.equal(
  canSubmitTransfigure({
    blocks: sourceBlocks,
    sourceText: sourceText ?? "",
    sourceBlocks,
    transformedName: "",
    sourceName: "전문성",
    transformedCost: "",
    sourceCost: "1",
    showUpgrade: true,
  }),
  true,
);
assert.equal(
  canSubmitTransfigure({
    ...unchangedPlain,
    blocks: plainRewrite,
  }),
  true,
);
assert.equal(
  canSubmitTransfigure({
    ...unchangedPlain,
    transformedName: "강타",
  }),
  true,
);

console.log("Transfigure rich keyword preservation: ok");
