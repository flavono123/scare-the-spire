"use client";

/**
 * Map parts shared by the history course map (SeededMapView in
 * components/dev/run-replay-poc.tsx) and the dev-only map progress bar
 * simulator (/dev/map-bar): room icons with their outline and selection ring,
 * the ancient node, path dots, the clockwise sweep ring and the character
 * marker, with the transit's sub-windows. Moved here unchanged from the
 * history course map.
 */

import Image from "next/image";
import { type CSSProperties, useState } from "react";
import {
  MAP_GAME_SCALE,
  NORMAL_ICON_SIZE,
  TRANSIT_RING_END,
  TRANSIT_TRAIL_END,
  markerPopScale,
  transitWindows,
} from "@/lib/sts2-map-geometry";
import {
  mapIconNameForType,
  mapOutlineNameForType,
  revealedUnknownIconNameForRoom,
  revealedUnknownOutlineNameForRoom,
} from "@/lib/sts2-map-icons";

export { MAP_GAME_SCALE, NORMAL_ICON_SIZE, TRANSIT_RING_END, TRANSIT_TRAIL_END, markerPopScale, transitWindows };
export { mapIconNameForType, mapOutlineNameForType, revealedUnknownIconNameForRoom, revealedUnknownOutlineNameForRoom };

export const ACT_MAP_META: Record<
  string,
  {
    key: "overgrowth" | "underdocks" | "hive" | "glory";
    bgColor: string;
    traveledColor: string;
    untraveledColor: string;
    border: string;
  }
> = {
  "ACT.OVERGROWTH": {
    key: "overgrowth",
    bgColor: "#A78A67",
    traveledColor: "#28231D",
    untraveledColor: "#574738",
    border: "rgba(167, 138, 103, 0.36)",
  },
  "ACT.UNDERDOCKS": {
    key: "underdocks",
    bgColor: "#9F95A5",
    traveledColor: "#180F24",
    untraveledColor: "#534A62",
    border: "rgba(159, 149, 165, 0.36)",
  },
  "ACT.HIVE": {
    key: "hive",
    bgColor: "#9B9562",
    traveledColor: "#27221C",
    untraveledColor: "#6E7750",
    border: "rgba(155, 149, 98, 0.36)",
  },
  "ACT.GLORY": {
    key: "glory",
    bgColor: "#819A97",
    traveledColor: "#1D1E2F",
    untraveledColor: "#60717C",
    border: "rgba(129, 154, 151, 0.36)",
  },
};

export const ANCIENT_ASSETS: Record<
  string,
  {
    node: string;
    outline: string;
  }
> = {
  neow: {
    node: "/images/sts2/ancient-nodes/ancient_node_neow.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_neow_outline.webp",
  },
  orobas: {
    node: "/images/sts2/ancient-nodes/ancient_node_orobas.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_orobas_outline.webp",
  },
  nonupeipe: {
    node: "/images/sts2/ancient-nodes/ancient_node_nonupeipe.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_nonupeipe_outline.webp",
  },
  darv: {
    node: "/images/sts2/ancient-nodes/ancient_node_darv.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_darv_outline.webp",
  },
  pael: {
    node: "/images/sts2/ancient-nodes/ancient_node_pael.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_pael_outline.webp",
  },
  tanx: {
    node: "/images/sts2/ancient-nodes/ancient_node_tanx.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_tanx_outline.webp",
  },
  tezcatara: {
    node: "/images/sts2/ancient-nodes/ancient_node_tezcatara.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_tezcatara_outline.webp",
  },
  vakuu: {
    node: "/images/sts2/ancient-nodes/ancient_node_vakuu.webp",
    outline: "/images/sts2/ancient-nodes/ancient_node_vakuu_outline.webp",
  },
};

export const FALLBACK_ACT_MAP_META = ACT_MAP_META["ACT.OVERGROWTH"];

export const MAP_SELECTION_RING_COLOR = "#241F1A";

export const MAP_ICON_NATIVE_SIZES: Record<string, { width: number; height: number }> = {
  map_monster: { width: 66, height: 68 },
  map_elite: { width: 89, height: 70 },
  map_rest: { width: 61, height: 90 },
  map_chest: { width: 84, height: 59 },
  map_shop: { width: 69, height: 72 },
  map_unknown: { width: 73, height: 72 },
  map_unknown_monster: { width: 66, height: 68 },
  map_unknown_elite: { width: 89, height: 70 },
  map_unknown_shop: { width: 69, height: 72 },
  map_unknown_chest: { width: 84, height: 59 },
};

export const MAP_OUTLINE_NATIVE_SIZES: Record<string, { width: number; height: number }> = {
  map_monster_outline: { width: 72, height: 74 },
  map_elite_outline: { width: 95, height: 77 },
  map_rest_outline: { width: 73, height: 95 },
  map_chest_outline: { width: 88, height: 67 },
  map_shop_outline: { width: 74, height: 76 },
  map_unknown_outline: { width: 80, height: 78 },
  map_chest_boss_outline: { width: 96, height: 83 },
};

export type RenderSize = {
  width: number;
  height: number;
};

export function actMapMeta(actId: string) {
  return ACT_MAP_META[actId] ?? FALLBACK_ACT_MAP_META;
}

export function mapIconSrc(actId: string, iconName: string) {
  const meta = actMapMeta(actId);
  return `/images/sts2/map/icons-by-act/${meta.key}/${iconName}.png`;
}

export function mapOutlineSrc(outlineName: string) {
  return `/images/sts2/map/outlines/${outlineName}.png`;
}

export function effectSrc(name: string) {
  return `/images/sts2/map/effects/${name}.png`;
}

export function maskStyle(src: string, color: string, opacity = 1): CSSProperties {
  return {
    backgroundColor: color,
    opacity,
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };
}

export function nodeOpacity(state: "inactive" | "active" | "current") {
  return state === "inactive" ? 0.52 : 1;
}

export function outlineOpacity(state: "inactive" | "active" | "current") {
  return state === "inactive" ? 0.72 : 1;
}

export function circleOpacity(state: "inactive" | "active" | "current") {
  if (state === "inactive") return 0;
  return state === "current" ? 1 : 0.92;
}

export function scaleNativeSize(size: RenderSize): RenderSize {
  return {
    width: Math.round(size.width * MAP_GAME_SCALE),
    height: Math.round(size.height * MAP_GAME_SCALE),
  };
}

export function mapIconRenderSize(iconName: string): RenderSize {
  return scaleNativeSize(MAP_ICON_NATIVE_SIZES[iconName] ?? { width: NORMAL_ICON_SIZE, height: NORMAL_ICON_SIZE });
}

export function mapOutlineRenderSize(outlineName: string): RenderSize {
  return scaleNativeSize(MAP_OUTLINE_NATIVE_SIZES[outlineName] ?? { width: NORMAL_ICON_SIZE, height: NORMAL_ICON_SIZE });
}

export function MapSelectionRing({
  state,
  inset,
  suppress,
}: {
  state: "inactive" | "active" | "current";
  inset: string;
  /** Phase 4 — when true, the steady ring is hidden so the SweepRing
   *  overlay can own the destination's selection visual during the
   *  clockwise sweep window. */
  suppress?: boolean;
}) {
  if (state === "inactive") {
    return null;
  }
  if (suppress) {
    return null;
  }

  return (
    <div
      className="absolute"
      style={{
        inset,
        ...maskStyle(effectSrc("map_circle_4"), MAP_SELECTION_RING_COLOR, circleOpacity(state)),
      }}
    />
  );
}

/** Phase 4 — clockwise sweep ring layered on the destination node while
 *  `pct` ramps 0→1. Two stacked masks: the outer wrapper clips by a
 *  conic-gradient wedge anchored at 12 o'clock (`from -90deg`) so the
 *  reveal sweeps clockwise, and the inner div carries the standard
 *  `map_circle_4` ring shape. The result is the same selection ring as
 *  the steady "current" state, but progressively painted in.
 */
export function SweepRing({ pct }: { pct: number }) {
  const angleDeg = Math.max(0, Math.min(1, pct)) * 360;
  const wedge = `conic-gradient(from -90deg, white 0deg, white ${angleDeg.toFixed(2)}deg, transparent ${angleDeg.toFixed(2)}deg, transparent 360deg)`;
  return (
    <div
      data-testid="ring-sweep"
      className="pointer-events-none absolute"
      style={{
        inset: "-18%",
        WebkitMaskImage: wedge,
        maskImage: wedge,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
      }}
    >
      <div
        className="absolute inset-0"
        style={maskStyle(effectSrc("map_circle_4"), MAP_SELECTION_RING_COLOR, 1)}
      />
    </div>
  );
}

export function MapRoomAsset({
  actId,
  state,
  size,
  iconName,
  outlineName,
  alt,
  suppressRing,
}: {
  actId: string;
  state: "inactive" | "active" | "current";
  size: RenderSize;
  iconName: string;
  outlineName: string;
  alt: string;
  suppressRing?: boolean;
}) {
  const meta = actMapMeta(actId);
  const iconSize = mapIconRenderSize(iconName);
  const outlineSize = mapOutlineRenderSize(outlineName);

  return (
    <div className="relative shrink-0" style={{ width: size.width, height: size.height }}>
      <MapSelectionRing state={state} inset="-18%" suppress={suppressRing} />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: outlineSize.width,
          height: outlineSize.height,
          ...maskStyle(mapOutlineSrc(outlineName), meta.bgColor, outlineOpacity(state)),
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: iconSize.width, height: iconSize.height, opacity: nodeOpacity(state) }}
      >
        <AssetThumb
          src={mapIconSrc(actId, iconName)}
          fallbackSrc={`/images/sts2/map/icons/${iconName}.png`}
          alt={alt}
          className="object-contain"
        />
      </div>
    </div>
  );
}

export function AncientMapAsset({
  actId,
  size,
  src,
  outlineSrc,
  alt,
}: {
  actId: string;
  size: RenderSize;
  src: string;
  outlineSrc: string;
  alt: string;
}) {
  const meta = actMapMeta(actId);

  return (
    <div className="relative shrink-0" style={{ width: size.width, height: size.height }}>
      <div className="absolute inset-0" style={maskStyle(outlineSrc, meta.bgColor, 1)}>
        <span className="sr-only">{alt}</span>
      </div>
      <div className="absolute inset-0" style={{ opacity: 0.18 }}>
        <AssetThumb src={src} fallbackSrc={null} alt={alt} className="object-contain" />
      </div>
      <div className="absolute inset-0" style={maskStyle(src, MAP_SELECTION_RING_COLOR, 1)} />
    </div>
  );
}

export function AssetThumb({
  src,
  fallbackSrc,
  alt,
  className,
}: {
  src: string | null;
  fallbackSrc: string | null;
  alt: string;
  className: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolvedSrc = src && failedSrc !== src ? src : fallbackSrc ?? src;

  if (!resolvedSrc) {
    return null;
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      fill
      sizes="(max-width: 1280px) 96px, 128px"
      className={className}
      onError={() => {
        if (src && fallbackSrc && resolvedSrc === src) {
          setFailedSrc(src);
        }
      }}
    />
  );
}

export type MapNodeState = "inactive" | "active" | "current";

/** One path dot, centered on (left, top). */
export function PathTick({
  left,
  top,
  rotation,
  revealed,
  traveledColor,
  untraveledColor,
}: {
  left: number;
  top: number;
  rotation: number;
  revealed: boolean;
  traveledColor: string;
  untraveledColor: string;
}) {
  return (
    <div
      className="absolute"
      style={{
        left,
        top,
        width: 16 * MAP_GAME_SCALE,
        height: 16 * MAP_GAME_SCALE,
        // Translate-only, no layout-affecting offsets. Avoid
        // filter chains here — path ticks are tiny and there
        // are hundreds of them, so a stacked drop-shadow per
        // tick dominates paint/composite cost during scroll.
        transform: `translate(-50%, -50%) rotate(${rotation}rad) scale(${revealed ? 1.2 : 1
          })`,
        ...maskStyle(
          effectSrc("map_dot"),
          revealed ? traveledColor : untraveledColor,
          1,
        ),
      }}
    />
  );
}

/** The player's map marker: the character icon over its outline, centered on (left, top). */
export function CharacterMarker({
  left,
  top,
  size,
  scale,
  opacity,
  onDestination,
  src,
  outlineSrc,
}: {
  left: number;
  top: number;
  size: number;
  scale: number;
  opacity: number;
  onDestination: boolean;
  src: string;
  outlineSrc?: string;
}) {
  return (
    <div
      aria-hidden
      data-testid="character-pop-marker"
      data-on-destination={onDestination ? "true" : "false"}
      className="pointer-events-none absolute z-20"
      style={{
        left,
        top,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
        opacity,
      }}
    >
      {/* Layer the game's own outline silhouette beneath the
       *  portrait. No extra disc / ring frame — both webps
       *  carry their own visual treatment. */}
      {outlineSrc && (
        <Image
          src={outlineSrc}
          alt=""
          fill
          sizes="48px"
          className="absolute inset-0 object-contain"
          unoptimized
        />
      )}
      <Image
        src={src}
        alt=""
        fill
        sizes="48px"
        className="absolute inset-0 object-contain"
        unoptimized
      />
    </div>
  );
}
