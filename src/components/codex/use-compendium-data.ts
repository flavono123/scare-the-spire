"use client";

import { useEffect, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { buildAllEntities } from "@/lib/all-entities";
import {
  ALL_ENTITY_DATA_KEYS,
  loadCompendiumData,
  type CompendiumDataKey,
  type CompendiumDataResources,
} from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

/**
 * Loads Compendium resources that a page does not need for its first render
 * (detail modals, hover tips, version history). Returns null until every key
 * has arrived, so pages render their server markup first. `keys` must be a
 * stable (module-level) array.
 */
export function useCompendiumData<K extends CompendiumDataKey>(
  gameLocale: GameLocale,
  keys: readonly K[],
): Pick<CompendiumDataResources, K> | null {
  const [loaded, setLoaded] = useState<{
    gameLocale: GameLocale;
    keys: readonly K[];
    data: Pick<CompendiumDataResources, K>;
  } | null>(null);

  useEffect(() => {
    let active = true;
    loadCompendiumData(gameLocale, keys)
      .then((data) => {
        if (active) setLoaded({ gameLocale, keys, data });
      })
      .catch((error: unknown) => {
        console.error(error);
      });
    return () => {
      active = false;
    };
  }, [gameLocale, keys]);

  return loaded && loaded.gameLocale === gameLocale && loaded.keys === keys ? loaded.data : null;
}

const entityPromises = new Map<GameLocale, Promise<EntityInfo[]>>();

function loadEntities(gameLocale: GameLocale): Promise<EntityInfo[]> {
  let promise = entityPromises.get(gameLocale);
  if (!promise) {
    promise = loadCompendiumData(gameLocale, ALL_ENTITY_DATA_KEYS).then(buildAllEntities);
    promise.catch(() => entityPromises.delete(gameLocale));
    entityPromises.set(gameLocale, promise);
  }
  return promise;
}

/** Hover/link entities for rich text, built on the client from the data chunks. */
export function useCompendiumEntities(gameLocale: GameLocale): EntityInfo[] | undefined {
  const [loaded, setLoaded] = useState<{ gameLocale: GameLocale; entities: EntityInfo[] } | null>(null);

  useEffect(() => {
    let active = true;
    loadEntities(gameLocale)
      .then((entities) => {
        if (active) setLoaded({ gameLocale, entities });
      })
      .catch((error: unknown) => {
        console.error(error);
      });
    return () => {
      active = false;
    };
  }, [gameLocale]);

  return loaded?.gameLocale === gameLocale ? loaded.entities : undefined;
}
