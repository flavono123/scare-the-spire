"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import {
  PROFILE_PALETTE_PAIRS,
  profilePaletteById,
  profilePaletteDiagonalStyle,
} from "@/lib/profile-palettes";
import { cn } from "@/lib/utils";

export type ProfilePalettePickerCopy = {
  label: string;
  none: string;
  noneHint: string;
};

function palettePosition(anchor: DOMRect) {
  const width = 168;
  const height = 88;
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  let left = anchor.left;
  let top = anchor.bottom + 6;
  if (left < 8) left = 8;
  if (left + width > viewW - 8) left = Math.max(8, viewW - width - 8);
  if (top + height > viewH - 8) top = Math.max(8, anchor.top - height - 6);
  return { left, top };
}

function PaletteChipFill({
  colorA,
  colorB,
  swapped,
}: {
  colorA?: string;
  colorB?: string;
  swapped?: boolean;
}) {
  if (!colorA || !colorB) {
    return (
      <span
        aria-hidden
        data-profile-palette-fill=""
        className="block h-full w-full rounded-[3px] bg-zinc-700/85"
        style={{
          backgroundImage:
            "linear-gradient(to bottom left, transparent 46%, rgb(161 161 170 / 0.75) 49%, rgb(161 161 170 / 0.75) 51%, transparent 54%)",
        }}
      />
    );
  }

  return (
    <span
      aria-hidden
      data-profile-palette-fill=""
      className="block h-full w-full rounded-[3px]"
      style={profilePaletteDiagonalStyle(colorA, colorB, swapped)}
    />
  );
}

export function ProfilePalettePicker({
  paletteId,
  paletteSwapped,
  copy,
  locale,
  onPick,
}: {
  paletteId: string | null;
  paletteSwapped: boolean;
  copy: ProfilePalettePickerCopy;
  locale: "ko" | "en";
  onPick: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = profilePaletteById(paletteId);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const noneLabel = `${copy.none} (${copy.noneHint})`;

  return (
    <>
      <GameUiHoverTip label={copy.label} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
        <button
          ref={triggerRef}
          type="button"
          data-profile-palette-trigger=""
          aria-label={copy.label}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect) setAnchor(rect);
            setOpen((current) => !current);
            triggerRef.current?.blur();
          }}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border p-0.5 transition-colors",
            open || selected
              ? "border-primary/45 bg-primary/10"
              : "border-transparent hover:border-white/20 hover:bg-white/5",
          )}
        >
          <span className="block h-5 w-5 overflow-hidden rounded-md">
            <PaletteChipFill
              colorA={selected?.colorA}
              colorB={selected?.colorB}
              swapped={Boolean(selected && paletteSwapped)}
            />
          </span>
        </button>
      </GameUiHoverTip>
      {open && anchor && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              aria-label={copy.label}
              data-profile-palette-popup=""
              className="fixed z-[80] grid grid-cols-4 gap-1 rounded-lg border border-white/15 bg-zinc-950/95 p-1.5 shadow-xl backdrop-blur-sm"
              style={palettePosition(anchor)}
            >
              <PaletteOption
                active={!selected}
                label={noneLabel}
                onSelect={() => onPick(null)}
              />
              {PROFILE_PALETTE_PAIRS.map((pair) => {
                const active = pair.id === paletteId;
                const label = locale === "ko"
                  ? `${pair.nameKoA} · ${pair.nameKoB}`
                  : `${pair.nameEnA} · ${pair.nameEnB}`;
                return (
                  <PaletteOption
                    key={pair.id}
                    paletteId={pair.id}
                    active={active}
                    label={label}
                    colorA={pair.colorA}
                    colorB={pair.colorB}
                    swapped={active && paletteSwapped}
                    onSelect={() => onPick(pair.id)}
                  />
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function PaletteOption({
  paletteId,
  active,
  label,
  colorA,
  colorB,
  swapped,
  onSelect,
}: {
  paletteId?: string;
  active: boolean;
  label: string;
  colorA?: string;
  colorB?: string;
  swapped?: boolean;
  onSelect: () => void;
}) {
  const chip = (
    <button
      type="button"
      role="option"
      aria-label={label}
      aria-selected={active}
      data-profile-palette-id={paletteId ?? ""}
      onClick={onSelect}
      className={cn(
        "h-6 w-6 overflow-hidden rounded-md border p-0.5 transition-[border-color,background-color]",
        paletteId ? "profile-palette-swap-tilt" : null,
        active
          ? "border-primary bg-primary/20"
          : "border-white/10 bg-white/5 hover:border-white/35",
      )}
    >
      <PaletteChipFill colorA={colorA} colorB={colorB} swapped={swapped} />
    </button>
  );

  if (paletteId) return chip;

  return (
    <GameUiHoverTip label={label} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
      {chip}
    </GameUiHoverTip>
  );
}
