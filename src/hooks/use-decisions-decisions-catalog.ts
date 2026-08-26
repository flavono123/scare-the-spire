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

export function useDecisionsDecisionsCatalog(gameLocale: GameLocale) {
  const resources = useThisOrThatEntities(gameLocale);
  const [stamps, setStamps] = useState<Record<string, DecisionsDecisionsResourceRef[]>>({});

  useEffect(() => {
    let disposed = false;
    void presetPromise.then((payload) => {
      if (disposed) return;
      if (payload?.presets) {
        setStamps(payload.presets);
        return;
      }
      if (resources.entities.length > 0) {
        setStamps(stampAllPresetIds(resources.entities));
      }
    });
    return () => {
      disposed = true;
    };
  }, [resources.entities]);

  const entityMap = new Map<string, EntityInfo>();
  for (const entity of resources.entities) {
    entityMap.set(`${entity.type}:${entity.id}`, entity);
  }

  return {
    entities: resources.entities,
    entityMap,
    stamps,
    loading: resources.loading,
    error: resources.error,
  };
}
