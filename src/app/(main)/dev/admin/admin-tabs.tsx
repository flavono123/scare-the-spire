"use client";

import { useState, type ReactNode } from "react";

export const ADMIN_TAB_IDS = [
  "contact",
  "metrics",
  "authors",
  "comments",
  "posts",
  "nicks",
] as const;

export type AdminTabId = (typeof ADMIN_TAB_IDS)[number];

export function isAdminTabId(value: unknown): value is AdminTabId {
  return typeof value === "string" && (ADMIN_TAB_IDS as readonly string[]).includes(value);
}

type AdminTabsProps = {
  tabs: readonly { id: AdminTabId; label: string }[];
  panels: Record<AdminTabId, ReactNode>;
  initialTab: AdminTabId;
};

/**
 * Splits the long admin page into feature tabs. Panels are server-rendered and
 * all stay mounted (hidden) so forms and charts keep their state when switching.
 * The active tab is mirrored to `?tab=` so reloads and filter links keep it.
 */
export function AdminTabs({ tabs, panels, initialTab }: AdminTabsProps) {
  const [active, setActive] = useState<AdminTabId>(initialTab);

  function select(id: AdminTabId) {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    url.hash = "";
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="어드민 기능"
        className="sticky top-12 z-20 -mx-4 mb-2 flex gap-1 overflow-x-auto border-b border-border bg-background/90 px-4 backdrop-blur-sm"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`admin-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`admin-panel-${tab.id}`}
              onClick={() => select(tab.id)}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`admin-panel-${tab.id}`}
          aria-labelledby={`admin-tab-${tab.id}`}
          hidden={tab.id !== active}
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  );
}
