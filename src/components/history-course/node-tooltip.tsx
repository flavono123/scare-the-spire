"use client";

import Image from "@/components/ui/static-image";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { RichText } from "@/components/rich-text";
import { useGameI18n } from "@/hooks/use-game-i18n";
import { useGameLocale } from "@/hooks/use-game-locale";
import {
  HISTORY_HOVER_ICON_SRC,
  buildMapPointHistoryHover,
  splitHistoryHoverColumns,
  type HistoryHoverIcon,
  type HistoryHoverLine,
} from "@/lib/history-map-point-hover";
import type {
  ReplayActAnalysis,
  ReplayHistoryEntry,
} from "@/lib/sts2-run-replay";

export interface NodeTooltipProps {
  act: ReplayActAnalysis;
  stepIndex: number;
  entry: ReplayHistoryEntry;
  /** Override for absolute positioning. Default = right of anchor. */
  position?: "right" | "below";
}

export function NodeTooltip({
  act,
  stepIndex,
  entry,
  position = "right",
}: NodeTooltipProps) {
  const tables = useGameI18n();
  const locale = useGameLocale();
  const floor = act.baseFloor + stepIndex;
  const model = buildMapPointHistoryHover(entry, floor, tables, locale);
  const wide = model.rewardLines.length > 5 || model.skippedLines.length > 5;

  return (
    <PortaledHoverTipLayer pin={position === "below" ? "top-left" : "center-right"}>
      <div
        className="pointer-events-none"
        data-history-node-hover-tip=""
        style={{ width: wide ? 460 : 280 }}
      >
        <div
          style={{
            borderStyle: "solid",
            borderWidth: 24,
            borderImage:
              "url('/images/sts2/ui/hover_tip.png') 24 fill / 24px / 0 stretch",
            padding: "4px 8px",
            fontSize: 12,
            lineHeight: 1.45,
            color: "#e2e8f0",
            fontWeight: 500,
          }}
        >
          <div style={{ color: "#FFD479", fontWeight: 700 }}>
            {model.floorTitle}
          </div>
          {model.playerStats ? (
            <div>
              <RichText text={model.playerStats} />
            </div>
          ) : null}
          <div className="mt-1 text-zinc-100">{model.roomStats}</div>
          {model.actionLines.length > 0 ? (
            <HoverLineList lines={model.actionLines} />
          ) : null}
          {model.rewardLines.length > 0 ? (
            <HoverSection header={model.rewardsHeader} lines={model.rewardLines} />
          ) : null}
          {model.skippedLines.length > 0 ? (
            <HoverSection header={model.skippedHeader} lines={model.skippedLines} />
          ) : null}
        </div>
      </div>
    </PortaledHoverTipLayer>
  );
}

function HoverSection({
  header,
  lines,
}: {
  header: string;
  lines: HistoryHoverLine[];
}) {
  const [left, right] = splitHistoryHoverColumns(lines);
  return (
    <>
      <div className="mt-1" style={{ color: "#FFD479" }}>
        {header}
      </div>
      <div className={right.length > 0 ? "grid grid-cols-2 gap-x-3" : undefined}>
        <HoverLineList lines={left} />
        {right.length > 0 ? <HoverLineList lines={right} /> : null}
      </div>
    </>
  );
}

function HoverLineList({ lines }: { lines: HistoryHoverLine[] }) {
  return (
    <ul className="ml-3 space-y-0.5">
      {lines.map((row, index) => (
        <li key={`${row.icon ?? "none"}-${row.text}-${index}`} className="flex items-start gap-0.5">
          {row.icon ? <HoverTokenIcon icon={row.icon} /> : null}
          <RichText text={row.text} />
        </li>
      ))}
    </ul>
  );
}

function HoverTokenIcon({ icon }: { icon: HistoryHoverIcon }) {
  return (
    <Image
      src={HISTORY_HOVER_ICON_SRC[icon]}
      alt=""
      width={16}
      height={16}
      className="mt-px inline-block shrink-0 object-contain"
      style={{ width: 16, height: 16 }}
      data-history-hover-icon={icon}
      aria-hidden
    />
  );
}
