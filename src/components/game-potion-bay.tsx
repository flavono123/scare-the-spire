import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";

/** Top bar potion bay: the character backdrop nine-slice behind the potion slots. */
export function PotionBay({
  label,
  className = "",
  style,
  children,
}: {
  label: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span
      data-potion-bay
      className={`relative inline-flex items-center gap-1 px-1 ${className}`}
      style={{
        // nine-slice keeps the chamfer corners at 8px so the slot bay matches
        // the height of HP/gold/floor chips instead of doubling them.
        borderImage: "url(/images/sts2/ui/topbar/top_bar_char_backdrop.png) 28 fill / 8px / 0 stretch",
        borderStyle: "solid",
        borderWidth: "8px",
        ...style,
      }}
      aria-label={label}
    >
      {children}
    </span>
  );
}

/** One potion slot: the empty slot outline with the potion drawn over it. */
export function PotionSlot({
  index,
  potionSrc,
  potionAlt = "",
  potionClassName = "",
}: {
  index: number;
  potionSrc?: string | null;
  potionAlt?: string;
  potionClassName?: string;
}) {
  return (
    <span className="relative inline-block h-6 w-5" data-potion-slot-index={index}>
      <Image
        src="/images/sts2/ui/topbar/potion_placeholder.png"
        alt=""
        fill
        sizes="20px"
        className="object-contain opacity-90"
        unoptimized
      />
      {potionSrc && (
        <Image
          src={potionSrc}
          alt={potionAlt}
          fill
          sizes="20px"
          className={`object-contain drop-shadow-[0_0_6px_rgba(103,232,249,0.75)] ${potionClassName}`}
          unoptimized
        />
      )}
    </span>
  );
}
