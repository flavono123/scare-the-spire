import type { CodexCard } from "@/lib/codex-types";
import { localizeGame, type GameI18nTables } from "@/lib/sts2-game-i18n";
import {
  getMadScienceVariantPartsFromId,
  MAD_SCIENCE_CARD_ID,
} from "@/lib/tinker-time";

function stripCardPrefix(id: string): string {
  return id.includes(".") ? (id.split(".").pop() ?? id) : id;
}

export function historyCardKeyVariants(id: string): string[] {
  const stripped = stripCardPrefix(id);
  return [...new Set([id, stripped, `CARD.${stripped}`])];
}

export function lookupHistoryCard(
  cardsById: Record<string, CodexCard>,
  id: string,
): CodexCard | undefined {
  for (const key of historyCardKeyVariants(id)) {
    const hit = cardsById[key];
    if (hit) return hit;
  }
  const stripped = stripCardPrefix(id).toUpperCase();
  for (const [key, card] of Object.entries(cardsById)) {
    if (stripCardPrefix(key).toUpperCase() === stripped) return card;
  }
  return undefined;
}

/** Index Compendium cards under both catalog and replay id shapes. */
export function indexCodexCards(cards: CodexCard[]): Record<string, CodexCard> {
  const out: Record<string, CodexCard> = {};
  for (const card of cards) {
    out[card.id] = card;
    out[`CARD.${card.id}`] = card;
  }
  return out;
}

export function historyCardDisplayName(
  id: string,
  tables: GameI18nTables,
  card?: CodexCard,
): string {
  const parts = getMadScienceVariantPartsFromId(id);
  const baseId = parts ? MAD_SCIENCE_CARD_ID : id;
  const base =
    localizeGame(tables, "cards", baseId) ??
    card?.name ??
    stripCardPrefix(baseId);
  if (!parts?.riderId) return base;
  const rider = localizeGame(
    tables,
    "events",
    `TINKER_TIME.pages.CHOOSE_RIDER.options.${parts.riderId}`,
  );
  return rider ? `${base} · ${rider}` : base;
}
