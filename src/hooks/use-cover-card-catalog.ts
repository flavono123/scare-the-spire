"use client";

import { useEffect, useState } from "react";
import { loadCompendiumData } from "@/lib/compendium-data-chunks";
import type { CodexCard } from "@/lib/codex-types";
import { resolveCoverCardId } from "@/lib/run-cover-display";

let catalogPromise: Promise<Map<string, CodexCard>> | null = null;

function loadCatalog(): Promise<Map<string, CodexCard>> {
  catalogPromise ??= loadCompendiumData("kor", ["cards"])
    .then(({ cards }) => {
      const map = new Map<string, CodexCard>();
      for (const card of cards) {
        map.set(card.id.toUpperCase(), card);
      }
      return map;
    })
    .catch(() => new Map<string, CodexCard>());
  return catalogPromise;
}

export function useCoverCardCatalog(): Map<string, CodexCard> {
  const [map, setMap] = useState<Map<string, CodexCard>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    void loadCatalog().then((next) => {
      if (!cancelled) setMap(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return map;
}

export function coverCatalogCard(
  catalog: Map<string, CodexCard>,
  cardId: string,
): CodexCard | null {
  const resolved = resolveCoverCardId(cardId);
  return (
    catalog.get(resolved.toUpperCase()) ??
    catalog.get(cardId.toUpperCase()) ??
    null
  );
}
