"use client";

import { useEffect, useState } from "react";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { GameUpgradeToggle } from "@/components/codex/game-upgrade-toggle";
import { Sts1CardTile } from "./card-tile";
import { Sts1DetailShell, Sts1MetaPill } from "./detail-chrome";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { CARD_WIDTH_PRESET } from "@/lib/sts2-card-style";
import { sts1PoolColor } from "@/lib/sts1/card-style";
import { sts1IndexPath } from "@/lib/sts1/paths";
import type { Sts1Card, Sts1Keyword, Sts1UiLabels } from "@/lib/sts1/types";

function typeLabelFor(card: Sts1Card, labels: Sts1UiLabels): string {
  return card.type === "attack" || card.type === "skill" || card.type === "power"
    || card.type === "curse" || card.type === "status"
    ? labels.types[card.type]
    : card.type;
}

function rarityLabelFor(card: Sts1Card, labels: Sts1UiLabels): string | null {
  if (card.rarity === "common" || card.rarity === "uncommon" || card.rarity === "rare") {
    return labels.potionRarities[card.rarity];
  }
  if (card.rarity === "special") return labels.extras.special;
  if (card.rarity === "curse") return labels.types.curse;
  return null;
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
}: {
  card: Sts1Card;
  labels: Sts1UiLabels;
  keywords?: readonly Sts1Keyword[];
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  showBeta?: boolean;
  onBetaChange?: (value: boolean) => void;
  onClose?: () => void;
}) {
  const [upgradeLevel, setUpgradeLevel] = useState(0);
  const [localBeta, setLocalBeta] = useState(showBeta);
  const [isDesktop, setIsDesktop] = useState(false);
  const beta = onBetaChange ? showBeta : localBeta;
  const typeLabel = typeLabelFor(card, labels);
  const rarityLabel = rarityLabelFor(card, labels);
  const poolColor = sts1PoolColor(card.color);
  const cardWidth = isDesktop ? CARD_WIDTH_PRESET.detail : CARD_WIDTH_PRESET.hover;

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
        <div className="relative" style={{ width: cardWidth }}>
          <Sts1CardTile
            card={card}
            upgradeLevel={upgradeLevel}
            showBeta={beta}
            keywords={keywords}
            typeLabel={typeLabel}
            gameLocale={gameLocale}
          />
        </div>
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
          <div className="w-8 shrink-0" data-card-detail-tiny-card>
            <Sts1CardTile
              card={card}
              upgradeLevel={upgradeLevel}
              showBeta={beta}
              keywords={keywords}
              typeLabel={typeLabel}
              gameLocale={gameLocale}
            />
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
        <div className="mt-3 flex flex-wrap gap-2">
          <Sts1MetaPill value={typeLabel} />
          {rarityLabel ? <Sts1MetaPill value={rarityLabel} /> : null}
          {card.color === "ironclad" || card.color === "silent" || card.color === "defect" || card.color === "watcher" ? (
            <Sts1MetaPill value={labels.characters[card.color]} color={poolColor} />
          ) : card.color === "colorless" ? (
            <Sts1MetaPill value={labels.extras.colorless} />
          ) : card.color === "curse" ? (
            <Sts1MetaPill value={labels.types.curse} />
          ) : null}
        </div>
      </section>
    </Sts1DetailShell>
  );
}
