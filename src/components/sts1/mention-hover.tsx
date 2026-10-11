"use client";

import { useState } from "react";
import Image from "@/components/ui/static-image";
import { CardSideTipsAnchor } from "@/components/codex/card-keyword-tip-stack";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { GameResourcePreview } from "@/components/patch-note-renderer";
import { useSts1MentionIndex } from "@/hooks/use-sts1-mention-index";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { STS1_CREAM } from "@/lib/sts1/card-style";
import { EMPTY_STS1_STATS } from "@/lib/sts1/description";
import { collectSts1CardSideTips } from "@/lib/sts1/keyword-tips";
import type { Sts1Keyword, Sts1RelicTier, Sts1UiLabels } from "@/lib/sts1/types";
import type { Sts1MentionEntry } from "@/lib/sts1-mention-index";
import { Sts1BitmapText } from "./bitmap-text";
import { Sts1CardText } from "./description";
import { Sts1CardTile } from "./card-tile";

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
  const gameLocale = useGameLocale();
  return (
    <CardSideTipsAnchor
      tips={collectSts1CardSideTips(entry.description, keywords)}
      mode="always"
      preferSide="right"
      className="w-[15.5rem]"
    >
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${PANEL.width} / ${PANEL.height}` }}>
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
        <div className="absolute inset-x-[10%] top-[7%] flex justify-center">
          <Sts1BitmapText text={entry.nameKo} role="title" gameLocale={gameLocale} color={STS1_CREAM} />
        </div>
        <div className="absolute inset-x-[10%] top-[14%] flex justify-center">
          <Sts1BitmapText
            text={`${relicTierName(labels, entry.tier)}${suffix}`}
            role="desc"
            gameLocale={gameLocale}
            color={STS1_CREAM}
          />
        </div>
        <div className="absolute inset-x-[8%] top-[54%] text-center">
          <Sts1CardText
            text={entry.description}
            stats={EMPTY_STS1_STATS}
            keywords={keywords}
            gameLocale={gameLocale}
            className="text-center text-sm leading-snug"
          />
        </div>
        {entry.flavor ? (
          <div className="absolute inset-x-[8%] top-[68%] text-center">
            <Sts1CardText
              text={entry.flavor}
              stats={EMPTY_STS1_STATS}
              gameLocale={gameLocale}
              className="text-center leading-snug"
            />
          </div>
        ) : null}
      </div>
    </CardSideTipsAnchor>
  );
}

export function Sts1MentionHover({ entityId, text }: { entityId: string; text: string }) {
  const { index } = useSts1MentionIndex();
  const serviceLocale = useServiceLocale();
  const gameLocale = useGameLocale();
  const [hovered, setHovered] = useState(false);
  const entry = index?.entries.find((item) => item.id === entityId);
  const localeKey = serviceLocale === "en" ? "eng" : "kor";
  const labels = index?.labels[localeKey];
  let preview = null;
  if (entry?.resource === "cards" && entry.card && labels) {
    const typeKey = entry.card.type;
    const typeLabel = typeKey === "attack" || typeKey === "skill" || typeKey === "power" || typeKey === "curse" || typeKey === "status"
      ? labels.types[typeKey]
      : entry.card.type;
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
        <Sts1CardText
          text={entry.description}
          stats={EMPTY_STS1_STATS}
          keywords={index?.keywords ?? []}
          gameLocale={gameLocale}
        />
      </GameResourcePreview>
    );
  }

  return (
    <span
      className="relative inline cursor-help font-semibold spire-gold"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <a href={entry?.href ?? "#"} className="font-game-title font-semibold spire-gold no-underline">
        {text}
      </a>
      {hovered && preview ? (
        <PortaledHoverTipLayer pin="top-left">
          {preview}
        </PortaledHoverTipLayer>
      ) : null}
    </span>
  );
}
