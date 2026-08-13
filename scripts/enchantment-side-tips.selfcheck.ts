import assert from "node:assert/strict";
import { buildCardSideTipCatalog } from "../src/lib/card-keyword-tips";
import {
  collectEnchantmentSideTips,
  getEnchantmentExtraHoverTipSpecs,
} from "../src/lib/enchantment-side-tips";
import {
  collectAfflictionSideTips,
  getAfflictionExtraHoverTipSpecs,
} from "../src/lib/affliction-side-tips";
import {
  getCodexAfflictions,
  getCodexCards,
  getCodexEnchantments,
  getCodexKeywords,
  getCodexMonsters,
  getCodexPowers,
} from "../src/lib/codex-data";
import { readGameLocalizationTable } from "../src/lib/game-localization";

function tipKeys(tips: { kind: string; id: string }[]): string[] {
  return tips.map((tip) => `${tip.kind}:${tip.id}`);
}

async function main() {
  assert.deepEqual(getEnchantmentExtraHoverTipSpecs("INKY"), [
    { kind: "power", id: "WEAK" },
  ]);
  assert.deepEqual(getEnchantmentExtraHoverTipSpecs("ROYALLY_APPROVED"), [
    { kind: "keyword", id: "INNATE" },
    { kind: "keyword", id: "RETAIN" },
  ]);
  assert.deepEqual(getAfflictionExtraHoverTipSpecs("HEXED"), [
    { kind: "keyword", id: "ETHEREAL" },
  ]);

  const gameLocale = "kor" as const;
  const [
    cards,
    keywords,
    powers,
    monsters,
    enchantments,
    afflictions,
    staticHoverTips,
    engStaticHoverTips,
    orbs,
    engOrbs,
    monsterNames,
    engMonsterNames,
  ] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexKeywords({ gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
    readGameLocalizationTable(gameLocale, "static_hover_tips"),
    readGameLocalizationTable("eng", "static_hover_tips"),
    readGameLocalizationTable(gameLocale, "orbs"),
    readGameLocalizationTable("eng", "orbs"),
    readGameLocalizationTable(gameLocale, "monsters"),
    readGameLocalizationTable("eng", "monsters"),
  ]);

  const catalog = buildCardSideTipCatalog({
    keywords,
    powers,
    cards,
    monsters,
    staticHoverTips,
    engStaticHoverTips,
    orbs,
    engOrbs,
    monsterNames,
    engMonsterNames,
  });

  const enchById = new Map(enchantments.map((item) => [item.id, item]));
  const affById = new Map(afflictions.map((item) => [item.id, item]));

  const inky = enchById.get("INKY");
  assert.ok(inky);
  assert.deepEqual(
    tipKeys(collectEnchantmentSideTips(inky, catalog)),
    ["keyword:ENCHANTMENT_SELF:INKY", "keyword:WEAK"],
  );

  const royal = enchById.get("ROYALLY_APPROVED");
  assert.ok(royal);
  assert.deepEqual(
    tipKeys(collectEnchantmentSideTips(royal, catalog)),
    [
      "keyword:ENCHANTMENT_SELF:ROYALLY_APPROVED",
      "keyword:INNATE",
      "keyword:RETAIN",
    ],
  );

  const hexed = affById.get("HEXED");
  assert.ok(hexed);
  assert.deepEqual(
    tipKeys(collectAfflictionSideTips(hexed, catalog)),
    ["keyword:AFFLICTION_SELF:HEXED", "keyword:ETHEREAL"],
  );

  const bound = affById.get("BOUND");
  assert.ok(bound);
  assert.deepEqual(
    tipKeys(collectAfflictionSideTips(bound, catalog)),
    ["keyword:AFFLICTION_SELF:BOUND"],
  );

  console.log("enchantment-side-tips.selfcheck: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
