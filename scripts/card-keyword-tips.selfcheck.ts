import assert from "node:assert/strict";
import {
  buildCardSideTipCatalog,
  collectCardSideTips,
  extractGoldTerms,
  stripLocalizationTitleTemplates,
} from "../src/lib/card-keyword-tips";
import {
  getCodexCards,
  getCodexKeywords,
  getCodexMonsters,
  getCodexPowers,
} from "../src/lib/codex-data";
import { readGameLocalizationTable } from "../src/lib/game-localization";

function tipKeys(tips: ReturnType<typeof collectCardSideTips>): string[] {
  return tips.map((tip) => `${tip.kind}:${tip.id}`);
}

async function main() {
  assert.equal(
    stripLocalizationTitleTemplates("뽑을 카드 더미 {Hotkey:choose(None):| ({})}"),
    "뽑을 카드 더미",
  );
  assert.deepEqual(extractGoldTerms("피해를 8 줍니다.\n[gold]취약[/gold]을 2 부여합니다."), ["취약"]);

  const gameLocale = "kor" as const;
  const [
    cards,
    keywords,
    powers,
    monsters,
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

  const byId = new Map(cards.map((card) => [card.id, card]));

  const bash = byId.get("BASH");
  assert.ok(bash);
  assert.deepEqual(tipKeys(collectCardSideTips(bash, catalog)), ["keyword:VULNERABLE"]);

  const accuracy = byId.get("ACCURACY");
  assert.ok(accuracy);
  assert.deepEqual(tipKeys(collectCardSideTips(accuracy, catalog)), ["card:SHIV"]);

  const cloak = byId.get("CLOAK_AND_DAGGER");
  assert.ok(cloak);
  assert.deepEqual(
    tipKeys(collectCardSideTips(cloak, catalog)),
    ["keyword:BLOCK", "card:SHIV"],
  );

  const turbo = byId.get("TURBO");
  assert.ok(turbo);
  assert.deepEqual(
    tipKeys(collectCardSideTips(turbo, catalog)),
    ["keyword:DISCARD_PILE", "card:VOID"],
  );

  const bone = byId.get("BONE_SHARDS");
  assert.ok(bone);
  assert.deepEqual(tipKeys(collectCardSideTips(bone, catalog)), ["monster:OSTY"]);

  const rainbow = byId.get("RAINBOW");
  assert.ok(rainbow);
  assert.deepEqual(
    tipKeys(collectCardSideTips(rainbow, catalog)),
    [
      "keyword:EXHAUST",
      "keyword:LIGHTNING_ORB",
      "keyword:CHANNELING",
      "keyword:FROST_ORB",
      "keyword:DARK_ORB",
    ],
  );

  const apparition = byId.get("APPARITION");
  assert.ok(apparition);
  assert.deepEqual(
    tipKeys(collectCardSideTips(apparition, catalog)),
    ["keyword:EXHAUST", "keyword:ETHEREAL", "keyword:INTANGIBLE"],
  );

  const hiddenGem = byId.get("HIDDEN_GEM");
  assert.ok(hiddenGem);
  assert.deepEqual(
    tipKeys(collectCardSideTips(hiddenGem, catalog)),
    ["keyword:DRAW_PILE", "keyword:REPLAY"],
  );

  // FromForge(): Forge tip + Sovereign Blade preview + that card's Retain tip.
  // Not general tip-text cascading — Retain comes from the blade's keywords.
  const beatIntoShape = byId.get("BEAT_INTO_SHAPE");
  assert.ok(beatIntoShape);
  assert.deepEqual(
    tipKeys(collectCardSideTips(beatIntoShape, catalog)),
    ["keyword:FORGE", "card:SOVEREIGN_BLADE", "keyword:RETAIN"],
  );

  const theSmith = byId.get("THE_SMITH");
  assert.ok(theSmith);
  assert.deepEqual(
    tipKeys(collectCardSideTips(theSmith, catalog)),
    ["keyword:FORGE", "card:SOVEREIGN_BLADE", "keyword:RETAIN"],
  );

  // Accuracy uses FromCard<Shiv>, not FromCardWithCardHoverTips — no Exhaust cascade.
  assert.equal(
    tipKeys(collectCardSideTips(accuracy, catalog)).includes("keyword:EXHAUST"),
    false,
  );

  // English Block gold on multiplayer card still resolves via eng static title.
  const engCards = await getCodexCards({ includeDeprecated: true, gameLocale: "eng" });
  const engCatalog = buildCardSideTipCatalog({
    keywords: await getCodexKeywords({ gameLocale: "eng" }),
    powers: await getCodexPowers({ includeDeprecated: true, gameLocale: "eng" }),
    cards: engCards,
    monsters: await getCodexMonsters({ gameLocale: "eng" }),
    staticHoverTips: engStaticHoverTips,
    engStaticHoverTips,
    orbs: engOrbs,
    engOrbs,
    monsterNames: engMonsterNames,
    engMonsterNames,
  });
  const constellation = engCards.find((card) => card.id === "CONSTELLATION");
  assert.ok(constellation);
  assert.ok(
    tipKeys(collectCardSideTips(constellation, engCatalog)).includes("keyword:BLOCK"),
  );

  const { chooseCardSideTipHorizontal, placeCardSideTip } = await import("../src/lib/card-side-tip-placement");
  assert.equal(
    chooseCardSideTipHorizontal({
      leftSpace: 400,
      rightSpace: 200,
      tipWidth: 300,
      preferSide: "left",
    }),
    "left",
  );
  assert.equal(
    chooseCardSideTipHorizontal({
      leftSpace: 400,
      rightSpace: 200,
      tipWidth: 300,
      preferSide: "right",
    }),
    "left",
  );
  assert.equal(
    chooseCardSideTipHorizontal({
      leftSpace: 250,
      rightSpace: 250,
      tipWidth: 300,
      preferSide: "left",
    }),
    null,
  );
  assert.equal(
    chooseCardSideTipHorizontal({
      leftSpace: 290,
      rightSpace: 400,
      tipWidth: 300,
      preferSide: "left",
    }),
    "right",
  );

  const wide = placeCardSideTip({
    card: { left: 400, right: 780, top: 120, bottom: 700 },
    tipWidth: 280,
    tipHeight: 120,
    preferSide: "left",
    viewportWidth: 1440,
    viewportHeight: 900,
    rail: { left: 980, right: 1400, top: 80, bottom: 800 },
  });
  assert.ok(wide);
  assert.ok(wide!.left + 280 <= 400 - 8);
  assert.equal(wide!.left >= 12, true);

  const tight = placeCardSideTip({
    card: { left: 200, right: 580, top: 120, bottom: 700 },
    tipWidth: 280,
    tipHeight: 120,
    preferSide: "left",
    viewportWidth: 900,
    viewportHeight: 800,
    rail: { left: 620, right: 880, top: 80, bottom: 780 },
  });
  assert.equal(tight, null);

  console.log("card-keyword-tips.selfcheck: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
