"use client";

/**
 * scenes/ui/hover_tip.tscn at game size (1 game px = 1 px here; the stage scales it):
 * a 360-wide MarginContainer with the hover_tip nine-patch (and its shadow 8 px down-right),
 * title Kreon Bold 22 gold, description Kreon Regular 22 cream with line separation -2,
 * both with a 3,2 shadow at 25% black, text margins 22/16/45/28.
 */

import { HOVER_TIP_SLICE, HOVER_TIP_SRC } from "@/lib/hover-tip-chrome";
import { parseDescription } from "@/lib/codex-card-description";
import type { HoverTipView } from "@/lib/node-sim/blitz-merchant";

/** StsColors (gold, blue, red, purple) for the RichTextTags. */
const BBCODE_COLORS: Record<string, string> = {
  gold: "#EFC851",
  blue: "#87CEEB",
  red: "#FF5555",
  purple: "#EE82EE",
};

export interface HoverTipLayout {
  width: number;
  spacing: number;
  margin: { left: number; top: number; right: number; bottom: number };
  titleFontSize: number;
  descriptionFontSize: number;
  lineSeparation: number;
  textShadow: [number, number];
  titleIconGap: number;
}

const rgba = (c: number[]) => `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${c[3] ?? 1})`;

export function BbcodeText({ text, color }: { text: string; color: string }) {
  return (
    <>
      {parseDescription(text).map((part, i) => {
        if (part.type === "newline") return <br key={i} />;
        const tint = BBCODE_COLORS[part.type];
        return <span key={i} style={tint ? { color: tint } : { color }}>{part.text}</span>;
      })}
    </>
  );
}

function NinePatch({ shadow }: { shadow?: boolean }) {
  const s = HOVER_TIP_SLICE;
  return (
    <div
      className="absolute inset-0"
      style={{
        // MarginContainer margin_right/bottom -8: the patches reach 8 px past the text box; the shadow's region is shifted by -8.
        right: -8,
        bottom: -8,
        ...(shadow ? { left: 8, top: 8, right: -16, bottom: -16, filter: "brightness(0)", opacity: 0.25098 } : {}),
        borderStyle: "solid",
        borderColor: "transparent",
        borderWidth: `${s.top}px ${s.right}px ${s.bottom}px ${s.left}px`,
        borderImageSource: `url(${HOVER_TIP_SRC.default})`,
        borderImageSlice: `${s.top} ${s.right} ${s.bottom} ${s.left} fill`,
        borderImageRepeat: "stretch",
      }}
    />
  );
}

export function GameHoverTip({ tip, layout, font, colors }: {
  tip: HoverTipView;
  layout: HoverTipLayout;
  font: { regular: string; bold: string };
  colors: { title: number[]; description: number[] };
}) {
  const shadow = `${layout.textShadow[0]}px ${layout.textShadow[1]}px 0 rgba(0, 0, 0, 0.25098)`;
  const m = layout.margin;
  return (
    <div className="relative" style={{ width: layout.width }}>
      <NinePatch shadow />
      <NinePatch />
      <div className="relative" style={{ padding: `${m.top}px ${m.right - 8}px ${m.bottom - 8}px ${m.left}px` }}>
        <div className="flex items-center" style={{ gap: layout.titleIconGap }}>
          <span style={{ fontFamily: font.bold, fontWeight: 700, fontSize: layout.titleFontSize, lineHeight: 1.25, color: rgba(colors.title), textShadow: shadow, whiteSpace: "nowrap" }}>
            {tip.title}
          </span>
          {tip.icon && (
            // TextureRect expand_mode 2 (fit height): as tall as the title line.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tip.icon} alt="" style={{ height: Math.round(layout.titleFontSize * 1.25), width: "auto" }} />
          )}
        </div>
        <div
          style={{
            fontFamily: font.regular,
            fontSize: layout.descriptionFontSize,
            lineHeight: `${Math.round(layout.descriptionFontSize * 1.25) + layout.lineSeparation}px`,
            color: rgba(colors.description),
            textShadow: shadow,
            overflowWrap: "anywhere",
            wordBreak: "keep-all",
          }}
        >
          <BbcodeText text={tip.description} color={rgba(colors.description)} />
        </div>
      </div>
    </div>
  );
}
