"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CardSideTipCatalog } from "@/lib/card-keyword-tips";
import type { CodexEnchantment, CodexPotion } from "@/lib/codex-types";

const EMPTY_POTIONS = new Map<string, CodexPotion>();
const EMPTY_ENCHANTMENTS = new Map<string, CodexEnchantment>();

type CardSideTipCatalogContextValue = {
  catalog: CardSideTipCatalog | null;
  potionsById: ReadonlyMap<string, CodexPotion>;
  enchantmentsById: ReadonlyMap<string, CodexEnchantment>;
};

const DEFAULT_VALUE: CardSideTipCatalogContextValue = {
  catalog: null,
  potionsById: EMPTY_POTIONS,
  enchantmentsById: EMPTY_ENCHANTMENTS,
};

const CardSideTipCatalogContext = createContext<CardSideTipCatalogContextValue>(DEFAULT_VALUE);

export function CardSideTipCatalogProvider({
  catalog,
  potions,
  enchantments,
  children,
}: {
  catalog: CardSideTipCatalog | null;
  potions?: readonly CodexPotion[];
  enchantments?: readonly CodexEnchantment[];
  children: ReactNode;
}) {
  const value = useMemo<CardSideTipCatalogContextValue>(() => ({
    catalog,
    potionsById: potions?.length
      ? new Map(potions.map((potion) => [potion.id, potion]))
      : EMPTY_POTIONS,
    enchantmentsById: enchantments?.length
      ? new Map(enchantments.map((enchantment) => [enchantment.id, enchantment]))
      : EMPTY_ENCHANTMENTS,
  }), [catalog, potions, enchantments]);

  return (
    <CardSideTipCatalogContext.Provider value={value}>
      {children}
    </CardSideTipCatalogContext.Provider>
  );
}

export function useCardSideTipCatalog(): CardSideTipCatalog | null {
  return useContext(CardSideTipCatalogContext).catalog;
}

export function useCardSideTipResourceMaps(): {
  potionsById: ReadonlyMap<string, CodexPotion>;
  enchantmentsById: ReadonlyMap<string, CodexEnchantment>;
} {
  const { potionsById, enchantmentsById } = useContext(CardSideTipCatalogContext);
  return { potionsById, enchantmentsById };
}
