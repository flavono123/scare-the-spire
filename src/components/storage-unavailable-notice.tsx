import Image from "@/components/ui/static-image";
import { cn } from "@/lib/utils";

export function StorageUnavailableNotice({
  title,
  compact = false,
  className,
}: {
  title: string;
  compact?: boolean;
  className?: string;
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
    </div>
  );
}
