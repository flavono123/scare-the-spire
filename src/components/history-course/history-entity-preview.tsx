"use client";

import type { ComponentProps } from "react";
import { EntityPreview } from "@/components/patch-note-renderer";
import { useOptionalHistoryCatalogLocale } from "@/hooks/use-history-catalog-locale";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";

export function HistoryEntityPreview(
  props: Omit<ComponentProps<typeof EntityPreview>, "gameLocale" | "serviceLocale" | "gameUi">,
) {
  const catalogLocale = useOptionalHistoryCatalogLocale();
  const gameLocale = useGameLocale();
  const serviceLocale = useServiceLocale();
  return (
    <EntityPreview
      {...props}
      gameLocale={catalogLocale?.gameLocale ?? gameLocale}
      serviceLocale={catalogLocale?.serviceLocale ?? serviceLocale}
      gameUi={catalogLocale?.gameUi}
    />
  );
}
