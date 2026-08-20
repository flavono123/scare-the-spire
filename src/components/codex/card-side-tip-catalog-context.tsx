"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CardSideTipCatalog } from "@/lib/card-keyword-tips";

const CardSideTipCatalogContext = createContext<CardSideTipCatalog | null>(null);

export function CardSideTipCatalogProvider({
  catalog,
  children,
}: {
  catalog: CardSideTipCatalog | null;
  children: ReactNode;
}) {
  return (
    <CardSideTipCatalogContext.Provider value={catalog}>
      {children}
    </CardSideTipCatalogContext.Provider>
  );
}

export function useCardSideTipCatalog(): CardSideTipCatalog | null {
  return useContext(CardSideTipCatalogContext);
}
