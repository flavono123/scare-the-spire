"use client";

import { type Dispatch, type SetStateAction, useEffect } from "react";
import type { ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

// Kept apart from use-compendium-data so failure notices can retry without
// pulling the chunk loader and the entity graph builder into their bundles.

/** One callback per mounted hook whose load failed. */
const failedLoadRetries = new Set<() => void>();

/**
 * Starts again every Compendium data load on the page that failed, for a
 * retry button or a page that comes back online. Loads that succeeded or are
 * still running are untouched.
 */
export function retryFailedCompendiumData(): void {
  for (const retry of Array.from(failedLoadRetries)) retry();
}

/** Lets retryFailedCompendiumData() start a new attempt while a hook's load has failed. */
export function useRetryWhenRequested(failed: boolean, setAttempt: Dispatch<SetStateAction<number>>): void {
  useEffect(() => {
    if (!failed) return;
    const retry = () => setAttempt((attempt) => attempt + 1);
    failedLoadRetries.add(retry);
    return () => {
      failedLoadRetries.delete(retry);
    };
  }, [failed, setAttempt]);
}

/**
 * While a failure notice is shown, retry the failed loads when the browser
 * reconnects or the tab becomes visible again.
 */
export function useRetryFailedCompendiumDataOnReturn(): void {
  useEffect(() => {
    // Per-instance closures: addEventListener ignores a second registration of
    // the same function, so a shared listener would be removed for every
    // notice when any one of them unmounts.
    const onOnline = () => retryFailedCompendiumData();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") retryFailedCompendiumData();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}

/** Starts every failed Compendium data load on the page again. */
export function CompendiumDataRetryButton({
  serviceLocale,
  compact = false,
  className,
}: {
  serviceLocale: ServiceLocale;
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={retryFailedCompendiumData}
      className={cn(
        "rounded-md border border-primary/30 bg-primary/10 text-xs font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-primary/15 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70",
        compact ? "px-2.5 py-1" : "px-3 py-1.5",
        className,
      )}
      data-compendium-data-retry
    >
      {serviceMessages[serviceLocale].entityGraph.retry}
    </button>
  );
}
