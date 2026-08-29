"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  buildHistoryHoverGameUi,
  localizeHistoryCatalog,
  type HistoryLocalizedCatalog,
} from "@/lib/history-catalog-locale";
import {
  getHistoryLocTablesSync,
  loadHistoryLocTables,
  type HistoryLocTables,
} from "@/lib/history-loc-tables";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";

type HistoryCatalogLocaleValue = {
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  catalog: HistoryLocalizedCatalog;
  locTables: HistoryLocTables | null;
  gameUi: CodexGameUiLabels | undefined;
};

const HistoryCatalogLocaleContext = createContext<HistoryCatalogLocaleValue | null>(null);

export function HistoryCatalogLocaleProvider({
  bundled,
  children,
}: {
  bundled: HistoryLocalizedCatalog;
  children: ReactNode;
}) {
  const gameLocale = useGameLocale();
  const serviceLocale = useServiceLocale();
  const [loadedTables, setLoadedTables] = useState<{
    locale: GameLocale;
    tables: HistoryLocTables;
  } | null>(null);

  useEffect(() => {
    if (gameLocale === "kor") return;
    if (getHistoryLocTablesSync(gameLocale)) return;
    let cancelled = false;
    void loadHistoryLocTables(gameLocale).then((next) => {
      if (!cancelled && next) setLoadedTables({ locale: gameLocale, tables: next });
    });
    return () => {
      cancelled = true;
    };
  }, [gameLocale]);

  const tables = gameLocale === "kor"
    ? null
    : getHistoryLocTablesSync(gameLocale)
      ?? (loadedTables?.locale === gameLocale ? loadedTables.tables : null)
      ?? getHistoryLocTablesSync("eng");

  const value = useMemo<HistoryCatalogLocaleValue>(() => {
    const locTables = gameLocale === "kor" ? null : tables;
    const catalog = locTables ? localizeHistoryCatalog(bundled, locTables) : bundled;
    return {
      gameLocale,
      serviceLocale,
      catalog,
      locTables,
      gameUi: locTables ? buildHistoryHoverGameUi(locTables) : undefined,
    };
  }, [bundled, gameLocale, serviceLocale, tables]);

  return (
    <HistoryCatalogLocaleContext.Provider value={value}>
      {children}
    </HistoryCatalogLocaleContext.Provider>
  );
}

export function useHistoryCatalogLocale(): HistoryCatalogLocaleValue {
  const value = useContext(HistoryCatalogLocaleContext);
  if (!value) {
    throw new Error("useHistoryCatalogLocale must be used within HistoryCatalogLocaleProvider");
  }
  return value;
}

export function useOptionalHistoryCatalogLocale(): HistoryCatalogLocaleValue | null {
  return useContext(HistoryCatalogLocaleContext);
}
