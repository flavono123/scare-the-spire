import type { EntityInfo } from "@/components/patch-note-renderer";
import type { CodexPotion } from "@/lib/codex-types";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";

export function lookupHistoryPotion(
  potionsById: Record<string, CodexPotion> | undefined,
  id: string,
): CodexPotion | undefined {
  if (!potionsById) return undefined;
  const stripped = id.replace(/^POTION\./i, "");
  return potionsById[id] ?? potionsById[stripped] ?? potionsById[`POTION.${stripped}`];
}

export function indexCodexPotions(potions: CodexPotion[]): Record<string, CodexPotion> {
  const out: Record<string, CodexPotion> = {};
  for (const potion of potions) {
    out[potion.id] = potion;
    out[`POTION.${potion.id}`] = potion;
  }
  return out;
}

export function buildPotionEntityInfo(potion: CodexPotion | undefined): EntityInfo | null {
  if (!potion) return null;
  return {
    id: potion.id,
    nameEn: potion.nameEn,
    nameKo: potion.name,
    imageUrl: potion.imageUrl,
    href: buildCompendiumResourceHref("potion", potion.id),
    color: potion.pool,
    type: "potion",
    potionData: potion,
  };
}
