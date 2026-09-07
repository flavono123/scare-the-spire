"use client";

import Image from "@/components/ui/static-image";
import { Sts1CardText } from "./description";
import {
  sts1CardBannerRegion,
  sts1CardBackgroundRegion,
  sts1CardFrameRegion,
  sts1CardOrbRegion,
} from "@/lib/sts1/card-style";
import { sts1CardPortraitUrl, sts1CardUiUrl } from "@/lib/sts1/paths";
import { sts1CardStats, sts1CostLabel } from "@/lib/sts1/stats";
import type { Sts1Card, Sts1Keyword } from "@/lib/sts1/types";

export function Sts1CardTile({
  card,
  upgradeLevel = 0,
  showBeta = false,
  keywords = [],
}: {
  card: Sts1Card;
  upgradeLevel?: number;
  showBeta?: boolean;
  keywords?: readonly Sts1Keyword[];
}) {
  const stats = sts1CardStats(card, upgradeLevel);
  const description = stats.upgraded && card.upgradeDescription
    ? card.upgradeDescription
    : card.description;
  const costLabel = sts1CostLabel(stats.cost);

  return (
    <article
      className="relative w-full overflow-hidden font-game-title text-[#f8e8c0]"
      style={{ aspectRatio: "300 / 420" }}
    >
      <Image
        src={sts1CardUiUrl(sts1CardBackgroundRegion(card))}
        alt=""
        fill
        className="object-contain"
        sizes="200px"
      />
      <div className="absolute inset-[14%_10%_46%_10%] overflow-hidden">
        <Image
          src={sts1CardPortraitUrl(card, showBeta)}
          alt=""
          fill
          className="object-cover object-top"
          sizes="200px"
        />
      </div>
      <Image
        src={sts1CardUiUrl(sts1CardFrameRegion(card))}
        alt=""
        fill
        className="object-contain"
        sizes="200px"
      />
      <Image
        src={sts1CardUiUrl(sts1CardBannerRegion(card))}
        alt=""
        fill
        className="object-contain"
        sizes="200px"
      />
      {costLabel ? (
        <div className="absolute left-[1%] top-[1%] flex h-[22%] w-[22%] items-center justify-center">
          <Image
            src={sts1CardUiUrl(sts1CardOrbRegion(card))}
            alt=""
            fill
            className="object-contain"
            sizes="48px"
          />
          <span
            className={`relative z-10 text-[1.35em] font-bold leading-none ${stats.upgraded && card.upgrade?.cost != null ? "text-[#7fff00]" : "text-white"}`}
            style={{ textShadow: "0 1px 2px #000, 0 0 4px #000" }}
          >
            {costLabel}
          </span>
        </div>
      ) : null}
      <h3
        className="absolute left-[18%] right-[8%] top-[7%] truncate text-center text-[0.72em] font-bold leading-tight"
        style={{ textShadow: "0 1px 2px #000, 0 0 3px #000" }}
      >
        {card.name}
        {stats.nameSuffix}
      </h3>
      <div className="absolute inset-[66%_10%_8%_10%] overflow-hidden">
        <Sts1CardText
          text={description}
          stats={stats}
          keywords={keywords}
          className="font-game-text text-center text-[0.58em] leading-snug text-[#f8e8c0]"
        />
      </div>
    </article>
  );
}
