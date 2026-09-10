"use client";

import { useLayoutEffect, useRef } from "react";
import Image from "@/components/ui/static-image";
import { Sts1BitmapText } from "./bitmap-text";
import { Sts1CardText } from "./description";
import {
  CARD_DESCRIPTION_SAFE_HEIGHT_RATIO,
  fitCardDescriptionText,
} from "@/lib/card-description-fit";
import {
  STS1_ATLAS_LAYER_STYLE,
  STS1_CARD_ASPECT,
  STS1_CREAM,
  STS1_ENERGY_FILL,
  STS1_ENERGY_MODIFIED,
  STS1_GREEN_TEXT,
  STS1_DESC_MIN_FONT_SCALE,
  sts1CardBannerRegion,
  sts1CardBackgroundRegion,
  sts1CardBodyStyle,
  sts1CardFrameRegion,
  sts1CardOrbRegion,
  sts1DescriptionBox,
  sts1DescriptionFontCqi,
  sts1DescriptionTextStyle,
  sts1EnergyCostBox,
  sts1EnergyCostTextStyle,
  sts1PortraitBox,
  sts1TitleBox,
  sts1TitleTextStyle,
  sts1TypeBannerPieces,
  sts1TypeBox,
} from "@/lib/sts1/card-style";
import type { GameLocale } from "@/lib/i18n";
import { sts1HtmlLang } from "@/lib/sts1/locale";
import { sts1CardPortraitUrl, sts1CardUi512Url } from "@/lib/sts1/paths";
import { wrapSts1DescriptionLines } from "@/lib/sts1/description";
import { sts1CardStats, sts1CostLabel } from "@/lib/sts1/stats";
import type { Sts1Card, Sts1Keyword } from "@/lib/sts1/types";

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
  const descriptionViewportRef = useRef<HTMLDivElement>(null);
  const descriptionContentRef = useRef<HTMLParagraphElement>(null);
  const descriptionFontCqi = sts1DescriptionFontCqi();

  useLayoutEffect(() => {
    const viewport = descriptionViewportRef.current;
    const content = descriptionContentRef.current;
    if (!viewport || !content) return;

    const measure = () => {
      fitCardDescriptionText({
        viewport,
        content,
        baseFontCqi: descriptionFontCqi,
        minimumFontScale: STS1_DESC_MIN_FONT_SCALE,
        availableHeightRatio: CARD_DESCRIPTION_SAFE_HEIGHT_RATIO,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [descriptionFontCqi, descriptionLines, gameLocale, title]);

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
          className="absolute z-10 flex items-center justify-center leading-none"
          style={{
            ...sts1EnergyCostBox(),
            ...sts1EnergyCostTextStyle(),
          }}
        >
          <Sts1BitmapText
            text={costLabel}
            role="energy"
            gameLocale={gameLocale}
            color={upgradedCost ? STS1_ENERGY_MODIFIED : STS1_ENERGY_FILL}
          />
        </span>
      ) : null}
      <h3
        className="absolute z-10 flex items-center justify-center overflow-hidden whitespace-nowrap text-center leading-none"
        aria-label={title}
        style={{
          ...sts1TitleBox(title, stats.cost),
          ...sts1TitleTextStyle(stats.upgraded),
        }}
      >
        <Sts1BitmapText
          text={title}
          role="title"
          gameLocale={gameLocale}
          color={stats.upgraded ? STS1_GREEN_TEXT : STS1_CREAM}
        />
      </h3>
      <div
        className="absolute z-10 flex items-center justify-center leading-none"
        style={{
          ...sts1TypeBox(),
        }}
      >
        <Sts1BitmapText
          text={typeLabel}
          role="type"
          gameLocale={gameLocale}
          color={STS1_CREAM}
        />
      </div>
      <div
        ref={descriptionViewportRef}
        className="absolute z-10 flex flex-col items-center justify-center overflow-hidden"
        data-card-description-viewport
        style={sts1DescriptionBox(gameLocale)}
      >
        <Sts1CardText
          ref={descriptionContentRef}
          text={descriptionLines.join(" NL ")}
          stats={stats}
          keywords={keywords}
          gameLocale={gameLocale}
          className="max-w-full text-center"
          style={{
            ...sts1DescriptionTextStyle(gameLocale),
            whiteSpace: "nowrap",
          }}
        />
      </div>
      </div>
    </article>
  );
}
