"use client";

import type { CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import { Sts1CardText } from "./description";
import {
  STS1_ATLAS_LAYER_STYLE,
  STS1_CARD_ASPECT,
  sts1CardBannerRegion,
  sts1CardBackgroundRegion,
  sts1CardFrameRegion,
  sts1CardOrbRegion,
  sts1PortraitBox,
  sts1TypeBannerPieces,
} from "@/lib/sts1/card-style";
import { sts1CardPortraitUrl, sts1CardUi512Url } from "@/lib/sts1/paths";
import { sts1CardStats, sts1CostLabel } from "@/lib/sts1/stats";
import type { Sts1Card, Sts1Keyword } from "@/lib/sts1/types";

const TITLE_STROKE: CSSProperties = {
  color: "#f8e8c0",
  textShadow: "0 1px 2px #000, 0 0 3px #000",
  WebkitTextStroke: "0.04em #000",
  paintOrder: "stroke fill",
};

function AtlasLayer({ src }: { src: string }) {
  return (
    <div
      className="pointer-events-none absolute bg-no-repeat"
      style={{
        ...STS1_ATLAS_LAYER_STYLE,
        backgroundImage: `url("${src}")`,
        backgroundSize: "100% 100%",
      }}
    />
  );
}

export function Sts1CardTile({
  card,
  upgradeLevel = 0,
  showBeta = false,
  keywords = [],
  typeLabel,
}: {
  card: Sts1Card;
  upgradeLevel?: number;
  showBeta?: boolean;
  keywords?: readonly Sts1Keyword[];
  typeLabel: string;
}) {
  const stats = sts1CardStats(card, upgradeLevel);
  const description = stats.upgraded && card.upgradeDescription
    ? card.upgradeDescription
    : card.description;
  const costLabel = sts1CostLabel(stats.cost);
  const upgradedCost = stats.upgraded && card.upgrade?.cost != null;

  return (
    <article
      className="relative w-full overflow-visible font-game-title"
      style={{ aspectRatio: STS1_CARD_ASPECT, containerType: "inline-size" }}
    >
      <AtlasLayer src={sts1CardUi512Url("card_shadow")} />
      <AtlasLayer src={sts1CardUi512Url(sts1CardBackgroundRegion(card))} />
      <div className="absolute overflow-hidden" style={sts1PortraitBox(card)}>
        <Image
          src={sts1CardPortraitUrl(card, showBeta)}
          alt=""
          fill
          className="h-full w-full object-cover"
          sizes="250px"
          loading="lazy"
        />
      </div>
      <AtlasLayer src={sts1CardUi512Url(sts1CardFrameRegion(card))} />
      <AtlasLayer src={sts1CardUi512Url(sts1CardBannerRegion(card))} />
      {sts1TypeBannerPieces(card).map(([piece, region]) => (
        <AtlasLayer key={piece} src={sts1CardUi512Url(region)} />
      ))}
      <AtlasLayer src={sts1CardUi512Url(sts1CardOrbRegion(card))} />
      {costLabel ? (
        <span
          className="absolute z-10 font-bold leading-none"
          style={{
            left: "2%",
            top: "5.5%",
            width: "18%",
            textAlign: "center",
            fontSize: "10.7cqi",
            color: upgradedCost ? "#7fff00" : "#fff",
            textShadow: "0 1px 2px #000, 0 0 4px #000",
          }}
        >
          {costLabel}
        </span>
      ) : null}
      <h3
        className="absolute z-10 truncate text-center font-bold leading-tight"
        style={{
          left: "18%",
          right: "8%",
          top: "6.5%",
          fontSize: "8.2cqi",
          ...TITLE_STROKE,
        }}
      >
        {card.name}
        {stats.nameSuffix}
      </h3>
      <div
        className="absolute z-10 flex items-center justify-center font-game-text leading-none"
        style={{
          left: "22%",
          right: "22%",
          top: "52%",
          height: "5.5%",
          fontSize: "5.1cqi",
          color: "#f8e8c0",
          textShadow: "0 1px 2px #000",
        }}
      >
        {typeLabel}
      </div>
      <div
        className="absolute z-10 overflow-hidden"
        style={{ left: "12%", right: "12%", top: "59%", bottom: "8%" }}
      >
        <Sts1CardText
          text={description}
          stats={stats}
          keywords={keywords}
          className="font-game-text text-center leading-[1.18] text-[#f8e8c0]"
          style={{ fontSize: "5.6cqi" }}
        />
      </div>
    </article>
  );
}
