"use client";

import Image from "@/components/ui/static-image";
import { Sts1BitmapText } from "./bitmap-text";
import { Sts1CardDescriptionLines } from "./description";
import {
  STS1_ATLAS_LAYER_STYLE,
  STS1_CARD_ASPECT,
  STS1_CREAM,
  STS1_ENERGY_FILL,
  STS1_ENERGY_MODIFIED,
  STS1_GREEN_TEXT,
  STS1_TYPE_COLOR,
  sts1CardBannerRegion,
  sts1CardBackgroundRegion,
  sts1CardBodyStyle,
  sts1CardFrameRegion,
  sts1CardOrbRegion,
  sts1EnergyCostBox,
  sts1EnergyCostTextStyle,
  sts1PortraitBox,
  sts1TitleBox,
  sts1TitleTextStyle,
  sts1TypeBannerLayers,
  sts1TypeBox,
} from "@/lib/sts1/card-style";
import type { GameLocale } from "@/lib/i18n";
import { measureBitmapText, sts1BitmapRole } from "@/lib/sts1/bitmap-font";
import { sts1HtmlLang } from "@/lib/sts1/locale";
import { sts1CardPortraitUrl, sts1CardUi512Url } from "@/lib/sts1/paths";
import { wrapSts1DescriptionLines } from "@/lib/sts1/description";
import { sts1CardStats, sts1CostLabel, sts1ShowsEnergyOrb } from "@/lib/sts1/stats";
import type { Sts1Card, Sts1Keyword } from "@/lib/sts1/types";

function AtlasLayer({ src, transform }: { src: string; transform?: string }) {
  return (
    <div
      className="pointer-events-none absolute bg-no-repeat"
      style={{
        ...STS1_ATLAS_LAYER_STYLE,
        backgroundImage: `url("${src}")`,
        backgroundSize: "100% 100%",
        transform,
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
  const showEnergyOrb = sts1ShowsEnergyOrb(stats.cost);
  const upgradedCost = stats.upgraded && card.upgrade?.cost != null;
  const typeRole = sts1BitmapRole(gameLocale, "type");
  const typeLabelWidth = typeRole ? measureBitmapText(typeRole, typeLabel).width : 0;
  const titleRole = sts1BitmapRole(gameLocale, "title");
  const titleWidth = titleRole ? measureBitmapText(titleRole, title).width : 0;

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
      <div className="absolute" style={sts1PortraitBox(card, showBeta)}>
        <Image
          src={sts1CardPortraitUrl(card, showBeta)}
          alt=""
          fill
          className="h-full w-full"
          sizes="250px"
          loading="lazy"
        />
      </div>
      <AtlasLayer src={sts1CardUi512Url(sts1CardFrameRegion(card))} />
      {sts1TypeBannerLayers(card, typeLabelWidth).map(({ piece, region, transform }) => (
        <AtlasLayer key={piece} src={sts1CardUi512Url(region)} transform={transform} />
      ))}
      <AtlasLayer src={sts1CardUi512Url(sts1CardBannerRegion(card))} />
      {showEnergyOrb ? (
        <>
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
        </>
      ) : null}
      <h3
        className="absolute z-10 flex items-end justify-center whitespace-nowrap text-center leading-none"
        aria-label={title}
        style={{
          ...sts1TitleBox(titleWidth, stats.cost, titleRole?.capHeight ?? 0),
          ...sts1TitleTextStyle(stats.upgraded),
        }}
      >
        <Sts1BitmapText
          text={title}
          role="title"
          gameLocale={gameLocale}
          color={stats.upgraded ? STS1_GREEN_TEXT : STS1_CREAM}
          baseline
        />
      </h3>
      <div
        className="absolute z-10 flex items-end justify-center leading-none"
        style={sts1TypeBox(typeRole?.capHeight ?? 0)}
      >
        <Sts1BitmapText
          text={typeLabel}
          role="type"
          gameLocale={gameLocale}
          color={STS1_TYPE_COLOR}
          baseline
        />
      </div>
      <div className="absolute inset-0 z-10">
        <Sts1CardDescriptionLines
          lines={descriptionLines}
          stats={stats}
          keywords={keywords}
          gameLocale={gameLocale}
        />
      </div>
      </div>
    </article>
  );
}
