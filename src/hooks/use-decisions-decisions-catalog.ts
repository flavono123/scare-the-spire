"use client";

import { useEffect, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useThisOrThatEntities } from "@/hooks/use-this-or-that-entities";
import {
  stampAllPresetIds,
  type DecisionsDecisionsResourceRef,
} from "@/lib/decisions-decisions";
import type { GameLocale } from "@/lib/i18n";
import { STS2_IMAGE_CACHE_BUSTER } from "@/lib/sts2-image-cache";

type PresetPayload = {
  gameVersion?: string;
  presets?: Record<string, DecisionsDecisionsResourceRef[]>;
};

const presetPromise = fetch(
  `/generated/decisions-decisions-presets.json?v=${STS2_IMAGE_CACHE_BUSTER}`,
  { cache: "no-cache" },
)
  .then((response) => {
    if (!response.ok) return null;
    return response.json() as Promise<PresetPayload>;
  })
  .catch(() => null);

const legacyPromises = new Map<GameLocale, Promise<EntityInfo[]>>();

function loadLegacyCards(gameLocale: GameLocale): Promise<EntityInfo[]> {
  const cached = legacyPromises.get(gameLocale);
  if (cached) return cached;
  const promise = fetch(
    `/generated/decisions-decisions-legacy-cards-${gameLocale}.json?v=${STS2_IMAGE_CACHE_BUSTER}`,
    { cache: "no-cache" },
  )
    .then((response) => (response.ok ? response.json() as Promise<EntityInfo[]> : []))
    .catch(() => [] as EntityInfo[]);
  legacyPromises.set(gameLocale, promise);
  return promise;
}

export function useDecisionsDecisionsCatalog(
  gameLocale: GameLocale,
  options?: { includeStamps?: boolean; includeLegacy?: boolean },
) {
  const resources = useThisOrThatEntities(gameLocale);
  const [stamps, setStamps] = useState<Record<string, DecisionsDecisionsResourceRef[]>>({});
  const includeStamps = options?.includeStamps !== false;
  const includeLegacy = options?.includeLegacy === true;
  const [legacyCards, setLegacyCards] = useState<EntityInfo[]>([]);

  useEffect(() => {
    if (!includeLegacy) return;
    let disposed = false;
    void loadLegacyCards(gameLocale).then((cards) => {
      if (!disposed) setLegacyCards(cards);
    });
    return () => {
      disposed = true;
    };
  }, [gameLocale, includeLegacy]);

  useEffect(() => {
    if (!includeStamps) return;
    let disposed = false;
    void presetPromise.then((payload) => {
      if (disposed) return;
      if (resources.entities.length > 0) {
        setStamps(stampAllPresetIds(resources.entities));
        return;
      }
      if (payload?.presets) setStamps(payload.presets);
    });
    return () => {
      disposed = true;
    };
  }, [includeStamps, resources.entities]);

  // Stamps/presets use `resources.entities` only; legacy cards are lookup + picker extras.
  const entities = includeLegacy && legacyCards.length > 0
    ? [...resources.entities, ...legacyCards]
    : resources.entities;
  const entityMap = new Map<string, EntityInfo>();
  for (const entity of entities) {
    entityMap.set(`${entity.type}:${entity.id}`, entity);
  }

  return {
    entities,
    entityMap,
    stamps,
    loading: resources.loading,
    error: resources.error,
  };
}
