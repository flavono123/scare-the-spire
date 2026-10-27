"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import { CardSideTipsAnchor } from "@/components/codex/card-keyword-tip-stack";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { GameResourcePreview } from "@/components/patch-note-renderer";
import { useSts1MentionIndex } from "@/hooks/use-sts1-mention-index";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { GameLocale } from "@/lib/i18n";
import { STS1_CREAM, STS1_DESC_ENERGY_IMG_WIDTH, STS1_DESC_FONT } from "@/lib/sts1/card-style";
import { sts1BitmapAdvance, sts1BitmapPackName } from "@/lib/sts1/bitmap-font";
import {
  EMPTY_STS1_STATS,
  parseSts1CardText,
  plainSts1Text,
  type Sts1TextSpan,
} from "@/lib/sts1/description";
import { collectSts1CardSideTips } from "@/lib/sts1/keyword-tips";
import { sts1LineBreakViaCharacter } from "@/lib/sts1/locale";
import { sts1CardUiUrl } from "@/lib/sts1/paths";
import type { Sts1Keyword, Sts1RelicTier, Sts1UiLabels } from "@/lib/sts1/types";
import type { Sts1MentionEntry } from "@/lib/sts1-mention-index";
import { Sts1BitmapPackScope } from "./bitmap-pack-scope";
import { Sts1BitmapText } from "./bitmap-text";
import { Sts1SmartText } from "./smart-text";
import { Sts1CardTile } from "./card-tile";
import { EDITOR_ANCHOR_PROPS } from "@/components/editor/editor-link";

const PANEL_SRC = "/images/sts1/relic-popup/panel.webp";
const FRAME_SRC = {
  boss: "/images/sts1/relic-popup/frame-boss.webp",
  rare: "/images/sts1/relic-popup/frame-rare.webp",
  uncommon: "/images/sts1/relic-popup/frame-uncommon.webp",
  common: "/images/sts1/relic-popup/frame-common.webp",
} as const;

/** Opaque crop of the 1920×1080 SingleRelicViewPopup overlays. */
const PANEL = { width: 657, height: 834 };
const FRAME = { left: 175, top: 168, width: 312, height: 301 };
/** SingleRelicViewPopup.DESC_LINE_WIDTH at Settings.scale 1. */
const RELIC_LINE_WIDTH = 418;
/** cardDescFont_N 24px, SRV_quoteFont 28px, name = SCP_cardDescFont 48px × 0.9. */
const RELIC_DESC_FONT = 24;
const RELIC_QUOTE_FONT = 28;
const RELIC_NAME_FONT = 48 * 0.9;
const NO_KEYWORDS: readonly Sts1Keyword[] = [];

function frameSrc(tier: string | undefined): string {
  if (tier === "boss") return FRAME_SRC.boss;
  if (tier === "rare" || tier === "special" || tier === "shop") return FRAME_SRC.rare;
  if (tier === "uncommon") return FRAME_SRC.uncommon;
  return FRAME_SRC.common;
}

function relicTierName(labels: Sts1UiLabels, tier: string | undefined): string {
  const key = tier === "deprecated" ? "special" : tier;
  if (
    key === "starter"
    || key === "common"
    || key === "uncommon"
    || key === "rare"
    || key === "boss"
    || key === "special"
    || key === "shop"
  ) {
    return labels.relicTiers[key as Exclude<Sts1RelicTier, "deprecated">];
  }
  return tier ?? "";
}

function fallbackAdvance(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (char === " ") return 0.33 * STS1_DESC_FONT;
  if (code >= 0x2e80) return 0.95 * STS1_DESC_FONT;
  return 0.55 * STS1_DESC_FONT;
}

/** FontHelper.renderSmartText / renderWrappedText line breaks at DESC_LINE_WIDTH. */
function wrapRelicSpans(
  spans: readonly Sts1TextSpan[],
  gameLocale: GameLocale,
  maxAdvance: number,
): Sts1TextSpan[][] {
  const byCharacter = sts1LineBreakViaCharacter(gameLocale);
  const lines: Sts1TextSpan[][] = [];
  let line: Sts1TextSpan[] = [];
  let width = 0;
  const flush = () => {
    if (line.length === 0) return;
    lines.push(line);
    line = [];
    width = 0;
  };
  const appendText = (text: string, color?: string) => {
    if (!text) return;
    const last = line[line.length - 1];
    if (last?.kind === "text" && last.color === color) {
      last.text += text;
      return;
    }
    line.push({ kind: "text", text, color });
  };

  for (const span of spans) {
    if (span.kind === "break") {
      flush();
      continue;
    }
    if (span.kind === "energy") {
      const advance = STS1_DESC_ENERGY_IMG_WIDTH;
      if (width > 0 && width + advance > maxAdvance) flush();
      line.push(span);
      width += advance;
      continue;
    }
    const parts = byCharacter ? Array.from(span.text) : span.text.split(/(\s+)/).filter(Boolean);
    for (const part of parts) {
      if (/^\s+$/.test(part) && width === 0) continue;
      let advance = 0;
      for (const char of part) {
        advance += sts1BitmapAdvance(gameLocale, "desc", char, fallbackAdvance(char));
      }
      if (width > 0 && width + advance > maxAdvance) {
        flush();
        if (/^\s+$/.test(part)) continue;
      }
      appendText(part, span.color);
      width += advance;
    }
  }
  flush();
  return lines.length > 0 ? lines : [[]];
}

function FitInside({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    inner.style.transform = "none";
    const scale = Math.min(
      1,
      outer.clientWidth / Math.max(inner.scrollWidth, 1),
      outer.clientHeight / Math.max(inner.scrollHeight, 1),
    );
    inner.style.transform = `scale(${scale})`;
  });
  return (
    <div ref={outerRef} className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div ref={innerRef} className="w-full origin-center">
        {children}
      </div>
    </div>
  );
}

function RelicBitmapText({
  text,
  keywords = NO_KEYWORDS,
  gameFontPx,
  lineHeight,
}: {
  text: string;
  keywords?: readonly Sts1Keyword[];
  gameFontPx: number;
  lineHeight: number;
}) {
  const gameLocale = useGameLocale();
  const lines = useMemo(() => {
    const spans = parseSts1CardText(text, EMPTY_STS1_STATS, keywords);
    const maxAdvance = (RELIC_LINE_WIDTH * RELIC_DESC_FONT) / gameFontPx;
    return wrapRelicSpans(spans, gameLocale, maxAdvance);
  }, [gameFontPx, gameLocale, keywords, text]);
  return (
    <div
      className="w-full text-center"
      style={{ fontSize: `${(gameFontPx / PANEL.width) * 100}cqw`, lineHeight }}
    >
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className="min-h-[1lh]">
          {line.map((span, spanIndex) => {
            if (span.kind === "energy") {
              return (
                <Image
                  key={spanIndex}
                  src={sts1CardUiUrl(span.orb === "colorless" ? "card_colorless_orb" : `card_${span.orb}_orb`)}
                  alt=""
                  width={18}
                  height={18}
                  className="mx-px inline-block h-[1em] w-[1em] align-[-0.15em] object-contain"
                />
              );
            }
            if (span.kind !== "text" || !span.text) return null;
            return (
              <Sts1BitmapText
                key={spanIndex}
                text={span.text}
                role="desc"
                gameLocale={gameLocale}
                color={span.color ?? STS1_CREAM}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function RelicSlab({
  entry,
  labels,
  suffix,
  keywords,
}: {
  entry: Sts1MentionEntry;
  labels: Sts1UiLabels;
  suffix: string;
  keywords: readonly Sts1Keyword[];
}) {
  return (
    <CardSideTipsAnchor
      tips={collectSts1CardSideTips(plainSts1Text(entry.description), keywords)}
      mode="always"
      preferSide="right"
      className="w-[15.5rem]"
    >
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: `${PANEL.width} / ${PANEL.height}`, containerType: "inline-size" }}
      >
        <Image src={PANEL_SRC} alt="" fill className="object-fill" sizes="248px" />
        <Image
          src={frameSrc(entry.tier)}
          alt=""
          width={FRAME.width}
          height={FRAME.height}
          className="absolute object-fill"
          style={{
            left: `${(FRAME.left / PANEL.width) * 100}%`,
            top: `${(FRAME.top / PANEL.height) * 100}%`,
            width: `${(FRAME.width / PANEL.width) * 100}%`,
            height: `${(FRAME.height / PANEL.height) * 100}%`,
          }}
        />
        <Image
          src={entry.largeImageUrl || entry.imageUrl}
          alt=""
          width={128}
          height={128}
          className="absolute object-contain"
          style={{
            left: `${((FRAME.left + FRAME.width * 0.18) / PANEL.width) * 100}%`,
            top: `${((FRAME.top + FRAME.height * 0.16) / PANEL.height) * 100}%`,
            width: `${((FRAME.width * 0.64) / PANEL.width) * 100}%`,
            height: `${((FRAME.height * 0.64) / PANEL.height) * 100}%`,
          }}
        />
        <div className="absolute inset-x-[8%] top-[8%] h-[8%]">
          <FitInside>
            <RelicBitmapText text={entry.nameKo} gameFontPx={RELIC_NAME_FONT} lineHeight={1} />
          </FitInside>
        </div>
        <div className="absolute inset-x-[12%] top-[15%] h-[4%]">
          <FitInside>
            <RelicBitmapText
              text={`${relicTierName(labels, entry.tier)}${suffix}`}
              gameFontPx={RELIC_DESC_FONT}
              lineHeight={1}
            />
          </FitInside>
        </div>
        {/* Description is centered on screenY center−140, above the line painted in panel.webp. */}
        <div className="absolute inset-x-[18%] top-[57%] bottom-[28%]">
          <FitInside>
            <RelicBitmapText
              text={entry.description}
              keywords={keywords}
              gameFontPx={RELIC_DESC_FONT}
              lineHeight={30 / RELIC_DESC_FONT}
            />
          </FitInside>
        </div>
        {entry.flavor ? (
          <div className="absolute inset-x-[18%] top-[76%] bottom-[3%]">
            <FitInside>
              <RelicBitmapText text={entry.flavor} gameFontPx={RELIC_QUOTE_FONT} lineHeight={1.15} />
            </FitInside>
          </div>
        ) : null}
      </div>
    </CardSideTipsAnchor>
  );
}

export function Sts1MentionHover({
  entityId,
  text,
  editorLink = false,
}: {
  entityId: string;
  text: string;
  /** Inside an editor: plain clicks stay put; see EDITOR_ANCHOR_PROPS. */
  editorLink?: boolean;
}) {
  const { index } = useSts1MentionIndex();
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const [hovered, setHovered] = useState(false);
  const entry = index?.entries.find((item) => item.id === entityId);
  const localeKey = serviceLocale === "en" ? "eng" : "kor";
  const labels = index?.labels[localeKey];
  let preview = null;
  let drawsBitmapText = false;
  if (entry?.resource === "cards" && entry.card && labels) {
    const typeKey = entry.card.type;
    const typeLabel = typeKey === "attack" || typeKey === "skill" || typeKey === "power" || typeKey === "curse" || typeKey === "status"
      ? labels.types[typeKey]
      : entry.card.type;
    drawsBitmapText = true;
    preview = (
      <div className="w-36 drop-shadow-2xl">
        <Sts1CardTile
          card={entry.card}
          keywords={index?.keywords ?? []}
          typeLabel={typeLabel}
          gameLocale={gameLocale}
        />
      </div>
    );
  } else if (entry?.resource === "relics" && labels) {
    drawsBitmapText = true;
    preview = (
      <RelicSlab
        entry={entry}
        labels={labels}
        suffix={index?.relicPopupSuffix?.[localeKey] ?? ""}
        keywords={index?.keywords ?? []}
      />
    );
  } else if (entry) {
    preview = (
      <GameResourcePreview
        title={entry.nameKo}
        imageUrl={entry.largeImageUrl || entry.imageUrl}
        imageAlt={entry.nameKo}
        imageClassName="h-16 w-16 object-contain"
        imageWidth={72}
        imageHeight={72}
      >
        <Sts1SmartText text={entry.description} color={STS1_CREAM} />
      </GameResourcePreview>
    );
  }

  const layer = hovered && preview ? (
    <PortaledHoverTipLayer pin="top-left">
      {preview}
    </PortaledHoverTipLayer>
  ) : null;

  return (
    <span
      className="relative inline cursor-help font-semibold spire-gold"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <a
        href={entry?.href ?? "#"}
        className="font-game-title font-semibold spire-gold no-underline"
        {...(editorLink ? EDITOR_ANCHOR_PROPS : {})}
      >
        {text}
      </a>
      {layer && drawsBitmapText ? (
        // The glyph pack loads on first hover; the tip appears once it can draw in full.
        <Suspense fallback={null}>
          <Sts1BitmapPackScope packs={[sts1BitmapPackName(gameLocale)]}>{layer}</Sts1BitmapPackScope>
        </Suspense>
      ) : layer}
    </span>
  );
}
