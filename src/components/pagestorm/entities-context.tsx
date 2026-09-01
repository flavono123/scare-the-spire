"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { buildEntityMap } from "@/components/chemicalx/post-renderer";

const PagestormEntitiesContext = createContext<EntityInfo[]>([]);
const PagestormChromeContext = createContext<"edit" | "preview">("edit");

export function PagestormEntitiesProvider({
  entities,
  mode = "edit",
  children,
}: {
  entities: EntityInfo[];
  mode?: "edit" | "preview";
  children: ReactNode;
}) {
  return (
    <PagestormChromeContext.Provider value={mode}>
      <PagestormEntitiesContext.Provider value={entities}>
        {children}
      </PagestormEntitiesContext.Provider>
    </PagestormChromeContext.Provider>
  );
}

export function usePagestormChrome(): "edit" | "preview" {
  return useContext(PagestormChromeContext);
}

export function usePagestormEntities(): EntityInfo[] {
  return useContext(PagestormEntitiesContext);
}

export function usePagestormEntityMap(): Map<string, EntityInfo> {
  const entities = usePagestormEntities();
  return useMemo(() => buildEntityMap(entities), [entities]);
}

export function findPagestormEntity(
  entities: readonly EntityInfo[],
  type: string | null | undefined,
  id: string,
): EntityInfo | undefined {
  const needle = id.toLowerCase();
  if (type) {
    const exact = entities.find(
      (entity) => entity.type === type && entity.id.toLowerCase() === needle,
    );
    if (exact) return exact;
  }
  return entities.find((entity) => entity.id.toLowerCase() === needle);
}
