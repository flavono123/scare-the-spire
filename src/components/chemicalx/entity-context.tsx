"use client";

import { createContext, useContext } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";

const EntityMapContext = createContext<Map<string, EntityInfo>>(new Map());

export const EntityMapProvider = EntityMapContext.Provider;

export function useEntityMap() {
  return useContext(EntityMapContext);
}
