import type { ReactNode } from "react";
import Image from "@/components/ui/static-image";
import { cn } from "@/lib/utils";

const TICKBOX_FILL_SRC = "/images/game-assets/card-library/cost_tickbox.webp";
const TICKBOX_OUTLINE_SRC = "/images/game-assets/card-library/cost_tickbox_outline.webp";

const SIZE_STYLES = {
  sm: {
    root: "gap-1.5 px-1 py-0.5",
    icon: "h-6 w-6",
    mark: "left-[25%] top-[7%] h-[60%] w-[36%] border-b-[4px] border-r-[4px]",
    label: "text-sm leading-[1.05]",
  },
  md: {
    root: "gap-2 px-1 py-1",
    icon: "h-8 w-8",
    mark: "left-[25%] top-[7%] h-[60%] w-[36%] border-b-[5px] border-r-[5px]",
    label: "text-[20px] leading-[1.05]",
  },
  lg: {
    root: "gap-2.5 px-1 py-1",
    icon: "h-10 w-10",
    mark: "left-[25%] top-[7%] h-[60%] w-[36%] border-b-[6px] border-r-[6px]",
    label: "text-[25px] leading-[1.02]",
  },
} as const;

type GameCheckboxSize = keyof typeof SIZE_STYLES;

export function GameCheckboxToggle({
  checked,
  onCheckedChange,
  label,
  size = "sm",
  align = "center",
  disabled = false,
  className,
  labelClassName,
  title,
}: {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label: ReactNode;
  size?: GameCheckboxSize;
  align?: "center" | "start";
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  title?: string;
}) {
  const styles = SIZE_STYLES[size];
  const labelText = typeof label === "string" ? label : undefined;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={labelText}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      title={title ?? labelText}
      className={cn(
        "group flex max-w-full select-none rounded-sm bg-transparent text-left transition-[filter,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70 disabled:pointer-events-none disabled:opacity-45",
        align === "start" ? "items-start" : "items-center",
        styles.root,
        checked
          ? "brightness-110"
          : "opacity-80 hover:opacity-100",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative shrink-0 transition-transform group-hover:scale-105",
          align === "start" && "mt-0.5",
          styles.icon,
        )}
      >
        <Image
          src={TICKBOX_FILL_SRC}
          alt=""
          width={72}
          height={72}
          className={cn(
            "absolute inset-[14%] h-[72%] w-[72%] object-contain opacity-70",
            "[filter:brightness(0)_saturate(100%)_invert(22%)_sepia(14%)_saturate(1161%)_hue-rotate(139deg)_brightness(83%)_contrast(83%)]",
            checked && "opacity-85",
          )}
        />
        <Image
          src={TICKBOX_OUTLINE_SRC}
          alt=""
          width={72}
          height={72}
          className="absolute inset-0 h-full w-full object-contain [filter:sepia(0.22)_saturate(1.25)_brightness(1.1)_drop-shadow(2px_2px_0_rgba(0,0,0,0.75))]"
        />
        {checked && (
          <span
            className={cn(
              "absolute rotate-45 rounded-[2px] border-[#efc65a] [filter:drop-shadow(2px_2px_0_rgba(0,0,0,0.78))]",
              styles.mark,
            )}
          />
        )}
      </span>
      <span
        className={cn(
          "min-w-0 font-game-title font-bold tracking-[0] text-[#f1c94f] transition-colors [text-shadow:2px_2px_0_rgba(0,0,0,0.82)] group-hover:text-[#ffe27a]",
          styles.label,
          labelClassName,
        )}
      >
        {label}
      </span>
    </button>
  );
}
