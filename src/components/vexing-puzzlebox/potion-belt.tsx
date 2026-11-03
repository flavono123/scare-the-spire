"use client";

import { useEffect, useRef, useState } from "react";
import { DescriptionText } from "@/components/codex/codex-description";
import { PortaledHoverTipLayer } from "@/components/codex/card-keyword-tip-stack";
import { HoverTip } from "@/components/codex/hover-tip";
import { PotionBay, PotionSlot } from "@/components/game-potion-bay";
import Image from "@/components/ui/static-image";

export type BeltPotion = {
  name: string;
  description: string;
  imageUrl: string;
};

/** potion_popup.tscn label colors: use is cream, discard is red. */
const USE_LABEL_COLOR = "#fff6e2";
const DISCARD_LABEL_COLOR = "#ff5555";

/**
 * The potion slots with the game's potion popup: click a potion to throw or discard it.
 * A thrown potion leaves from its slot, which `onThrow` gets to aim from.
 */
export function PotionBelt({
  label,
  potion,
  slots,
  throwLabel,
  discardLabel,
  disabled,
  onThrow,
  onDiscard,
}: {
  label: string;
  potion: BeltPotion;
  /** One entry per slot; true while it still holds the potion. */
  slots: boolean[];
  throwLabel: string;
  discardLabel: string;
  disabled?: boolean;
  onThrow: (slot: number, from: HTMLElement) => void;
  onDiscard: (slot: number) => void;
}) {
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const beltRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (openSlot === null) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && beltRef.current?.contains(event.target)) return;
      setOpenSlot(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenSlot(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [openSlot]);

  const open = openSlot !== null && slots[openSlot] && !disabled ? openSlot : null;

  return (
    <div ref={beltRef} className="relative inline-flex" data-potion-belt={slots.filter(Boolean).length}>
      <PotionBay label={label}>
        {slots.map((filled, index) => (
          <button
            key={index}
            ref={(element) => {
              slotRefs.current[index] = element;
            }}
            type="button"
            disabled={!filled || disabled}
            aria-label={filled ? potion.name : undefined}
            aria-expanded={open === index}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setHoveredSlot(index);
            }}
            onPointerLeave={() => setHoveredSlot(null)}
            onClick={() => setOpenSlot(open === index ? null : index)}
            className="relative block rounded-sm transition-transform duration-150 enabled:hover:scale-110 disabled:cursor-default"
          >
            <PotionSlot index={index} potionSrc={filled ? potion.imageUrl : null} potionAlt={potion.name} />
          </button>
        ))}
      </PotionBay>

      {hoveredSlot !== null && slots[hoveredSlot] && open === null && (
        <PortaledHoverTipLayer pin="top-left">
          <HoverTip title={potion.name} style={{ minWidth: 220, maxWidth: 260 }}>
            <DescriptionText description={potion.description} className="block text-left" />
          </HoverTip>
        </PortaledHoverTipLayer>
      )}

      {open !== null && (
        <div
          role="menu"
          data-potion-popup
          className="potion-popup absolute left-1/2 top-full z-40 mt-1 h-[7.5rem] w-[9rem] -translate-x-1/2"
        >
          <Image
            src="/images/sts2/ui/potion_popup.png"
            alt=""
            width={670}
            height={560}
            className="absolute inset-0 h-full w-full"
          />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const from = slotRefs.current[open];
              setOpenSlot(null);
              if (from) onThrow(open, from);
            }}
            className="group/use absolute inset-x-[2.5%] top-[1%] h-[55.5%]"
          >
            <Image
              src="/images/sts2/ui/potion_popup_top.png"
              alt=""
              width={634}
              height={311}
              className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-100 group-hover/use:opacity-[0.27] group-focus-visible/use:opacity-[0.27]"
            />
            <span
              className="relative block pt-3 font-game-title text-base font-bold"
              style={{ color: USE_LABEL_COLOR, WebkitTextStroke: "3px rgba(0,0,0,0.5)", paintOrder: "stroke fill" }}
            >
              {throwLabel}
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpenSlot(null);
              onDiscard(open);
            }}
            className="group/discard absolute inset-x-[2.5%] bottom-[2%] h-[40.7%]"
          >
            <Image
              src="/images/sts2/ui/potion_popup_bottom.png"
              alt=""
              width={633}
              height={228}
              className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-100 group-hover/discard:opacity-[0.27] group-focus-visible/discard:opacity-[0.27]"
            />
            <span
              className="relative block font-game-title text-base font-bold"
              style={{ color: DISCARD_LABEL_COLOR, WebkitTextStroke: "3px rgba(0,0,0,0.5)", paintOrder: "stroke fill" }}
            >
              {discardLabel}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
