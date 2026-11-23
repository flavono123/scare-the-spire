import type { CSSProperties } from "react";
import { sts1TinyCardUrl } from "@/lib/sts1/paths";
import type { Sts1Card } from "@/lib/sts1/types";

// TinyCard's packed colors (RGBA8888) by card color, and the banner by rarity.
const BACKGROUND: Record<string, string> = {
  ironclad: "#d52323", silent: "#6ad45b", defect: "#69c0ff", watcher: "#9d39e3", colorless: "#7a7a7a", curse: "#3b383c",
};
const DESCRIPTION: Record<string, string> = {
  ironclad: "#603232", silent: "#355739", defect: "#547dad", watcher: "#6012b0", colorless: "#404040", curse: "#1b1b1b",
};
const BANNER: Record<string, string> = { uncommon: "#8cf0f6", rare: "#f9d567" };

function Tinted({ layer, color }: { layer: string; color: string }) {
  const mask = `url(${sts1TinyCardUrl(layer)})`;
  const style: CSSProperties = { backgroundColor: color, maskImage: mask, WebkitMaskImage: mask, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" };
  return <span className="absolute inset-0" style={style} />;
}

function Plain({ layer }: { layer: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={sts1TinyCardUrl(layer)} alt="" className="absolute inset-0 h-full w-full" />;
}

/**
 * Run history's TinyCard: card back and text box tinted by color, the type's portrait,
 * and a banner tinted by rarity, all drawn over one square (TinyCard.renderTinyCardIcon).
 */
export function Sts1TinyCard({ card, width = 32 }: { card: Pick<Sts1Card, "color" | "type" | "rarity">; width?: number }) {
  const portrait = card.type === "attack" ? "attackPortrait" : card.type === "power" ? "powerPortrait" : "skillPortrait";
  return (
    <span className="relative inline-block shrink-0" style={{ width, height: width }} aria-hidden data-sts1-tiny-card="">
      <Tinted layer="cardBack" color={BACKGROUND[card.color] ?? "#ff69b4"} />
      <Tinted layer="descBox" color={DESCRIPTION[card.color] ?? "#b2497d"} />
      <Plain layer="portraitShadow" />
      <Plain layer={portrait} />
      <Plain layer="bannerShadow" />
      <Tinted layer="banner" color={BANNER[card.rarity] ?? "#aeaeae"} />
    </span>
  );
}
