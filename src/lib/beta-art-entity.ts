"use client";

import { useEffect, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import { loadCompendiumData } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";
import type { BetaArtEntry } from "@/lib/vexing-puzzlebox-types";

const DATA_KEY = { card: "cards", relic: "relics", power: "powers", epoch: "epochs" } as const;

/** Compendium data for one beta art entry's hover tip, loaded from the shared chunks on demand. */
async function loadBetaArtEntity(entry: BetaArtEntry, gameLocale: GameLocale): Promise<EntityInfo | null> {
  const key = DATA_KEY[entry.type];
  const data = await loadCompendiumData(gameLocale, [key]);
  const base = {
    id: entry.id,
    nameEn: entry.nameEn,
    nameKo: entry.name,
    href: buildCompendiumResourceHref(entry.type, entry.id),
  };
  if (entry.type === "card") {
    const card = data.cards?.find((item) => item.id === entry.id);
    return card ? { ...base, imageUrl: card.imageUrl ?? card.betaImageUrl, color: card.color, type: "card", cardData: card } : null;
  }
  if (entry.type === "relic") {
    const relic = data.relics?.find((item) => item.id === entry.id);
    return relic ? { ...base, imageUrl: relic.imageUrl, color: relic.pool, type: "relic", relicData: relic } : null;
  }
  if (entry.type === "power") {
    const power = data.powers?.find((item) => item.id === entry.id);
    return power ? { ...base, imageUrl: power.imageUrl, color: power.type, type: "power", powerData: power } : null;
  }
  const epoch = data.epochs?.find((item) => item.id === entry.id);
  return epoch ? { ...base, imageUrl: epoch.imageUrl, color: epoch.affiliation, type: "epoch", epochData: epoch } : null;
}

export function useBetaArtEntity(entry: BetaArtEntry | null, gameLocale: GameLocale): EntityInfo | null {
  const [loaded, setLoaded] = useState<{ key: string; entity: EntityInfo | null } | null>(null);
  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    loadBetaArtEntity(entry, gameLocale).then((entity) => {
      if (!cancelled) setLoaded({ key: entry.key, entity });
    }, () => {
      if (!cancelled) setLoaded({ key: entry.key, entity: null });
    });
    return () => {
      cancelled = true;
    };
  }, [entry, gameLocale]);
  return entry && loaded?.key === entry.key ? loaded.entity : null;
}
