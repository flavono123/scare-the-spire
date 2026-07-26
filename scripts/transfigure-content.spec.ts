import assert from "node:assert/strict";
import type { EntityInfo } from "../src/components/patch-note-renderer";
import {
  getTransfigureInitialBlocks,
  getTransfigureSourceText,
  isTransfiguredContent,
  transfigureBlocksToGameDescription,
} from "../src/lib/transfigure-types";

const expertise = {
  id: "EXPERTISE",
  nameEn: "Expertise",
  nameKo: "전문성",
  imageUrl: "/images/sts2/cards/expertise.webp",
  color: "silent",
  type: "card",
  cardData: {
    description: "카드를 {Cards:diff()}장 뽑습니다.\n그 카드가 이번 턴에\n[gold]보존[/gold]을 얻습니다.",
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
assert.equal(isTransfiguredContent(sourceBlocks, sourceText ?? "", sourceBlocks), false);
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
