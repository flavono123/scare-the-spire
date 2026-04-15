import type { Metadata } from "next";
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
import type { EntityInfo } from "@/components/patch-note-renderer";
import { ChemicalXClient } from "@/components/chemicalx/chemicalx-client";

export const metadata: Metadata = {
  title: "케미컬엑스 — 슬서운 이야기",
  description: "슬더스 이야기를 짧게, 강렬하게. 카드와 유물을 태그하며 공유하세요.",
};

export default async function ChemicalXPage() {
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
    getCodexCards(),
    getCodexRelics(),
    getCodexPotions(),
    getCodexPowers(),
    getCodexEnchantments(),
    getCodexEvents(),
    getCodexMonsters(),
    getCodexEncounters(),
  ]);

  const entities: EntityInfo[] = [
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ChemicalXClient entities={entities} />
    </div>
  );
}
