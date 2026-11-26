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
import { usePageGameUiLabels } from "@/hooks/use-game-ui-labels";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { getHoverTipPortalRoot, HOVER_TIP_LAYER_Z_INDEX } from "@/lib/hover-tip-layer";
import { DescriptionText } from "./codex-description";
import { CardTile } from "./card-tile";
import { GameHoverTip } from "./hover-tip";

type FixedPlacement = {
  left: number;
  top: number;
};

const MIN_VIEWPORT_WIDTH = 768;

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
  const serviceLocale = useServiceLocale();
  return (
    <span className="block w-36 drop-shadow-2xl">
      <CardTile
        card={tip.card}
        serviceLocale={serviceLocale}
        showUpgrade={Boolean(tip.upgrade)}
        showBeta={false}
        interactive={false}
      />
    </span>
  );
}

function renderSideTip(tip: CardSideTip) {
  if (tip.kind === "keyword") return <KeywordSideTip tip={tip} />;
  return <CardEntitySideTip tip={tip} />;
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

export { HOVER_TIP_LAYER_Z_INDEX, PortaledHoverTipLayer } from "./portaled-hover-tip-layer";

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
        data-hover-tip-layer=""
        className="pointer-events-none"
        style={{
          position: "fixed",
          left: placement.left,
          top: placement.top,
          zIndex: HOVER_TIP_LAYER_Z_INDEX,
          visibility: showTips ? "visible" : "hidden",
        }}
      >
        <TipStackBody tips={tips} />
      </div>,
      getHoverTipPortalRoot() ?? document.body,
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
