import {
  getCodexCards,
  getCodexRelics,
  getCodexPotions,
  getCodexPowers,
  getCodexEnchantments,
  getCodexEvents,
  getCodexMonsters,
  getCodexEncounters,
} from "@/lib/codex-data";
import type { GameLocale } from "@/lib/i18n";
import type { EntityInfo } from "@/components/patch-note-renderer";

export async function loadAllEntities(opts?: { gameLocale?: GameLocale }): Promise<EntityInfo[]> {
  const gameLocale = opts?.gameLocale;
  const [
    codexCards,
    codexRelics,
    codexPotions,
    codexPowers,
    codexEnchantments,
    codexEvents,
    codexMonsters,
    codexEncounters,
  ] = await Promise.all([
    getCodexCards({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
  ]);

  return [
    ...codexCards.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameKo: c.name,
      imageUrl: c.imageUrl,
      color: c.color,
      type: "card" as const,
      cardData: c,
    })),
    ...codexRelics.map((r) => ({
      id: r.id,
      nameEn: r.nameEn,
      nameKo: r.name,
      imageUrl: r.imageUrl,
      color: r.pool,
      type: "relic" as const,
      relicData: r,
    })),
    ...codexPotions.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameKo: p.name,
      imageUrl: p.imageUrl,
      color: p.pool,
      type: "potion" as const,
      potionData: p,
    })),
    ...codexPowers.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameKo: p.name,
      imageUrl: p.imageUrl,
      color: p.type,
      type: "power" as const,
      powerData: p,
    })),
    ...codexEnchantments.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      imageUrl: e.imageUrl,
      color: e.cardType ?? "Any",
      type: "enchantment" as const,
      enchantmentData: e,
    })),
    ...codexEvents.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      imageUrl: e.imageUrl,
      color: e.act ?? "none",
      type: "event" as const,
      eventData: e,
    })),
    ...codexMonsters.map((m) => ({
      id: m.id,
      nameEn: m.nameEn,
      nameKo: m.name,
      imageUrl: m.bossImageUrl ?? m.imageUrl,
      color: m.type,
      type: "monster" as const,
      monsterData: m,
    })),
    ...codexEncounters.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      imageUrl: e.imageUrl,
      color: e.roomType,
      type: "encounter" as const,
      encounterData: e,
    })),
  ];
}
