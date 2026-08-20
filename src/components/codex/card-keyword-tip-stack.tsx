"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "@/components/ui/static-image";
import type { CardSideTip } from "@/lib/card-keyword-tips";
import {
  placeCardSideTip,
  type CardSideTipHorizontal,
} from "@/lib/card-side-tip-placement";
import { MONSTER_TYPE_CONFIG } from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";
import { CardTile } from "./card-tile";
import { GameHoverTip } from "./hover-tip";

type FixedPlacement = {
  left: number;
  top: number;
};

const MIN_VIEWPORT_WIDTH = 768;
/** Above card-library modal (z-100) and detail chrome. */
const TIP_Z_INDEX = 200;

function KeywordSideTip({ tip }: { tip: Extract<CardSideTip, { kind: "keyword" }> }) {
  return (
    <GameHoverTip
      title={tip.title}
      icon={tip.iconUrl}
      variant={tip.variant}
      style={{ minWidth: 220, maxWidth: 280 }}
    >
      <DescriptionText description={tip.description} className="block text-left" />
    </GameHoverTip>
  );
}

function CardEntitySideTip({ tip }: { tip: Extract<CardSideTip, { kind: "card" }> }) {
  return (
    <span className="block w-36 drop-shadow-2xl">
      <CardTile
        card={tip.card}
        showUpgrade={Boolean(tip.upgrade)}
        showBeta={false}
        interactive={false}
      />
    </span>
  );
}

function MonsterEntitySideTip({ tip }: { tip: Extract<CardSideTip, { kind: "monster" }> }) {
  const monster = tip.monster;
  const imageUrl = tip.imageUrl ?? monster?.bossImageUrl ?? monster?.imageUrl ?? null;
  const meta = monster ? (
    <>
      <span style={{ color: MONSTER_TYPE_CONFIG[monster.type].color }}>
        {MONSTER_TYPE_CONFIG[monster.type].label}
      </span>
      {monster.minHp != null && monster.minHp !== 9999 && (
        <span className="text-gray-300">
          HP{" "}
          {monster.maxHp && monster.maxHp !== monster.minHp
            ? `${monster.minHp}-${monster.maxHp}`
            : monster.minHp}
        </span>
      )}
    </>
  ) : null;

  return (
    <span className="flex w-max max-w-[22rem] items-start gap-2.5">
      {imageUrl && (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-black/20">
          <Image
            src={imageUrl}
            alt={tip.title}
            width={64}
            height={64}
            className="h-14 w-14 rounded object-cover"
          />
        </span>
      )}
      <GameHoverTip title={tip.title} style={{ minWidth: 200, maxWidth: 260 }}>
        {meta && <span className="mb-1 flex flex-wrap gap-2 text-sm">{meta}</span>}
        {monster ? (
          <span className="block text-left text-sm text-[#FFF6E2]/80">
            {monster.bestiaryMoves
              .filter((move) => !["NOTHING", "SPAWNED", "DEAD"].includes(move.id))
              .slice(0, 4)
              .map((move) => move.name)
              .join(", ")}
          </span>
        ) : null}
      </GameHoverTip>
    </span>
  );
}

function renderSideTip(tip: CardSideTip) {
  if (tip.kind === "keyword") return <KeywordSideTip tip={tip} />;
  if (tip.kind === "card") return <CardEntitySideTip tip={tip} />;
  return <MonsterEntitySideTip tip={tip} />;
}

function TipStackBody({ tips }: { tips: readonly CardSideTip[] }) {
  return (
    <div className="flex w-max max-w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2">
      {tips.map((tip) => (
        <div key={`${tip.kind}:${tip.id}`}>{renderSideTip(tip)}</div>
      ))}
    </div>
  );
}

/** Above card-library modal (z-100), side-tip stack (200), and History Course chrome. */
export const HOVER_TIP_LAYER_Z_INDEX = 300;

export function PortaledHoverTipLayer({
  children,
}: {
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);

  const updateBox = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBox({ left: rect.left, top: rect.top });
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const raf = requestAnimationFrame(updateBox);
    return () => cancelAnimationFrame(raf);
  }, [mounted, children, updateBox]);

  useLayoutEffect(() => {
    if (!mounted) return;
    window.addEventListener("resize", updateBox);
    window.addEventListener("scroll", updateBox, true);
    return () => {
      window.removeEventListener("resize", updateBox);
      window.removeEventListener("scroll", updateBox, true);
    };
  }, [mounted, updateBox]);

  const portal = mounted && box
    ? createPortal(
      <div
        className="pointer-events-none"
        style={{
          position: "fixed",
          left: box.left,
          top: box.top,
          zIndex: HOVER_TIP_LAYER_Z_INDEX,
        }}
      >
        {children}
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <span ref={anchorRef} className="block h-0 w-0" aria-hidden />
      {portal}
    </>
  );
}

export function HoverTipStack({ tips }: { tips: readonly CardSideTip[] }) {
  return <TipStackBody tips={tips} />;
}

function getDetailRailRect(): DOMRect | null {
  const rail = document.querySelector(
    "[data-card-detail-meta], [data-relic-detail-meta], [data-potion-detail-meta], [data-power-detail-meta], [data-enchantment-detail-meta]",
  )?.closest("aside");
  if (!rail) return null;
  const rect = rail.getBoundingClientRect();
  return rect.width > 0 ? rect : null;
}

export function CardSideTipsAnchor({
  tips,
  mode,
  preferSide = "right",
  children,
  className = "",
  style,
}: {
  tips: readonly CardSideTip[];
  mode: "hover" | "always";
  preferSide?: CardSideTipHorizontal;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [fits, setFits] = useState(false);
  const [placement, setPlacement] = useState<FixedPlacement>({ left: 0, top: 0 });

  const wantVisible = (mode === "always" || hovered) && tips.length > 0;
  const showTips = wantVisible && fits;

  const updatePlacement = useCallback(() => {
    const anchor = anchorRef.current;
    const measure = measureRef.current;
    if (!anchor || !measure) {
      setFits(false);
      return;
    }
    if (window.innerWidth < MIN_VIEWPORT_WIDTH) {
      setFits(false);
      return;
    }

    const next = placeCardSideTip({
      card: anchor.getBoundingClientRect(),
      tipWidth: measure.offsetWidth,
      tipHeight: measure.offsetHeight,
      preferSide,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      rail: getDetailRailRect(),
    });

    if (!next) {
      setFits(false);
      return;
    }
    setPlacement(next);
    setFits(true);
  }, [preferSide]);

  useLayoutEffect(() => {
    if (!wantVisible || !mounted) return;
    const raf = requestAnimationFrame(() => updatePlacement());
    return () => cancelAnimationFrame(raf);
  }, [wantVisible, tips, mounted, updatePlacement]);

  useLayoutEffect(() => {
    if (!wantVisible || !mounted) return;
    const onResize = () => updatePlacement();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [wantVisible, mounted, updatePlacement]);

  const portal = mounted && wantVisible && tips.length > 0
    ? createPortal(
      <div
        ref={measureRef}
        data-card-side-tips
        className="pointer-events-none"
        style={{
          position: "fixed",
          left: placement.left,
          top: placement.top,
          zIndex: TIP_Z_INDEX,
          visibility: showTips ? "visible" : "hidden",
        }}
      >
        <TipStackBody tips={tips} />
      </div>,
      document.body,
    )
    : null;

  return (
    <div
      ref={anchorRef}
      className={`relative ${className}`}
      style={style}
      onMouseEnter={() => {
        if (mode === "hover") setHovered(true);
      }}
      onMouseLeave={() => {
        if (mode === "hover") setHovered(false);
      }}
    >
      {children}
      {portal}
    </div>
  );
}
