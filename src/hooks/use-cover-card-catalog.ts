"use client";

import { useEffect, useState } from "react";
import { useRetryWhenRequested } from "@/components/compendium-data-retry";
import { loadCompendiumData } from "@/lib/compendium-data-chunks";
import type { CodexCard } from "@/lib/codex-types";
import { resolveCoverCardId } from "@/lib/run-cover-display";

const COVER_CARD_KEYS = ["cards"] as const;

let catalogPromise: Promise<Map<string, CodexCard>> | null = null;

/**
 * The Korean card list by upper-case id, loaded once per session. A failed
 * load is dropped so the next call (a retry) fetches it again.
 */
function loadCatalog(): Promise<Map<string, CodexCard>> {
  if (catalogPromise) return catalogPromise;
  const promise = loadCompendiumData("kor", COVER_CARD_KEYS).then(({ cards }) => {
    const map = new Map<string, CodexCard>();
    for (const card of cards) {
      map.set(card.id.toUpperCase(), card);
    }
    return map;
  });
  catalogPromise = promise;
  promise.catch(() => {
    if (catalogPromise === promise) catalogPromise = null;
  });
  return promise;
}

/**
 * Card data for run cover card slots. Empty until the card list arrives; a
 * cover without it shows each card slot's element image. If the load fails,
 * a Compendium data retry (a failure notice's button, or the page coming back
 * online or into view while a notice is shown) loads it again.
 */
export function useCoverCardCatalog(): Map<string, CodexCard> {
  const [map, setMap] = useState<Map<string, CodexCard>>(() => new Map());
  const [attempt, setAttempt] = useState(0);
  const [failedAttempt, setFailedAttempt] = useState<number | null>(null);
  const failed = failedAttempt === attempt;
  useRetryWhenRequested(failed, setAttempt);

  useEffect(() => {
    if (failed) return;
    let cancelled = false;
    loadCatalog().then(
      (next) => {
        if (!cancelled) setMap(next);
      },
      () => {
        if (!cancelled) setFailedAttempt(attempt);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt, failed]);

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
