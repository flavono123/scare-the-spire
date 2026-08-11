"use client";

import { useEffect, useState } from "react";
import { COMPENDIUM_DETAIL_PAYLOAD_PATH } from "@/lib/compendium-detail-payload";
import type { CodexCard } from "@/lib/codex-types";
import { resolveCoverCardId } from "@/lib/run-cover-display";

type Payload = {
  resources?: {
    cards?: CodexCard[];
  };
};

let catalogPromise: Promise<Map<string, CodexCard>> | null = null;

function loadCatalog(): Promise<Map<string, CodexCard>> {
  catalogPromise ??= fetch(COMPENDIUM_DETAIL_PAYLOAD_PATH)
    .then((res) => {
      if (!res.ok) throw new Error(`cover card catalog ${res.status}`);
      return res.json() as Promise<Payload>;
    })
    .then((payload) => {
      const map = new Map<string, CodexCard>();
      for (const card of payload.resources?.cards ?? []) {
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
