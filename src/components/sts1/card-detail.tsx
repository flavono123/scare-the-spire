"use client";

import { useState } from "react";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { GameUpgradeToggle } from "@/components/codex/game-upgrade-toggle";
import { Sts1CardTile } from "./card-tile";
import { Sts1CardText } from "./description";
import { Sts1DetailShell, Sts1EnglishName, Sts1MetaPill } from "./detail-chrome";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { sts1PoolColor } from "@/lib/sts1/card-style";
import { sts1IndexPath } from "@/lib/sts1/paths";
import { sts1CardStats } from "@/lib/sts1/stats";
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
  const beta = onBetaChange ? showBeta : localBeta;
  const stats = sts1CardStats(card, upgradeLevel);
  const description = stats.upgraded && card.upgradeDescription
    ? card.upgradeDescription
    : card.description;
  const typeLabel = typeLabelFor(card, labels);
  const rarityLabel = rarityLabelFor(card, labels);
  const poolColor = sts1PoolColor(card.color);

  return (
    <Sts1DetailShell
      backHref={sts1IndexPath("cards")}
      backLabel={labels.cardLibraryTitle}
      onClose={onClose}
      serviceLocale={serviceLocale}
      hero={(
        <div className="w-[min(100%,300px)]">
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
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <h1 className="font-game-title text-2xl text-primary">
          {card.name}
          {stats.nameSuffix}
        </h1>
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
        <div className="mt-3">
          <Sts1EnglishName name={card.name} nameEn={card.nameEn} serviceLocale={serviceLocale} />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <Sts1CardText
          text={description}
          stats={stats}
          keywords={keywords}
          className="font-game-text text-sm leading-relaxed text-foreground"
        />
      </section>
      <div className="flex flex-col gap-2">
        {card.hasBetaArt ? (
          <GameCheckboxToggle
            checked={beta}
            onCheckedChange={(checked) => {
              setLocalBeta(checked);
              onBetaChange?.(checked);
            }}
            label={labels.betaArt}
            size="sm"
          />
        ) : null}
        {card.unlimitedUpgrade ? (
          <GameUpgradeToggle
            upgradeLevel={upgradeLevel}
            maxUpgradeLevel={20}
            onUpgradeLevelChange={setUpgradeLevel}
            label={labels.viewUpgrades}
            serviceLocale={serviceLocale}
            checkboxSize="sm"
          />
        ) : (
          <GameCheckboxToggle
            checked={upgradeLevel > 0}
            onCheckedChange={(checked) => setUpgradeLevel(checked ? 1 : 0)}
            label={labels.viewUpgrades}
            size="sm"
          />
        )}
      </div>
    </Sts1DetailShell>
  );
}
