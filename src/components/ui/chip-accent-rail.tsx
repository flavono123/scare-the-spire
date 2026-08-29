import { cn } from "@/lib/utils";

/**
 * Leading color rail on a chip / tag / preset.
 *
 * Common design-system names: accent bar, color rail, identity stripe,
 * leading accent. Token name in this codebase: `chip-accent-rail`.
 *
 * Host the rail inside the chip and clip it with the chip's overflow +
 * border-radius so the mark follows the chip edge instead of sitting on
 * top of it.
 */
export const CHIP_ACCENT_RAIL_HOST_CLASS = "relative overflow-hidden";

export function ChipAccentRail({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-chip-accent-rail=""
      className={cn(
        "pointer-events-none absolute inset-y-0 left-0 z-0 w-[3px]",
        className,
      )}
      style={{ backgroundColor: color }}
    />
  );
}
