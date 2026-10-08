"use client";

import type { CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import { EMPTY_STS1_STATS, parseSts1CardText } from "@/lib/sts1/description";
import { sts1CardUiUrl } from "@/lib/sts1/paths";

const ORB_REGION = {
  red: "card_red_orb",
  green: "card_green_orb",
  blue: "card_blue_orb",
  purple: "card_purple_orb",
  colorless: "card_colorless_orb",
} as const;

/** FontHelper.renderSmartText with a TTF font: #-color words, NL breaks, [E] orbs. */
export function Sts1SmartText({
  text,
  color,
  className,
  style,
}: {
  text: string;
  color: string;
  className?: string;
  style?: CSSProperties;
}) {
  const spans = parseSts1CardText(text, EMPTY_STS1_STATS);
  return (
    <span className={className} style={style}>
      {spans.map((span, index) => {
        if (span.kind === "break") return <br key={index} />;
        if (span.kind === "energy") {
          return (
            <Image
              key={index}
              src={sts1CardUiUrl(ORB_REGION[span.orb])}
              alt=""
              width={24}
              height={24}
              className="mx-px inline-block h-[1em] w-[1em] align-[-0.15em] object-contain"
            />
          );
        }
        return (
          <span key={index} style={{ color: span.color ?? color }}>
            {span.text}
          </span>
        );
      })}
    </span>
  );
}

/** FreeType border + shadow from FontHelper.param, approximated with text-shadow rings. */
export function gdxFontEffects({
  border = 0,
  borderColor = "rgba(0,0,0,0.33)",
  shadowX = 0,
  shadowY = 0,
  shadowColor = "rgba(0,0,0,0.25)",
}: {
  border?: number;
  borderColor?: string;
  shadowX?: number;
  shadowY?: number;
  shadowColor?: string;
}): string {
  const shadows: string[] = [];
  if (border > 0) {
    const rings = border > 2 ? [border, border / 2] : [border];
    for (const radius of rings) {
      for (let step = 0; step < 16; step += 1) {
        const angle = (step / 16) * Math.PI * 2;
        shadows.push(`${(Math.cos(angle) * radius).toFixed(2)}px ${(Math.sin(angle) * radius).toFixed(2)}px 0 ${borderColor}`);
      }
    }
  }
  if (shadowX || shadowY) shadows.push(`${shadowX}px ${shadowY}px 0 ${shadowColor}`);
  return shadows.join(", ");
}
