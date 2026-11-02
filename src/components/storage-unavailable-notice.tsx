import type { ReactNode } from "react";
import { StorageReloadButton } from "@/components/storage-reload-button";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function StorageUnavailableNotice({
  title,
  compact = false,
  className,
  children,
  reload = true,
  serviceLocale,
}: {
  title: string;
  compact?: boolean;
  className?: string;
  /** An action under the title, such as a retry button. Replaces the reload button. */
  children?: ReactNode;
  /** Off inside a form, where reloading would throw away what is being written. */
  reload?: boolean;
  serviceLocale?: ServiceLocale;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 py-3" : "gap-3 py-12",
        className,
      )}
    >
      <Image
        src="/images/sts2/powers/battleworn_dummy_time_limit_power.webp"
        alt=""
        width={compact ? 32 : 48}
        height={compact ? 32 : 48}
        aria-hidden
        className="object-contain opacity-90"
      />
      <span className={cn("font-semibold text-amber-300", compact ? "text-xs" : "text-sm")}>
        {title}
      </span>
      {children ?? (reload ? <StorageReloadButton compact={compact} serviceLocale={serviceLocale} /> : null)}
    </div>
  );
}
