"use client";

import { useEffect, useState } from "react";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import {
  formatAbsoluteDate,
  formatTimeAgo,
  type RelativeTimeCopy,
} from "@/lib/relative-time";
import { cn } from "@/lib/utils";

/**
 * Chemical X index/detail date pair: relative (`formatTimeAgo`) plus
 * absolute (`toLocaleDateString`). The quieter value lives in the hover tip
 * so dense boards do not stack two timestamps.
 */
export function PostCreatedAt({
  createdAt,
  copy,
  dateLocale,
  primary = "relative",
  className,
}: {
  createdAt: string;
  copy: RelativeTimeCopy;
  dateLocale: string;
  primary?: "relative" | "absolute";
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);

  const absolute = formatAbsoluteDate(createdAt, dateLocale);
  const relative = now == null
    ? absolute
    : formatTimeAgo(createdAt, copy, dateLocale, now);
  const visible = primary === "absolute" ? absolute : relative;
  const tip = primary === "absolute" ? relative : absolute;

  return (
    <GameUiHoverTip label={tip === visible ? visible : tip} className="block min-w-0 max-w-full">
      <time
        dateTime={createdAt}
        suppressHydrationWarning
        className={cn("tabular-nums", className)}
      >
        {visible}
      </time>
    </GameUiHoverTip>
  );
}
