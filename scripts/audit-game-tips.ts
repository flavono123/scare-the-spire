/**
 * Full audit of game-text tips on the site, from committed data only (no DLL, no build):
 * - Compendium keywords are exactly the tips a gold word names (data/sts2/game-tips.json), with game text verbatim.
 * - Every element's side tips are its game tip list, never more (collect*SideTips over all of them).
 * - Every gold word that names a tip resolves to an entity the site can show; payloads carry the same gold map.
 * Run with `pnpm game-tips:audit` on patch day after scripts/generate-game-tips.py. Deploys never run it.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import gameTipsJson from "../data/sts2/game-tips.json";
import { loadCardSideTipCatalogSources } from "../src/lib/card-side-tip-catalog.server";
import { createCardSideTipCatalog } from "../src/lib/card-side-tip-catalog";
import { collectCardSideTips, type CardSideTip } from "../src/lib/card-keyword-tips";
import { collectRelicSideTips } from "../src/lib/relic-side-tips";
import { collectPotionSideTips } from "../src/lib/potion-side-tips";
import { collectPowerSideTips } from "../src/lib/power-side-tips";
import { collectEnchantmentSideTips } from "../src/lib/enchantment-side-tips";
import { collectAfflictionSideTips } from "../src/lib/affliction-side-tips";
import { getGameTipSpecs, type GameTipElementType } from "../src/lib/game-tip-specs";
import {
  getCodexAfflictions,
  getCodexCards,
  getCodexDominions,
  getCodexEnchantments,
  getCodexKeywords,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
} from "../src/lib/codex-data";
import { readGameLocalizationTable } from "../src/lib/game-localization";
import type { GameLocale } from "../src/lib/i18n";

const problems: string[] = [];
const check = (ok: boolean, message: string) => {
  if (!ok) problems.push(message);
};

/** The tips a side-tip list must hold for a spec list (ids as the side-tip lists name them). */
function expectedTipIds(type: GameTipElementType, id: string): Set<string> {
  const out = new Set<string>();
  for (const spec of getGameTipSpecs(type, id)) {
    if (spec.kind === "forge") out.add("keyword:FORGE").add("card:SOVEREIGN_BLADE");
    else if (spec.kind === "card" || spec.kind === "card_with_tips") out.add(`card:${spec.id}`);
    else if (spec.kind === "affliction") out.add(`keyword:AFFLICTION:${spec.id}`);
    else if (type === "card" && spec.kind === "keyword") continue; // printed keywords, checked by the card selfcheck
    else out.add(`keyword:${spec.id}`);
  }
  return out;
}

function tipIds(tips: readonly CardSideTip[], self: string): Set<string> {
  return new Set(tips.filter((tip) => !tip.id.startsWith(self)).map((tip) => `${tip.kind}:${tip.id}`));
}

async function auditLocale(gameLocale: GameLocale) {
  const goldTips = JSON.parse(fs.readFileSync(`data/sts2/gold-tips/${gameLocale}.json`, "utf-8")) as Record<string, Record<string, string | string[] | null>>;
  const [cards, keywords, relics, potions, powers, enchantments, afflictions, dominions, sources, localCardKeywords, localStatic, localOrbs, engCardKeywords, engStatic, engOrbs] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexKeywords({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
    getCodexDominions({ gameLocale }),
    loadCardSideTipCatalogSources(gameLocale),
    readGameLocalizationTable(gameLocale, "card_keywords"),
    readGameLocalizationTable(gameLocale, "static_hover_tips"),
    readGameLocalizationTable(gameLocale, "orbs"),
    readGameLocalizationTable("eng", "card_keywords"),
    readGameLocalizationTable("eng", "static_hover_tips"),
    readGameLocalizationTable("eng", "orbs"),
  ]);
  // A locale table missing a key shows the English text, as the game does (Thai lacks the Fool's tips).
  const cardKeywordTable = { ...engCardKeywords, ...localCardKeywords };
  const staticTable = { ...engStatic, ...localStatic };
  const orbTable = { ...engOrbs, ...localOrbs };

  // Keywords: the game-tip set, each with its game title and description verbatim.
  const keywordIds = new Set(keywords.map((keyword) => keyword.id));
  for (const id of gameTipsJson.keywords) check(keywordIds.has(id) || !cardKeywordTable[`${id}.description`], `${gameLocale} keyword ${id} missing from the Compendium`);
  for (const keyword of keywords) {
    check(gameTipsJson.keywords.includes(keyword.id), `${gameLocale} keyword ${keyword.id} is not a game text tip`);
    const table = keyword.source === "orb" ? orbTable : keyword.source === "staticHoverTip" ? staticTable : cardKeywordTable;
    check(table[`${keyword.sourceId}.title`] === keyword.name, `${gameLocale} keyword ${keyword.id} title "${keyword.name}" != game "${table[`${keyword.sourceId}.title`]}"`);
    const description = (table[`${keyword.sourceId}.description`] ?? "").replace(/\{ShowArrowCount:[^|]*\|\}/g, "");
    check(description === keyword.description, `${gameLocale} keyword ${keyword.id} description differs from game text`);
  }

  // Side tips: exactly the game tip list (resolved), for every element of every type.
  const catalog = createCardSideTipCatalog({ sources, powers, cards });
  const potionsById = new Map(potions.map((potion) => [potion.id, potion]));
  const enchantmentsById = new Map(enchantments.map((enchantment) => [enchantment.id, enchantment]));
  const afflictionsById = new Map(afflictions.map((affliction) => [affliction.id, affliction]));
  const compare = (type: GameTipElementType, id: string, tips: readonly CardSideTip[], self: string) => {
    const have = tipIds(tips, self);
    for (const want of expectedTipIds(type, id)) {
      check(have.has(want) || !catalogKnows(want), `${gameLocale} ${type}:${id} side tips miss ${want}`);
    }
    const allowed = expectedTipIds(type, id);
    for (const tip of have) {
      // Card-with-tips expansions add the previewed card's keywords; printed card keywords come from the card itself.
      if (tip.startsWith("keyword:") && (type === "card" || [...allowed].some((ref) => ref.startsWith("card:")))) continue;
      check(allowed.has(tip), `${gameLocale} ${type}:${id} side tips add ${tip}, which the game does not attach`);
    }
  };
  const catalogKnows = (ref: string) => {
    const [kind, ...rest] = ref.split(":");
    const id = rest.join(":");
    if (kind === "card") return catalog.cardsById.has(id);
    if (id.startsWith("AFFLICTION:")) return afflictionsById.has(id.slice("AFFLICTION:".length));
    return catalog.keywordsById.has(id) || potionsById.has(id) || enchantmentsById.has(id);
  };
  for (const card of cards) compare("card", card.id, collectCardSideTips(card, catalog), "\u0000");
  for (const relic of relics) compare("relic", relic.id, collectRelicSideTips(relic, catalog, { potionsById, enchantmentsById }), "\u0000");
  for (const potion of potions) compare("potion", potion.id, collectPotionSideTips(potion, catalog, { includeSelf: false }), "\u0000");
  for (const power of powers) compare("power", power.id, collectPowerSideTips(power, catalog, { includeSelf: false, afflictionsById }), "\u0000");
  for (const enchantment of enchantments) compare("enchantment", enchantment.id, collectEnchantmentSideTips(enchantment, catalog, { includeSelf: false }), "\u0000");
  for (const affliction of afflictions) compare("affliction", affliction.id, collectAfflictionSideTips(affliction, catalog, { includeSelf: false }), "\u0000");

  // Gold words: every tip a word names is an entity the site has; payloads carry the committed map.
  const known: Record<string, Set<string>> = {
    keyword: keywordIds,
    card: new Set(cards.map((card) => card.id)),
    relic: new Set(relics.map((relic) => relic.id)),
    potion: new Set(potions.map((potion) => potion.id)),
    power: new Set(powers.map((power) => power.id)),
    enchantment: new Set(enchantments.map((enchantment) => enchantment.id)),
    affliction: new Set(afflictions.map((affliction) => affliction.id)),
  };
  for (const [element, words] of Object.entries(goldTips)) {
    for (const [word, refs] of Object.entries(words)) {
      for (const ref of refs ? [refs].flat() : []) {
        const [kind, id] = ref.split(":");
        check(Boolean(known[kind]?.has(id)), `${gameLocale} ${element} "${word}" names ${ref}, which the site does not have`);
      }
    }
  }
  for (const [type, list] of [["relic", relics], ["enchantment", enchantments], ["affliction", afflictions], ["dominion", dominions]] as const) {
    for (const element of list) {
      assert.deepEqual(element.goldTips, goldTips[`${type}:${element.id}`], `${gameLocale} ${type}:${element.id} payload gold map`);
    }
  }
  const total = Object.values(goldTips).reduce((sum, words) => sum + Object.keys(words).length, 0);
  console.log(`${gameLocale}: ${keywords.length} keywords, ${cards.length + relics.length + potions.length + powers.length + enchantments.length + afflictions.length} side-tip lists, ${total} gold words`);
}

async function main() {
  const locales = (process.argv[2]?.split(",") ?? fs.readdirSync("data/sts2/gold-tips").map((file) => file.replace(/\.json$/, ""))).sort() as GameLocale[];
  for (const locale of locales) await auditLocale(locale);
  for (const line of problems.slice(0, 60)) console.log(line);
  if (problems.length) {
    console.error(`game-tips audit: ${problems.length} problems`);
    process.exit(1);
  }
  console.log(`game-tips audit: ok (${locales.length} locales)`);
}

main();
