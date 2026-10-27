"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getLegacyCompendiumDetailRedirectPath } from "@/lib/compendium-resource-links";

// Static patch pages have no in-app Compendium modal router, so their entity
// mentions link straight to the detail pages that crawlers can index.
const CompendiumDetailLinksContext = createContext(false);

export function CompendiumDetailLinksProvider({ children }: { children: ReactNode }) {
  return (
    <CompendiumDetailLinksContext.Provider value>
      {children}
    </CompendiumDetailLinksContext.Provider>
  );
}

/** Rewrites a Compendium modal URL to its detail page where one is published. */
export function toCompendiumDetailHref(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  return getLegacyCompendiumDetailRedirectPath(new URL(href, "https://compendium.invalid")) ?? href;
}

export function useCompendiumDetailLinks(): boolean {
  return useContext(CompendiumDetailLinksContext);
}

/** Returns the href to render: the detail page inside CompendiumDetailLinksProvider. */
export function useCompendiumLinkHref(href: string): string {
  return useCompendiumDetailLinks() ? toCompendiumDetailHref(href) : href;
}
