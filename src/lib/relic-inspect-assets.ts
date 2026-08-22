import type { RelicRarityKo } from "@/lib/codex-types";

export const RELIC_INSPECT_REWARD_PANEL =
  "/images/sts2/ui/inspect-relic/reward_panel.webp";

/** Pixel size of `reward_panel.webp` (FrameBg stone slab). */
export const RELIC_INSPECT_REWARD_PANEL_SIZE = {
  width: 1128,
  height: 1435,
} as const;

/** Pixel size of `relic_inspect_frame.webp` (square ornamental ring). */
export const RELIC_INSPECT_FRAME_SIZE = {
  width: 408,
  height: 408,
} as const;

/** Compact hover / keyword-preview width. Keep the panel aspect, not a square. */
export const RELIC_INSPECT_HOVER_WIDTH_PX = 224;

export const RELIC_INSPECT_HOVER_SIZE = {
  width: RELIC_INSPECT_HOVER_WIDTH_PX,
  height: Math.round(
    RELIC_INSPECT_HOVER_WIDTH_PX
      * (RELIC_INSPECT_REWARD_PANEL_SIZE.height / RELIC_INSPECT_REWARD_PANEL_SIZE.width),
  ),
} as const;

const RELIC_INSPECT_FRAME_BY_RARITY: Record<RelicRarityKo, string> = {
  "시작 유물": "/images/sts2/ui/inspect-relic/relic_inspect_frame-starter.webp",
  "일반 유물": "/images/sts2/ui/inspect-relic/relic_inspect_frame-common.webp",
  "고급 유물": "/images/sts2/ui/inspect-relic/relic_inspect_frame-uncommon.webp",
  "희귀 유물": "/images/sts2/ui/inspect-relic/relic_inspect_frame-rare.webp",
  "상점 유물": "/images/sts2/ui/inspect-relic/relic_inspect_frame-shop.webp",
  "이벤트 유물": "/images/sts2/ui/inspect-relic/relic_inspect_frame-event.webp",
  "고대 유물": "/images/sts2/ui/inspect-relic/relic_inspect_frame-ancient.webp",
  None: "/images/sts2/ui/inspect-relic/relic_inspect_frame-common.webp",
};

/** HSV-baked inspect frame matching NInspectRelicScreen.SetRarityVisuals. */
export function relicInspectFrameUrl(rarity: RelicRarityKo): string {
  return RELIC_INSPECT_FRAME_BY_RARITY[rarity]
    ?? "/images/sts2/ui/inspect-relic/relic_inspect_frame-common.webp";
}
