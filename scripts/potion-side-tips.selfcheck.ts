import assert from "node:assert/strict";
import { buildCardSideTipCatalog } from "../src/lib/card-keyword-tips";
import {
  collectPotionSideTips,
  getPotionExtraHoverTipSpecs,
} from "../src/lib/potion-side-tips";
import {
  getCodexCards,
  getCodexKeywords,
  getCodexMonsters,
  getCodexPotions,
  getCodexPowers,
} from "../src/lib/codex-data";
import { readGameLocalizationTable } from "../src/lib/game-localization";

function tipKeys(tips: ReturnType<typeof collectPotionSideTips>): string[] {
  return tips.map((tip) => `${tip.kind}:${tip.id}`);
}

async function main() {
  assert.deepEqual(getPotionExtraHoverTipSpecs("CUNNING_POTION"), [
    { kind: "card", id: "SHIV", upgrade: true },
  ]);
  assert.deepEqual(getPotionExtraHoverTipSpecs("KINGS_COURAGE"), [{ kind: "forge" }]);

  const gameLocale = "kor" as const;
  const [
    cards,
    keywords,
    powers,
    monsters,
    potions,
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
    getCodexPotions({ gameLocale }),
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

  const byId = new Map(potions.map((potion) => [potion.id, potion]));

  const strength = byId.get("STRENGTH_POTION");
  assert.ok(strength);
  assert.deepEqual(
    tipKeys(collectPotionSideTips(strength, catalog)),
    ["keyword:POTION_SELF:STRENGTH_POTION", "keyword:STRENGTH"],
  );

  const cunning = byId.get("CUNNING_POTION");
  assert.ok(cunning);
  const cunningTips = collectPotionSideTips(cunning, catalog);
  assert.deepEqual(tipKeys(cunningTips), [
    "keyword:POTION_SELF:CUNNING_POTION",
    "card:SHIV",
  ]);
  const shivTip = cunningTips.find((tip) => tip.kind === "card" && tip.id === "SHIV");
  assert.ok(shivTip && shivTip.kind === "card");
  assert.equal(shivTip.upgrade, true);

  const kings = byId.get("KINGS_COURAGE");
  assert.ok(kings);
  assert.deepEqual(
    tipKeys(collectPotionSideTips(kings, catalog)),
    [
      "keyword:POTION_SELF:KINGS_COURAGE",
      "keyword:FORGE",
      "card:SOVEREIGN_BLADE",
      "keyword:RETAIN",
    ],
  );

  const ghouls = byId.get("POT_OF_GHOULS");
  assert.ok(ghouls);
  assert.deepEqual(
    tipKeys(collectPotionSideTips(ghouls, catalog)),
    ["keyword:POTION_SELF:POT_OF_GHOULS", "card:SOUL"],
  );

  console.log("potion-side-tips.selfcheck: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
