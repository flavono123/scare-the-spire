"use client";

import { createContext, useContext } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";

const EntityMapContext = createContext<Map<string, EntityInfo>>(new Map());

export const EntityMapProvider = EntityMapContext.Provider;

export function useEntityMap() {
  return useContext(EntityMapContext);
}

/** Editor surfaces that must not navigate away (e.g. the transfigure sheet) turn this off. */
const EntityLinksContext = createContext(true);

export const EntityLinksProvider = EntityLinksContext.Provider;

export function useEntityLinks() {
  return useContext(EntityLinksContext);
}
