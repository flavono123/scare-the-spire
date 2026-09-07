"use client";

import Link from "next/link";
import { useState } from "react";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { Sts1CardTile } from "./card-tile";
import { Sts1CardText } from "./description";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { sts1IndexPath } from "@/lib/sts1/paths";
import { sts1CardStats } from "@/lib/sts1/stats";
import type { Sts1Card, Sts1Keyword, Sts1UiLabels } from "@/lib/sts1/types";

export function Sts1CardDetail({
  card,
  labels,
  keywords = [],
  serviceLocale,
  showBeta = false,
  onBetaChange,
}: {
  card: Sts1Card;
  labels: Sts1UiLabels;
  keywords?: readonly Sts1Keyword[];
  serviceLocale: ServiceLocale;
  showBeta?: boolean;
  onBetaChange?: (value: boolean) => void;
}) {
  const [upgradeLevel, setUpgradeLevel] = useState(card.unlimitedUpgrade ? 0 : 0);
  const [localBeta, setLocalBeta] = useState(showBeta);
  const beta = onBetaChange ? showBeta : localBeta;
  const stats = sts1CardStats(card, upgradeLevel);
  const description = stats.upgraded && card.upgradeDescription
    ? card.upgradeDescription
    : card.description;
  const maxStepper = card.unlimitedUpgrade ? 20 : 1;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:flex-row">
      <div className="mx-auto w-[min(100%,280px)] shrink-0">
        <Sts1CardTile
          card={card}
          upgradeLevel={upgradeLevel}
          showBeta={beta}
          keywords={keywords}
        />
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={localizeHref(sts1IndexPath("cards"), serviceLocale)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {labels.cardLibraryTitle}
        </Link>
        <h1 className="mt-3 font-game-title text-2xl text-primary">
          {card.name}
          {stats.nameSuffix}
        </h1>
        <p className="text-sm text-muted-foreground">{card.id}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>
            {card.type === "attack" || card.type === "skill" || card.type === "power"
              || card.type === "curse" || card.type === "status"
              ? labels.types[card.type]
              : card.type}
          </span>
          {card.rarity === "common" || card.rarity === "uncommon" || card.rarity === "rare" ? (
            <span>{labels.potionRarities[card.rarity]}</span>
          ) : card.rarity === "special" ? (
            <span>{labels.extras.special}</span>
          ) : card.rarity === "curse" ? (
            <span>{labels.types.curse}</span>
          ) : null}
        </div>
        <Sts1CardText
          text={description}
          stats={stats}
          keywords={keywords}
          className="mt-4 font-game-text text-sm leading-relaxed text-foreground"
        />
        <div className="mt-5 flex flex-col gap-2">
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
            <label className="flex items-center gap-2 text-sm">
              <span>{labels.viewUpgrades}</span>
              <input
                type="number"
                min={0}
                max={maxStepper}
                value={upgradeLevel}
                onChange={(event) => setUpgradeLevel(Number(event.target.value) || 0)}
                className="h-8 w-16 rounded border border-border bg-background px-2"
              />
            </label>
          ) : (
            <GameCheckboxToggle
              checked={upgradeLevel > 0}
              onCheckedChange={(checked) => setUpgradeLevel(checked ? 1 : 0)}
              label={labels.viewUpgrades}
              size="sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}
