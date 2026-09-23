"use client";

import { useEffect, useState } from "react";
import {
  cardConLocalePath,
  type CardConLocaleTable,
} from "@/lib/card-con-locale";
import type { GameLocale } from "@/lib/i18n";

const cache = new Map<GameLocale, Promise<CardConLocaleTable>>();

function loadCardConLocale(gameLocale: GameLocale): Promise<CardConLocaleTable> {
  const cached = cache.get(gameLocale);
  if (cached) return cached;

  const pending = fetch(cardConLocalePath(gameLocale))
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load card locale ${gameLocale}: ${response.status}`);
      }
      return response.json() as Promise<CardConLocaleTable>;
    })
    .catch((error: unknown) => {
      cache.delete(gameLocale);
      throw error;
    });

  cache.set(gameLocale, pending);
  return pending;
}

/** Korean cards are already on the comment entity. Other game locales overlay text. */
export function useCardConLocale(gameLocale: GameLocale): CardConLocaleTable | null {
  const [table, setTable] = useState<CardConLocaleTable | null>(
    () => (gameLocale === "kor" ? {} : null),
  );

  useEffect(() => {
    if (gameLocale === "kor") {
      setTable({});
      return;
    }

    let cancelled = false;
    setTable(null);
    void loadCardConLocale(gameLocale)
      .then((next) => {
        if (!cancelled) setTable(next);
      })
      .catch(() => {
        if (!cancelled) setTable(null);
      });

    return () => {
      cancelled = true;
    };
  }, [gameLocale]);

  return table;
}
