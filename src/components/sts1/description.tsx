"use client";

import { forwardRef, type CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import { Sts1BitmapText } from "./bitmap-text";
import { parseSts1CardText, type Sts1TextSpan } from "@/lib/sts1/description";
import {
  STS1_CARD_IN_ATLAS,
  STS1_CREAM,
  STS1_DESC_FONT,
  STS1_DESC_ORB_SIZE,
  sts1DescriptionFontCqi,
  sts1DescriptionLineCapCenterY,
  sts1DescriptionOrbCenterY,
} from "@/lib/sts1/card-style";
import { sts1BitmapRole } from "@/lib/sts1/bitmap-font";
import { sts1CardUiUrl, sts1DescOrbUrl } from "@/lib/sts1/paths";
import type { GameLocale } from "@/lib/i18n";
import type { Sts1CardStats, Sts1Keyword } from "@/lib/sts1/types";

const ORB_SRC = {
  red: sts1CardUiUrl("card_red_orb"),
  green: sts1CardUiUrl("card_green_orb"),
  blue: sts1CardUiUrl("card_blue_orb"),
  purple: sts1CardUiUrl("card_purple_orb"),
  colorless: sts1CardUiUrl("card_colorless_orb"),
} as const;

function Sts1TextSpanView({
  span,
  gameLocale,
}: {
  span: Sts1TextSpan;
  gameLocale: GameLocale;
}) {
  if (span.kind === "break") return <br />;
  if (span.kind === "energy") {
    return (
      <Image
        src={ORB_SRC[span.orb]}
        alt=""
        width={18}
        height={18}
        className="mx-px inline-block h-[1em] w-[1em] align-[-0.15em] object-contain"
      />
    );
  }
  return (
    <Sts1BitmapText
      text={span.text}
      role="desc"
      gameLocale={gameLocale}
      color={span.color ?? STS1_CREAM}
    />
  );
}

export const Sts1CardText = forwardRef<HTMLParagraphElement, {
  text: string;
  stats: Sts1CardStats;
  keywords?: readonly Sts1Keyword[];
  gameLocale?: GameLocale;
  className?: string;
  style?: CSSProperties;
}>(function Sts1CardText({
  text,
  stats,
  keywords = [],
  gameLocale = "kor",
  className,
  style,
}, ref) {
  const spans = parseSts1CardText(text, stats, keywords);
  return (
    <p ref={ref} className={className} style={style} data-card-description-content>
      {spans.map((span, index) => (
        <Sts1TextSpanView key={index} span={span} gameLocale={gameLocale} />
      ))}
    </p>
  );
});

const DESC_ORB_COLOR = {
  red: "red",
  green: "green",
  blue: "blue",
  purple: "purple",
  colorless: "red",
} as const;

/**
 * Card-face description laid out like AbstractCard.renderDescription: each
 * pre-wrapped line is centered, its cap height centered on the game's line
 * position, and [E] orbs drawn where renderSmallEnergy puts them.
 */
export function Sts1CardDescriptionLines({
  lines,
  stats,
  keywords = [],
  gameLocale = "kor",
}: {
  lines: readonly string[];
  stats: Sts1CardStats;
  keywords?: readonly Sts1Keyword[];
  gameLocale?: GameLocale;
}) {
  const capHeight = sts1BitmapRole(gameLocale, "desc")?.capHeight ?? STS1_DESC_FONT * 0.7;
  const { height } = STS1_CARD_IN_ATLAS;
  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-card-description-viewport
      style={{ fontSize: `${sts1DescriptionFontCqi()}cqi` }}
    >
      {lines.map((line, index) => {
        const baselineY = sts1DescriptionLineCapCenterY(index, lines.length, capHeight) + capHeight / 2;
        const orbBottomY = sts1DescriptionOrbCenterY(index, lines.length, capHeight) + STS1_DESC_ORB_SIZE / 2;
        return (
          <div
            key={index}
            className="absolute inset-x-0 flex items-end justify-center whitespace-nowrap"
            data-card-description-line
            style={{ bottom: `${(1 - baselineY / height) * 100}%` }}
          >
            {parseSts1CardText(line, stats, keywords).map((span, spanIndex) => {
              if (span.kind === "break") return null;
              if (span.kind === "energy") {
                return (
                  <Image
                    key={spanIndex}
                    src={sts1DescOrbUrl(DESC_ORB_COLOR[span.orb])}
                    alt=""
                    width={STS1_DESC_ORB_SIZE}
                    height={STS1_DESC_ORB_SIZE}
                    className="shrink-0"
                    style={{
                      width: `${STS1_DESC_ORB_SIZE / STS1_DESC_FONT}em`,
                      height: `${STS1_DESC_ORB_SIZE / STS1_DESC_FONT}em`,
                      marginBottom: `${(baselineY - orbBottomY) / STS1_DESC_FONT}em`,
                    }}
                  />
                );
              }
              return (
                <Sts1BitmapText
                  key={spanIndex}
                  text={span.text}
                  role="desc"
                  gameLocale={gameLocale}
                  color={span.color ?? STS1_CREAM}
                  baseline
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
