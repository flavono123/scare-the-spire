"use client";

import type { ComponentProps } from "react";
import { DominionDetail } from "./dominion-detail";
import { useCompendiumEntities } from "./use-compendium-data";
import type { GameLocale } from "@/lib/i18n";

type DominionDetailLoaderProps = Omit<ComponentProps<typeof DominionDetail>, "entities"> & {
  gameLocale: GameLocale;
};

/** Renders DominionDetail from its server props and fills in the rest once the data chunks load. */
export function DominionDetailLoader({ gameLocale, ...props }: DominionDetailLoaderProps) {
  const entities = useCompendiumEntities(gameLocale);
  return (
    <DominionDetail
      {...props}
      entities={entities}
    />
  );
}
