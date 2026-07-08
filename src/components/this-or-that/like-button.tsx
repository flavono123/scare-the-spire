"use client";

import Image from "@/components/ui/static-image";
import { EngagementSpinner, EngagementUnavailableIcon } from "@/components/engagement-spinner";
import { cn } from "@/lib/utils";

export function ThisOrThatLikeButton({
  count,
  liked,
  loading,
  unavailable,
  disabled,
  onToggle,
  label,
  className,
}: {
  count: number;
  liked: boolean;
  loading: boolean;
  unavailable: boolean;
  disabled: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  const blocked = unavailable || disabled;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={blocked || loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors",
        "hover:bg-white/5 hover:text-yellow-300 disabled:cursor-not-allowed disabled:opacity-50",
        liked && "text-yellow-300",
        className,
      )}
      title={label}
      aria-pressed={liked}
    >
      {unavailable ? (
        <EngagementUnavailableIcon size={16} />
      ) : loading ? (
        <EngagementSpinner size={16} />
      ) : (
        <Image
          src="/images/relics/runic-dodecahedron.webp"
          alt=""
          width={16}
          height={16}
          className={cn("h-4 w-4 object-contain transition-all", !liked && "opacity-45 grayscale")}
        />
      )}
      <span>{count}</span>
    </button>
  );
}
