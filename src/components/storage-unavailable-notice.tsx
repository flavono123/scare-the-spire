import Image from "@/components/ui/static-image";
import { cn } from "@/lib/utils";

export function StorageUnavailableNotice({
  title,
  message,
  compact = false,
  className,
}: {
  title: string;
  message: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-amber-400/20 bg-amber-950/15 text-amber-100",
        compact ? "px-3 py-2" : "px-4 py-3",
        className,
      )}
    >
      <Image
        src="/images/sts2/powers/battleworn_dummy_time_limit_power.webp"
        alt=""
        width={compact ? 28 : 40}
        height={compact ? 28 : 40}
        aria-hidden
        className="shrink-0 object-contain opacity-90"
      />
      <div className="min-w-0">
        <p className={cn("font-semibold text-amber-200", compact ? "text-xs" : "text-sm")}>
          {title}
        </p>
        <p className={cn("leading-5 text-amber-100/70", compact ? "text-[11px]" : "text-xs")}>
          {message}
        </p>
      </div>
    </div>
  );
}
