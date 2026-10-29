import assert from "node:assert/strict";
import { createCardSideTipCatalog } from "@/lib/card-side-tip-catalog";
import {
  loadCardSideTipCatalogSources,
  loadLinkedCardSideTipSources,
} from "@/lib/card-side-tip-catalog.server";
import {
  getCodexCards,
  getCodexEnchantments,
  getCodexMonsters,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
} from "@/lib/codex-data";
import { getRelatedCardIdsForRelic, getRelatedEnchantmentIdsForRelic } from "@/lib/codex-references";
import {
  compactCardKeywordLabels,
  expandCardKeywordLabels,
  pickLinkedRows,
  slimLinkedEnchantments,
} from "@/lib/compendium-list-props";
import {
  collectCardListSideTips,
  collectPotionListSideTips,
  collectRelicListSideTips,
  getRelicSideTipRowIds,
} from "@/lib/compendium-list-side-tips";
import { GAME_LOCALES } from "@/lib/i18n";
import { collectPotionSideTips } from "@/lib/potion-side-tips";
import { collectRelicSideTips } from "@/lib/relic-side-tips";

// The relic, potion, and card lists send the side tip catalog rows their
// modals and tiles read (loadLinkedCardSideTipSources), for when the data
// chunks fail. A catalog built from those rows, the way the loaders build it
// without the chunks (no powers or monsters; the relic list's linked cards,
// potions, and enchantments; the card list's own rows), must show every tip
// the full catalog shows once the chunks load.

// Props and chunks reach the client as JSON.
const viaJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const kb = (value: unknown) => `${(JSON.stringify(value).length / 1024).toFixed(1)} KB`;

async function main() {
  const sizes: string[] = [];
  for (const gameLocale of GAME_LOCALES) {
    const [sources, powers, cards, monsters, potions, enchantments, relics] = await Promise.all([
      loadCardSideTipCatalogSources(gameLocale),
      getCodexPowers({ includeDeprecated: true, gameLocale }),
      getCodexCards({ includeDeprecated: true, gameLocale }),
      getCodexMonsters({ gameLocale }),
      getCodexPotions({ gameLocale }),
      getCodexEnchantments({ gameLocale }),
      getCodexRelics({ gameLocale }),
    ]);
    const full = createCardSideTipCatalog({ sources, powers, cards, monsters });

    // Relic list (src/app/(codex)/_codex/relics/page.tsx).
    const linkedCards = pickLinkedRows(cards, relics.flatMap((relic) => getRelatedCardIdsForRelic(relic.id)));
    const linkedEnchantments = slimLinkedEnchantments(pickLinkedRows(enchantments, [
      ...relics.flatMap((relic) => getRelatedEnchantmentIdsForRelic(relic, enchantments)),
      ...getRelicSideTipRowIds(relics, "enchantment"),
    ]));
    const linkedPotions = pickLinkedRows(potions, getRelicSideTipRowIds(relics, "potion"));
    const relicTipSources = await loadLinkedCardSideTipSources(
      gameLocale,
      (catalog) => collectRelicListSideTips(relics, catalog, { potions, enchantments }),
      { sentCards: linkedCards },
    );
    const relicFallback = createCardSideTipCatalog({
      sources: viaJson(relicTipSources),
      powers: [],
      cards: viaJson(linkedCards),
      monsters: [],
    });
    const fullRows = {
      potionsById: new Map(potions.map((potion) => [potion.id, potion])),
      enchantmentsById: new Map(enchantments.map((enchantment) => [enchantment.id, enchantment])),
    };
    const linkedRows = {
      potionsById: new Map(viaJson(linkedPotions).map((potion) => [potion.id, potion])),
      enchantmentsById: new Map(viaJson(linkedEnchantments).map((enchantment) => [enchantment.id, enchantment])),
    };
    let relicTips = 0;
    for (const relic of relics) {
      for (const includeSelf of [false, true]) {
        const expected = viaJson(collectRelicSideTips(relic, full, { includeSelf, ...fullRows }));
        assert.deepEqual(
          viaJson(collectRelicSideTips(relic, relicFallback, { includeSelf, ...linkedRows })),
          expected,
          `${gameLocale}: relic ${relic.id} (includeSelf ${includeSelf}) side tips differ without the chunks`,
        );
        if (!includeSelf) relicTips += expected.length;
      }
      // The side tip enchantments added to the linked rows must not change the related enchantment line.
      assert.deepEqual(
        getRelatedEnchantmentIdsForRelic(relic, linkedEnchantments),
        getRelatedEnchantmentIdsForRelic(relic, enchantments),
        `${gameLocale}: relic ${relic.id} related enchantments differ`,
      );
    }

    // Potion list (src/app/(codex)/_codex/potions/page.tsx).
    const potionTipSources = await loadLinkedCardSideTipSources(
      gameLocale,
      (catalog) => collectPotionListSideTips(potions, catalog),
    );
    const potionFallback = createCardSideTipCatalog({
      sources: viaJson(potionTipSources),
      powers: [],
      cards: [],
      monsters: [],
    });
    let potionTips = 0;
    for (const potion of potions) {
      const expected = viaJson(collectPotionSideTips(potion, full, { includeSelf: true }));
      assert.deepEqual(
        viaJson(collectPotionSideTips(potion, potionFallback, { includeSelf: true })),
        expected,
        `${gameLocale}: potion ${potion.id} side tips differ without the chunks`,
      );
      potionTips += expected.length;
    }

    // Card list (src/app/(codex)/_codex/cards/page.tsx). A catalog can only
    // lose tips, so equal per-card lists mean every state is equal.
    const compact = viaJson(compactCardKeywordLabels(cards));
    const listCards = expandCardKeywordLabels(compact.cards, compact.keywordLabels);
    const cardTipSources = await loadLinkedCardSideTipSources(
      gameLocale,
      (catalog) => collectCardListSideTips(cards, catalog),
      { sentCards: cards },
    );
    const cardFallback = createCardSideTipCatalog({
      sources: viaJson(cardTipSources),
      powers: [],
      cards: listCards,
      monsters: [],
    });
    let cardTips = 0;
    for (const [index, card] of cards.entries()) {
      const expected = viaJson(collectCardListSideTips([card], full));
      assert.deepEqual(
        viaJson(collectCardListSideTips([listCards[index]], cardFallback)),
        expected,
        `${gameLocale}: card ${card.id} side tips differ without the chunks`,
      );
      cardTips += expected.length;
    }

    assert.ok(relicTips > 0 && potionTips > 0 && cardTips > 0, `${gameLocale}: no tips collected`);
    sizes.push(
      `${gameLocale} relics ${kb(relicTipSources)} + ${kb(linkedPotions)} potions,`
        + ` potions ${kb(potionTipSources)}, cards ${kb(cardTipSources)}`,
    );
  }
  console.log(sizes.join("\n"));
  console.log(`list side tip sources match the full catalog for ${GAME_LOCALES.length} game locales`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
