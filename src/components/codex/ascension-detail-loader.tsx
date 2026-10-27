"use client";

import type { ComponentProps } from "react";
import { AscensionDetail } from "./ascension-detail";
import { useCompendiumEntities } from "./use-compendium-data";
import type { GameLocale } from "@/lib/i18n";

type AscensionDetailLoaderProps = Omit<ComponentProps<typeof AscensionDetail>, "entities"> & {
  gameLocale: GameLocale;
};

/** Renders AscensionDetail from its server props and fills in the rest once the data chunks load. */
export function AscensionDetailLoader({ gameLocale, ...props }: AscensionDetailLoaderProps) {
  const entities = useCompendiumEntities(gameLocale);
  return (
    <AscensionDetail
      {...props}
      entities={entities}
    />
  );
}
