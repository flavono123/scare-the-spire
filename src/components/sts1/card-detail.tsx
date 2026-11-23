"use client";

import { useEffect, useRef, useState } from "react";
import { CardSideTipsAnchor } from "@/components/codex/card-keyword-tip-stack";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { GameUpgradeToggle } from "@/components/codex/game-upgrade-toggle";
import { CompendiumAssetImageActions } from "@/components/codex/compendium-asset-image-actions";
import { Sts1CardTile } from "./card-tile";
import { Sts1CommentsRail } from "./comments-rail";
import { Sts1TinyCard } from "./tiny-card";
import type { Sts1RelatedGroup } from "@/lib/sts1/relations";
import { Sts1RelatedRail } from "./related-rail";
import { Sts1DetailShell } from "./detail-chrome";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { CARD_WIDTH_PRESET } from "@/lib/sts2-card-style";
import { collectSts1CardSideTips } from "@/lib/sts1/keyword-tips";
import { sts1IndexPath } from "@/lib/sts1/paths";
import { sts1CardStats } from "@/lib/sts1/stats";
import type { Sts1Card, Sts1Keyword, Sts1UiLabels } from "@/lib/sts1/types";

function typeLabelFor(card: Sts1Card, labels: Sts1UiLabels): string {
  return card.type === "attack" || card.type === "skill" || card.type === "power"
    || card.type === "curse" || card.type === "status"
    ? labels.types[card.type]
    : card.type;
}

export function Sts1CardDetail({
  card,
  labels,
  keywords = [],
  serviceLocale,
  gameLocale,
  showBeta = false,
  onBetaChange,
  onClose,
  related = [],
}: {
  related?: readonly Sts1RelatedGroup[];
  card: Sts1Card;
  labels: Sts1UiLabels;
  keywords?: readonly Sts1Keyword[];
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  showBeta?: boolean;
  onBetaChange?: (value: boolean) => void;
  onClose?: () => void;
}) {
  const assetCopyTargetRef = useRef<HTMLDivElement>(null);
  const [upgradeLevel, setUpgradeLevel] = useState(0);
  const [localBeta, setLocalBeta] = useState(showBeta);
  const [isDesktop, setIsDesktop] = useState(false);
  const beta = onBetaChange ? showBeta : localBeta;
  const typeLabel = typeLabelFor(card, labels);
  const cardWidth = isDesktop ? CARD_WIDTH_PRESET.detail : CARD_WIDTH_PRESET.hover;
  const stats = sts1CardStats(card, upgradeLevel);
  const description = stats.upgraded && card.upgradeDescription
    ? card.upgradeDescription
    : card.description;
  const sideTips = collectSts1CardSideTips(description, keywords);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("cards")}
      backLabel={labels.cardLibraryTitle}
      onClose={onClose}
      serviceLocale={serviceLocale}
      hero={(
        <div ref={assetCopyTargetRef} className="relative" style={{ width: cardWidth }}>
          <CardSideTipsAnchor mode="always" preferSide="left" tips={sideTips} style={{ width: cardWidth }}>
            <Sts1CardTile
              card={card}
              upgradeLevel={upgradeLevel}
              showBeta={beta}
              keywords={keywords}
              typeLabel={typeLabel}
              gameLocale={gameLocale}
            />
          </CardSideTipsAnchor>
        </div>
      )}
      assetActions={(
        <CompendiumAssetImageActions
          serviceLocale={serviceLocale}
          fileName={`${card.slug}.png`}
          targetRef={assetCopyTargetRef}
        />
      )}
      stageExtra={(
        <div className="flex flex-wrap items-center justify-center gap-2">
          {card.hasBetaArt ? (
            <GameCheckboxToggle
              checked={beta}
              onCheckedChange={(checked) => {
                setLocalBeta(checked);
                onBetaChange?.(checked);
              }}
              label={labels.betaArt}
              size="md"
            />
          ) : null}
          {card.unlimitedUpgrade ? (
            <GameUpgradeToggle
              upgradeLevel={upgradeLevel}
              maxUpgradeLevel={20}
              onUpgradeLevelChange={setUpgradeLevel}
              label={labels.viewUpgrades}
              serviceLocale={serviceLocale}
            />
          ) : (
            <GameCheckboxToggle
              checked={upgradeLevel > 0}
              onCheckedChange={(checked) => setUpgradeLevel(checked ? 1 : 0)}
              label={labels.viewUpgrades}
              size="md"
            />
          )}
        </div>
      )}
    >
      <section
        className="rounded-lg border border-border bg-compendium-rail px-4 py-3"
        data-card-detail-meta
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0" data-card-detail-tiny-card>
            <Sts1TinyCard card={card} width={32} />
          </div>
          {serviceLocale !== "en" && card.nameEn && card.nameEn !== card.name ? (
            <span
              className="min-w-0 truncate font-game-text text-sm text-foreground"
              data-card-detail-english-name
            >
              {card.nameEn}
            </span>
          ) : null}
        </div>
      </section>
      <Sts1RelatedRail groups={related} serviceLocale={serviceLocale} />
      <Sts1CommentsRail
        resourceType="card"
        slug={card.slug}
        serviceLocale={serviceLocale}
      />
    </Sts1DetailShell>
  );
}
