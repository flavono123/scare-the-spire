"use client";

import { useEffect, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { GameLocale } from "@/lib/i18n";

type EntityLoadState = {
  gameLocale: GameLocale;
  entities: EntityInfo[];
  loading: boolean;
  error: Error | null;
};

const entityPromises = new Map<GameLocale, Promise<EntityInfo[]>>();

function loadThisOrThatStaticEntities(gameLocale: GameLocale): Promise<EntityInfo[]> {
  const cached = entityPromises.get(gameLocale);
  if (cached) return cached;

  const promise = fetch(`/generated/this-or-that-resources-${gameLocale}.json`, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load this-or-that resources: ${response.status}`);
      }
      return response.json() as Promise<EntityInfo[]>;
    });

  entityPromises.set(gameLocale, promise);
  return promise;
}

export function useThisOrThatEntities(gameLocale: GameLocale): EntityLoadState {
  const [state, setState] = useState<EntityLoadState>({
    gameLocale,
    entities: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let disposed = false;

    void loadThisOrThatStaticEntities(gameLocale)
      .then((entities) => {
        if (disposed) return;
        setState({ gameLocale, entities, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (disposed) return;
        const nextError = error instanceof Error ? error : new Error(String(error));
        console.warn(nextError.message, nextError);
        setState({ gameLocale, entities: [], loading: false, error: nextError });
      });

    return () => {
      disposed = true;
    };
  }, [gameLocale]);

  if (state.gameLocale !== gameLocale) {
    return {
      gameLocale,
      entities: state.entities,
      loading: true,
      error: null,
    };
  }

  return state;
}
