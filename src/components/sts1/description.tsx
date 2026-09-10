"use client";

import { forwardRef, type CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import { Sts1BitmapText } from "./bitmap-text";
import { parseSts1CardText, type Sts1TextSpan } from "@/lib/sts1/description";
import { STS1_CREAM } from "@/lib/sts1/card-style";
import { sts1CardUiUrl } from "@/lib/sts1/paths";
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
