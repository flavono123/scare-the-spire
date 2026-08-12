import assert from "node:assert/strict";
import {
  buildCardSideTipCatalog,
  collectCardSideTips,
} from "../src/lib/card-keyword-tips";
import {
  collectRelicSideTips,
  getRelicExtraHoverTipSpecs,
} from "../src/lib/relic-side-tips";
import {
  getCodexCards,
  getCodexKeywords,
  getCodexMonsters,
  getCodexPowers,
  getCodexRelics,
} from "../src/lib/codex-data";
import { readGameLocalizationTable } from "../src/lib/game-localization";

function tipKeys(tips: ReturnType<typeof collectRelicSideTips>): string[] {
  return tips.map((tip) => `${tip.kind}:${tip.id}`);
}

async function main() {
  assert.deepEqual(getRelicExtraHoverTipSpecs("PHYLACTERY_UNBOUND"), [
    { kind: "static", id: "SUMMON_STATIC" },
  ]);
  assert.deepEqual(getRelicExtraHoverTipSpecs("FENCING_MANUAL"), [{ kind: "forge" }]);

  const gameLocale = "kor" as const;
  const [
    cards,
    keywords,
    powers,
    monsters,
    relics,
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
    getCodexRelics({ gameLocale }),
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

  const byId = new Map(relics.map((relic) => [relic.id, relic]));

  const unbound = byId.get("PHYLACTERY_UNBOUND");
  assert.ok(unbound);
  assert.deepEqual(
    tipKeys(collectRelicSideTips(unbound, catalog, { includeSelf: true })),
    ["keyword:RELIC_SELF:PHYLACTERY_UNBOUND", "keyword:SUMMON_STATIC"],
  );
  assert.deepEqual(
    tipKeys(collectRelicSideTips(unbound, catalog, { includeSelf: false })),
    ["keyword:SUMMON_STATIC"],
  );

  const fencing = byId.get("FENCING_MANUAL");
  assert.ok(fencing);
  assert.deepEqual(
    tipKeys(collectRelicSideTips(fencing, catalog, { includeSelf: false })),
    ["keyword:FORGE", "card:SOVEREIGN_BLADE", "keyword:RETAIN"],
  );

  // Cards still resolve without gold-scraping relic extras.
  const bash = cards.find((card) => card.id === "BASH");
  assert.ok(bash);
  assert.deepEqual(tipKeys(collectCardSideTips(bash, catalog)), ["keyword:VULNERABLE"]);

  console.log("relic-side-tips.selfcheck: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
