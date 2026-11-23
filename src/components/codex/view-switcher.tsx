"use client";

import { LayoutGrid, List } from "lucide-react";
import type { ServiceLocale } from "@/lib/i18n";
import { notifyCodexUrlChange, useHydrationSafeSearchParam } from "./use-hydration-safe-search-param";

/** The compendium top bar's segmented toggle (bestiary tabs, gallery/list). */
export function CompendiumViewSwitcher<T extends string>({
  options,
  active,
  onChange,
  ariaLabel,
}: {
  options: readonly { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-border bg-black/20 p-0.5" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={active === option.key}
          onClick={() => onChange(option.key)}
          className={`px-2 py-1 text-[11px] font-medium transition-colors sm:px-2.5 sm:text-xs ${
            active === option.key ? "rounded bg-primary/20 text-primary" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export type CompendiumLayout = "gallery" | "list";

/** Gallery or list, kept in `?layout=` so a shared link opens the same view; the index's own default stays off the URL. */
export function useCompendiumLayout(fallback: CompendiumLayout): [CompendiumLayout, (next: CompendiumLayout) => void] {
  const param = useHydrationSafeSearchParam("layout");
  const layout: CompendiumLayout = param === "gallery" || param === "list" ? param : fallback;
  const setLayout = (next: CompendiumLayout) => {
    const url = new URL(window.location.href);
    if (next === fallback) url.searchParams.delete("layout");
    else url.searchParams.set("layout", next);
    window.history.replaceState(window.history.state, "", url.toString());
    notifyCodexUrlChange();
  };
  return [layout, setLayout];
}

/** One button that flips gallery and list; its icon shows the view a click switches to. */
export function CompendiumLayoutSwitcher({
  layout,
  onChange,
  serviceLocale,
}: {
  layout: CompendiumLayout;
  onChange: (layout: CompendiumLayout) => void;
  serviceLocale: ServiceLocale;
}) {
  const ko = serviceLocale === "ko";
  const next: CompendiumLayout = layout === "gallery" ? "list" : "gallery";
  const label = next === "gallery" ? (ko ? "갤러리로 보기" : "Gallery view") : (ko ? "리스트로 보기" : "List view");
  const Icon = next === "gallery" ? LayoutGrid : List;
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={label}
      title={label}
      data-layout={layout}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-black/20 text-gray-300 transition-colors hover:border-primary/60 hover:text-primary"
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
