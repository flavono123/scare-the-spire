import assert from "node:assert/strict";
import { buildCardSideTipCatalog } from "../src/lib/card-keyword-tips";
import {
  collectPowerSideTips,
  getPowerExtraHoverTipSpecs,
} from "../src/lib/power-side-tips";
import {
  getCodexAfflictions,
  getCodexCards,
  getCodexKeywords,
  getCodexMonsters,
  getCodexPowers,
} from "../src/lib/codex-data";
import { readGameLocalizationTable } from "../src/lib/game-localization";

function tipKeys(tips: ReturnType<typeof collectPowerSideTips>): string[] {
  return tips.map((tip) => `${tip.kind}:${tip.id}`);
}

async function main() {
  assert.deepEqual(getPowerExtraHoverTipSpecs("SEEKING_EDGE"), [{ kind: "forge" }]);
  assert.deepEqual(getPowerExtraHoverTipSpecs("HEX"), [
    { kind: "affliction", id: "HEXED" },
    { kind: "keyword", id: "ETHEREAL" },
  ]);

  const gameLocale = "kor" as const;
  const [
    cards,
    keywords,
    powers,
    monsters,
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
  const afflictionsById = new Map(afflictions.map((item) => [item.id, item]));
  const byId = new Map(powers.map((power) => [power.id, power]));

  const strength = byId.get("STRENGTH");
  assert.ok(strength);
  assert.deepEqual(
    tipKeys(collectPowerSideTips(strength, catalog, { afflictionsById })),
    ["keyword:POWER_SELF:STRENGTH"],
  );

  const seeking = byId.get("SEEKING_EDGE");
  assert.ok(seeking);
  assert.deepEqual(
    tipKeys(collectPowerSideTips(seeking, catalog, { afflictionsById })),
    [
      "keyword:POWER_SELF:SEEKING_EDGE",
      "keyword:FORGE",
      "card:SOVEREIGN_BLADE",
      "keyword:RETAIN",
    ],
  );

  const hex = byId.get("HEX");
  assert.ok(hex);
  assert.deepEqual(
    tipKeys(collectPowerSideTips(hex, catalog, { afflictionsById })),
    [
      "keyword:POWER_SELF:HEX",
      "keyword:AFFLICTION:HEXED",
      "keyword:ETHEREAL",
    ],
  );

  const vital = byId.get("VITAL_SPARK");
  assert.ok(vital);
  assert.deepEqual(
    tipKeys(collectPowerSideTips(vital, catalog, { afflictionsById })),
    [
      "keyword:POWER_SELF:VITAL_SPARK",
      "keyword:AFFLICTION:TAINTED",
      "keyword:TAINTED",
    ],
  );

  console.log("power-side-tips.selfcheck: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
