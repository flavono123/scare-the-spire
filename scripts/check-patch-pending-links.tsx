import assert from "node:assert/strict";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PatchLineReferenceBlock } from "@/components/patch-line-reference";
import {
  PatchNoteRenderer,
  type EntityInfo,
} from "@/components/patch-note-renderer";
import {
  PatchLineStoriesPanel,
  PatchLineStoryAction,
} from "@/components/patches/patch-note-with-story-actions";
import { ByrdispatchRichText } from "@/app/(main)/byrdispatch/page-content";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { STS2Patch, STS2PatchLine } from "@/lib/types";

function renderPatch(markdown: string, entities: EntityInfo[]): string {
  return renderToStaticMarkup(
    <PatchNoteRenderer
      markdown={markdown}
      entities={entities}
      serviceLocale="en"
      gameLocale="eng"
    />,
  );
}

function renderStaticPatch(markdown: string, entities: EntityInfo[]): string {
  return renderToStaticMarkup(
    <PatchNoteRenderer
      markdown={markdown}
      entities={entities}
      serviceLocale="en"
      gameLocale="eng"
      staticHoverPreviews
    />,
  );
}

const pendingCard: EntityInfo = {
  id: "FAKE_PATCH_LOCAL_CARD",
  nameEn: "Patch First Test Card",
  nameKo: "Patch First Test Card",
  imageUrl: "/_patches/test/patch-first-test-card.webp",
  href: null,
  availability: "pending-compendium",
  color: "pending",
  type: "card",
};

const pendingHtml = renderPatch("[gold:card]Patch First Test Card[/gold]", [pendingCard]);
assert.match(pendingHtml, /Compendium page in progress/);
assert.match(pendingHtml, /role="button"/);
assert.doesNotMatch(pendingHtml, /href="\/compendium\/cards\/fake_patch_local_card"/);

const availableCard: EntityInfo = {
  id: "BASH",
  nameEn: "Bash",
  nameKo: "Bash",
  imageUrl: "/images/sts2/cards/bash.webp",
  availability: "available",
  color: "red",
  type: "card",
};

const availableHtml = renderPatch("[gold:card]Bash[/gold]", [availableCard]);
assert.match(availableHtml, /href="\/en\/compendium\/cards\?card=bash"/);

const internalLinkHtml = renderPatch("[0.110.0](/patches/0.110.0)", []);
assert.match(internalLinkHtml, /href="\/en\/patches\/0\.110\.0"/);
assert.doesNotMatch(internalLinkHtml, /target="_blank"/);

const knowledgeDemonTokenHtml = renderToStaticMarkup(
  <ByrdispatchRichText
    text="{지식의악마토큰}"
    entities={[{
      id: "KNOWLEDGE_DEMON_BOSS",
      nameEn: "Knowledge Demon",
      nameKo: "지식의 악마",
      imageUrl: "/images/sts2/bosses/knowledge_demon_boss.webp",
      color: "boss",
      type: "monster",
    }]}
    gameUi={{} as CodexGameUiLabels}
    serviceLocale="ko"
    gameLocale="kor"
    storyPlaceholder=""
  />,
);
assert.match(knowledgeDemonTokenHtml, /\/images\/sts2\/bosses\/knowledge_demon_boss\.webp/);
assert.doesNotMatch(knowledgeDemonTokenHtml, /지식의악마토큰/);

const staticAvailableHtml = renderStaticPatch("[gold:card]Bash[/gold]", [availableCard]);
assert.match(staticAvailableHtml, /href="\/en\/compendium\/cards\?card=bash"/);
assert.match(staticAvailableHtml, /\/images\/sts2\/cards\/bash\.webp/);
assert.doesNotMatch(staticAvailableHtml, /Compendium page in progress/);

const staticCard: EntityInfo = {
  ...availableCard,
  cardData: {
    id: "BASH",
    name: "Bash",
    nameEn: "Bash",
    description: "Deal 8 damage.",
    descriptionEn: "Deal 8 damage.",
    descriptionRaw: "Deal 8 damage.",
    descriptionRawEn: "Deal 8 damage.",
    vars: {},
    cost: 2,
    isXCost: false,
    isXStarCost: false,
    starCost: null,
    type: "공격",
    typeLabel: "Attack",
    rarity: "기본",
    rarityLabel: "Basic",
    color: "ironclad",
    damage: 8,
    block: null,
    hitCount: null,
    keywords: [],
    keywordLabels: {},
    tags: [],
    appliedPowerIds: [],
    upgrade: null,
    maxUpgradeLevel: 0,
    imageUrl: "/images/sts2/cards/bash.webp",
    betaImageUrl: null,
  } as NonNullable<EntityInfo["cardData"]>,
};
const staticCardHtml = renderStaticPatch("[gold:card]Bash[/gold]", [staticCard]);
assert.match(staticCardHtml, /Deal 8 damage/);
assert.match(staticCardHtml, /data-static-card-preview-template="BASH:0"/);
assert.match(staticCardHtml, /data-static-card-preview="BASH:0"/);
assert.match(staticCardHtml, /data-card-description-viewport/);
assert.match(staticCardHtml, /hidden=""/);

const staticRelic: EntityInfo = {
  id: "AKABEKO",
  nameEn: "Akabeko",
  nameKo: "아카베코",
  imageUrl: "/images/sts2/relics/akabeko.webp",
  availability: "available",
  color: "shared",
  type: "relic",
  relicData: {
    id: "AKABEKO",
    name: "아카베코",
    nameEn: "Akabeko",
    description: "첫 번째 공격의 피해량이 8 증가합니다.",
    descriptionEn: "Your first Attack each combat deals 8 additional damage.",
    descriptionRaw: "첫 번째 공격의 피해량이 {Damage} 증가합니다.",
    descriptionRawEn: "Your first Attack each combat deals {Damage} additional damage.",
    vars: { Damage: 8 },
    flavor: "Moo.",
    rarity: "일반 유물",
    pool: "shared",
    imageUrl: "/images/sts2/relics/akabeko.webp",
    betaImageUrl: null,
    variantImageUrls: null,
    iconVariants: null,
  },
};
const staticRelicHtml = renderStaticPatch("[gold:relic]아카베코[/gold]", [staticRelic]);
assert.match(staticRelicHtml, /data-relic-inspect-slab/);
assert.match(staticRelicHtml, /data-relic-inspect-hover/);
assert.match(staticRelicHtml, /\/images\/sts2\/ui\/inspect-relic\/reward_panel\.webp/);
assert.match(staticRelicHtml, /\/images\/sts2\/relics\/akabeko\.webp/);
assert.match(staticRelicHtml, /첫 번째 공격의 피해량이 8 증가합니다/);

const storyPatchLine: STS2PatchLine = {
  id: "v0.110.0:line-017-card-haze",
  patch: "v0.110.0",
  version: "0.110.0",
  date: "2026-07-31",
  section: ["콘텐츠 및 밸런스", "사일런트"],
  markdownKo: "[gold:card]아지랑이[/gold] 리워크",
  textKo: "아지랑이 리워크",
  entityRefs: [{ type: "card", id: "HAZE", label: "아지랑이" }],
  searchText: "아지랑이 haze",
};

const generatedPatchLines = JSON.parse(
  fs.readFileSync("data/sts2-patch-lines.json", "utf-8"),
) as STS2PatchLine[];
const synchronizePatchLine = generatedPatchLines.find(
  (line) => line.id === "v0.110.0:line-035-card-synchronize",
);
assert.ok(synchronizePatchLine);
const synchronizeReferenceHtml = renderToStaticMarkup(
  <PatchLineReferenceBlock
    patchLine={synchronizePatchLine}
    serviceLocale="ko"
    clickable={false}
  />,
);
assert.match(synchronizeReferenceHtml, /강화 시 구체 종류당 얻는 일시적 밀집이 2 → 3으로 증가합니다/);
assert.match(synchronizeReferenceHtml, /더 이상 소멸하지 않습니다/);

const populatedStoryActionHtml = renderToStaticMarkup(
  <PatchLineStoryAction
    count={1}
    staticCount={0}
    patchLine={storyPatchLine}
    serviceLocale="ko"
    storiesUnavailable={false}
    onOpen={() => undefined}
    onWrite={() => undefined}
  />,
);
assert.match(populatedStoryActionHtml, /data-patch-line-story-tooltip-title/);
assert.match(populatedStoryActionHtml, /더 많은 이야기!/);
assert.match(populatedStoryActionHtml, /슬서운 이야기 1개 보기/);

const storyPatch: STS2Patch = {
  id: "v0.110.0",
  version: "0.110.0",
  date: "2026-07-31",
  title: "Beta Patch Notes - v0.110.0",
  titleKo: "베타 패치 노트 - v0.110.0",
  type: "beta",
  steamUrl: null,
  summary: "Silent balance changes.",
  summaryKo: "사일런트 밸런스 변경.",
  hasBalanceChanges: true,
};
const storyPanelHtml = renderToStaticMarkup(
  <PatchLineStoriesPanel
    patchLine={storyPatchLine}
    stories={[{ id: "story", sentence: "아지랑이 이야기", patchLineId: storyPatchLine.id }]}
    serviceLocale="ko"
    patches={[storyPatch]}
    patchArt={{
      imageUrl: "/images/sts2/cards/constellation.webp",
      alt: "별자리 카드 아트",
      objectPosition: "center",
    }}
    communityUnavailable={false}
    onClose={() => undefined}
    onWrite={() => undefined}
  />,
);
assert.match(storyPanelHtml, /\/images\/sts2\/cards\/constellation\.webp/);
assert.doesNotMatch(storyPanelHtml, /\/images\/sts2\/nav\/patch_notes_icon\.png/);

console.log("patch Worker regressions passed");
