"use client";

import type { ReactNode } from "react";
import type { CompendiumLazyDataStatus } from "@/components/codex/use-compendium-data";
import { EngagementSpinner } from "@/components/engagement-spinner";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

/**
 * Holds an editor until the full entity graph has loaded, so its mention
 * suggestions and previews never work from a partial list.
 */
export function EntityGraphGate({
  status,
  serviceLocale,
  unavailableTitle,
  children,
}: {
  status: CompendiumLazyDataStatus;
  serviceLocale: ServiceLocale;
  unavailableTitle: string;
  children: ReactNode;
}) {
  if (status === "loaded") return <>{children}</>;
  if (status === "failed") return <StorageUnavailableNotice compact title={unavailableTitle} />;
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
