"use client";

import type { ReactNode } from "react";
import {
  retryFailedCompendiumData,
  useRetryFailedCompendiumDataOnReturn,
  type CompendiumLazyDataStatus,
} from "@/components/codex/use-compendium-data";
import { EngagementSpinner } from "@/components/engagement-spinner";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import type { ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

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

/**
 * Shown in place of a feed or an editor whose entity graph failed to load, so
 * nothing renders with unresolved game elements. Retries on the button, and
 * when the browser reconnects or the tab is shown again.
 */
export function EntityGraphUnavailableNotice({
  serviceLocale,
  compact = false,
}: {
  serviceLocale: ServiceLocale;
  compact?: boolean;
}) {
  useRetryFailedCompendiumDataOnReturn();
  return (
    <div role="alert" data-entity-graph-failed>
      <StorageUnavailableNotice
        compact={compact}
        title={serviceMessages[serviceLocale].entityGraph.unavailable}
      >
        <CompendiumDataRetryButton serviceLocale={serviceLocale} compact={compact} />
      </StorageUnavailableNotice>
    </div>
  );
}

/**
 * Holds an editor until the full entity graph has loaded, so its mention
 * suggestions and previews never work from a partial list.
 */
export function EntityGraphGate({
  status,
  serviceLocale,
  children,
}: {
  status: CompendiumLazyDataStatus;
  serviceLocale: ServiceLocale;
  children: ReactNode;
}) {
  if (status === "loaded") return <>{children}</>;
  if (status === "failed") return <EntityGraphUnavailableNotice compact serviceLocale={serviceLocale} />;
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border border-border bg-card/30 px-3 py-2 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
      data-entity-graph-loading
    >
      <EngagementSpinner size={14} />
      <span>{serviceMessages[serviceLocale].comments.loading}</span>
    </div>
  );
}
