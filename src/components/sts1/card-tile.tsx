"use client";

import type { CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import { Sts1CardText } from "./description";
import {
  STS1_ATLAS_LAYER_STYLE,
  STS1_CARD_ASPECT,
  STS1_CREAM,
  STS1_ENERGY_FILL,
  STS1_ENERGY_MODIFIED,
  STS1_TITLE_BORDER,
  STS1_TITLE_BORDER_WIDTH,
  sts1CardBannerRegion,
  sts1CardBackgroundRegion,
  sts1CardBodyStyle,
  sts1CardFrameRegion,
  sts1CardOrbRegion,
  sts1DescriptionBox,
  sts1DescriptionTextStyle,
  sts1EnergyCostBox,
  sts1EnergyCostTextStyle,
  sts1FreeTypeStroke,
  sts1PortraitBox,
  sts1TitleBox,
  sts1TypeBannerPieces,
  sts1TypeBox,
} from "@/lib/sts1/card-style";
import type { GameLocale } from "@/lib/i18n";
import { sts1HtmlLang } from "@/lib/sts1/locale";
import { sts1CardPortraitUrl, sts1CardUi512Url } from "@/lib/sts1/paths";
import { wrapSts1DescriptionLines } from "@/lib/sts1/description";
import { sts1CardStats, sts1CostLabel } from "@/lib/sts1/stats";
import type { Sts1Card, Sts1Keyword } from "@/lib/sts1/types";

const TITLE_STROKE: CSSProperties = {
  color: STS1_CREAM,
  ...sts1FreeTypeStroke(STS1_TITLE_BORDER, STS1_TITLE_BORDER_WIDTH),
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
  gameLocale = "kor",
}: {
  card: Sts1Card;
  upgradeLevel?: number;
  showBeta?: boolean;
  keywords?: readonly Sts1Keyword[];
  typeLabel: string;
  gameLocale?: GameLocale;
}) {
  const stats = sts1CardStats(card, upgradeLevel);
  const description = stats.upgraded && card.upgradeDescription
    ? card.upgradeDescription
    : card.description;
  const descriptionLines = wrapSts1DescriptionLines(description, stats, gameLocale);
  const title = `${card.name}${stats.nameSuffix}`;
  const costLabel = sts1CostLabel(stats.cost);
  const upgradedCost = stats.upgraded && card.upgrade?.cost != null;

  return (
    <article
      className="relative w-full overflow-visible"
      lang={sts1HtmlLang(gameLocale)}
      data-game-locale={gameLocale}
      style={{ aspectRatio: STS1_CARD_ASPECT }}
    >
      <div
        className="absolute overflow-visible font-game-title"
        style={{ ...sts1CardBodyStyle(), containerType: "inline-size" }}
      >
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
          className="absolute z-10 flex items-center justify-center font-bold leading-none"
          style={{
            ...sts1EnergyCostBox(),
            ...sts1EnergyCostTextStyle(),
            color: upgradedCost ? STS1_ENERGY_MODIFIED : STS1_ENERGY_FILL,
          }}
        >
          {costLabel}
        </span>
      ) : null}
      <h3
        className="absolute z-10 flex items-center justify-center overflow-hidden whitespace-nowrap text-center font-bold leading-none"
        style={{
          ...sts1TitleBox(title, stats.cost),
          ...TITLE_STROKE,
        }}
      >
        {title}
      </h3>
      <div
        className="absolute z-10 flex items-center justify-center font-game-text leading-none"
        style={{
          ...sts1TypeBox(),
          color: STS1_CREAM,
        }}
      >
        {typeLabel}
      </div>
      <div
        className="absolute z-10 overflow-hidden"
        style={sts1DescriptionBox(gameLocale, descriptionLines.length)}
      >
        <Sts1CardText
          text={descriptionLines.join(" NL ")}
          stats={stats}
          keywords={keywords}
          className="font-game-text text-center"
          style={{
            ...sts1DescriptionTextStyle(gameLocale),
            color: STS1_CREAM,
            textShadow: "1px 1px 0 rgba(0,0,0,0.25)",
            whiteSpace: "nowrap",
          }}
        />
      </div>
      </div>
    </article>
  );
}
