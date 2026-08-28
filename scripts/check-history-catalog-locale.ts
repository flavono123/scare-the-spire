import assert from "node:assert/strict";
import {
  overlayHistoryCard,
  overlayHistoryRelic,
  localizeHistoryCatalog,
  locResourceId,
} from "../src/lib/history-catalog-locale";
import { getHistoryLocTablesSync, loadHistoryLocTables } from "../src/lib/history-loc-tables";
import type { CodexCard, CodexKeyword, CodexRelic } from "../src/lib/codex-types";

async function main() {
  const eng = getHistoryLocTablesSync("eng");
  assert.ok(eng, "English history locale tables must be available synchronously");

  const strike = {
    id: "STRIKE_IRONCLAD",
    name: "타격",
    nameEn: "Strike",
    description: "피해를 줍니다.",
    descriptionEn: "Deal 6 damage.",
    descriptionRaw: "피해를 {Damage:diff()} 줍니다.",
    descriptionRawEn: "Deal {Damage:diff()} damage.",
    vars: { Damage: 6 },
    type: "공격",
    typeLabel: "공격",
    rarity: "기본",
    rarityLabel: "기본",
    keywordLabels: { 선천성: "선천성" },
  } as unknown as CodexCard;

  const keywords = [
    { id: "INNATE", name: "선천성", nameEn: "Innate", source: "cardKeyword" },
  ] as CodexKeyword[];

  const overlaid = overlayHistoryCard(strike, eng, keywords);
  assert.equal(overlaid.name, "Strike");
  assert.equal(overlaid.typeLabel, "Attack");
  assert.match(overlaid.description, /Deal/i);
  assert.equal(overlaid.keywordLabels["선천성"], "Innate");
  assert.equal(locResourceId("CARD.HELLBLADE_DANCE"), "HELLBLADE_DANCE");

  const relic = {
    id: "BURNING_BLOOD",
    name: "타오르는 피",
    nameEn: "Burning Blood",
    description: "한국어 설명",
    descriptionEn: "At the end of combat, heal 6 HP.",
    descriptionRaw: "한국어",
    descriptionRawEn: "At the end of combat, heal {Heal} HP.",
    vars: { Heal: 6 },
    flavor: "한국어 플레이버",
  } as unknown as CodexRelic;

  const overlaidRelic = overlayHistoryRelic(relic, eng);
  assert.equal(overlaidRelic.name, "Burning Blood");
  assert.match(overlaidRelic.description, /heal/i);

  const zhs = await loadHistoryLocTables("zhs");
  assert.ok(zhs, "Chinese history locale tables must load");
  const zhsCard = overlayHistoryCard(strike, zhs, keywords);
  assert.notEqual(zhsCard.name, "타격");
  assert.notEqual(zhsCard.name, "Strike");
  assert.notEqual(zhsCard.typeLabel, "공격");
  assert.notEqual(zhsCard.typeLabel, "Attack");

  const catalog = localizeHistoryCatalog(
    {
      allCards: [strike],
      allRelics: [relic],
      allPotions: [],
      allPowers: [],
      allMonsters: [],
      allEnchantments: [],
      tipSources: {
        keywords,
        staticHoverTips: {},
        engStaticHoverTips: {},
        orbs: {},
        engOrbs: {},
        monsterNames: {},
        engMonsterNames: {},
      },
    },
    eng,
  );
  assert.equal(catalog.allCards[0]?.name, "Strike");
  assert.equal(catalog.allRelics[0]?.name, "Burning Blood");

  console.log("history-catalog-locale ok");
}

void main();
