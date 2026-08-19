"use client";

import { useEffect, useState } from "react";
import { useGameLocale } from "@/hooks/use-game-locale";
import {
  getGameI18nTablesSync,
  loadGameI18nTables,
  type GameI18nTables,
} from "@/lib/sts2-game-i18n";

export function useGameI18n(): GameI18nTables {
  const locale = useGameLocale();
  const [tables, setTables] = useState(() => getGameI18nTablesSync(locale));

  useEffect(() => {
    let cancelled = false;
    void loadGameI18nTables(locale).then((next) => {
      if (!cancelled) setTables(next);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return tables;
}
