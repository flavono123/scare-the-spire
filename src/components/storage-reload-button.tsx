"use client";

import { useServiceLocale } from "@/hooks/use-service-locale";
import type { ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

/** Reloads the page rather than re-querying: the user asked for a real refresh. */
export function StorageReloadButton({
  compact = false,
  serviceLocale,
}: {
  compact?: boolean;
  /** For pages outside the Next router, where the path cannot tell the locale. */
  serviceLocale?: ServiceLocale;
}) {
  const pathLocale = useServiceLocale();
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className={cn(
        "rounded-md border border-primary/30 bg-primary/10 text-xs font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-primary/15 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70",
        compact ? "px-2.5 py-1" : "px-3 py-1.5",
      )}
    >
      {serviceMessages[serviceLocale ?? pathLocale].comments.reloadPage}
    </button>
  );
}
