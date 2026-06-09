"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AncientDetail } from "@/components/codex/ancient-detail";
import { CardDetail } from "@/components/codex/card-detail";
import { EncounterDetail } from "@/components/codex/encounter-detail";
import { EnchantmentDetail } from "@/components/codex/enchantment-detail";
import { EpochDetail } from "@/components/codex/epoch-detail";
import { EventDetail } from "@/components/codex/event-detail";
import { KeywordDetail } from "@/components/codex/keyword-detail";
import { MonsterDetail } from "@/components/codex/monster-detail";
import { PotionDetail } from "@/components/codex/potion-detail";
import { PowerDetail } from "@/components/codex/power-detail";
import { RelicDetail } from "@/components/codex/relic-detail";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";
import {
  COMPENDIUM_DETAIL_PAYLOAD_PATH,
  type CompendiumDetailPayload,
  type CompendiumDetailResourceType,
} from "@/lib/compendium-detail-payload";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { PotionPool, RelicPool } from "@/lib/codex-types";

type CompendiumDirectDetailPageProps = {
  resourceType: CompendiumDetailResourceType;
  id: string;
};

let payloadPromise: Promise<CompendiumDetailPayload> | null = null;

function fetchDetailPayload(): Promise<CompendiumDetailPayload> {
  payloadPromise ??= fetch(COMPENDIUM_DETAIL_PAYLOAD_PATH)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load ${COMPENDIUM_DETAIL_PAYLOAD_PATH}`);
      }
      return response.json() as Promise<CompendiumDetailPayload>;
    });

  return payloadPromise;
}

function findByRouteId<T extends { id: string }>(
  rows: T[],
  routeId: string,
): T | undefined {
  return rows.find((row) => row.id.toLowerCase() === routeId.toLowerCase());
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isBetaSearchEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("beta")?.toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

function buildRelicPoolLabels(payload: CompendiumDetailPayload): Record<RelicPool, string> {
  const serviceText = getCodexServiceMessages(payload.serviceLocale);
  const poolLabels: Record<RelicPool, string> = {
    shared: serviceText.labels.pools.shared,
    ironclad: serviceText.labels.pools.ironclad,
    silent: serviceText.labels.pools.silent,
    defect: serviceText.labels.pools.defect,
    necrobinder: serviceText.labels.pools.necrobinder,
    regent: serviceText.labels.pools.regent,
  };

  for (const character of payload.resources.characters) {
    poolLabels[character.id.toLowerCase() as RelicPool] = character.name;
  }

  return poolLabels;
}

function buildPotionPoolLabels(payload: CompendiumDetailPayload): Record<PotionPool, string> {
  const serviceText = getCodexServiceMessages(payload.serviceLocale);
  const poolLabels: Record<PotionPool, string> = {
    shared: serviceText.labels.pools.shared,
    event: payload.gameUi.eventsTitle,
    ironclad: serviceText.labels.pools.ironclad,
    silent: serviceText.labels.pools.silent,
    defect: serviceText.labels.pools.defect,
    necrobinder: serviceText.labels.pools.necrobinder,
    regent: serviceText.labels.pools.regent,
  };

  for (const character of payload.resources.characters) {
    poolLabels[character.id.toLowerCase() as PotionPool] = character.name;
  }

  return poolLabels;
}

function buildEntityInfo(payload: CompendiumDetailPayload): EntityInfo[] {
  const {
    afflictions,
    ancients,
    cards,
    enchantments,
    encounters,
    epochs,
    events,
    keywords,
    monsters,
    potions,
    powers,
    relics,
  } = payload.resources;

  return [
    ...cards.map((card) => ({
      id: card.id,
      nameEn: card.nameEn,
      nameKo: card.name,
      imageUrl: card.imageUrl,
      color: card.color,
      type: "card" as const,
      cardData: card,
    })),
    ...keywords.map((keyword) => ({
      id: keyword.id,
      nameEn: keyword.nameEn,
      nameKo: keyword.name,
      imageUrl: keyword.imageUrl,
      href: `/compendium/keywords/${keyword.id.toLowerCase()}`,
      color: keyword.source,
      type: "keyword" as const,
      keywordData: keyword,
    })),
    ...relics.map((relic) => ({
      id: relic.id,
      nameEn: relic.nameEn,
      nameKo: relic.name,
      imageUrl: relic.imageUrl,
      color: relic.pool,
      type: "relic" as const,
      relicData: relic,
    })),
    ...potions.map((potion) => ({
      id: potion.id,
      nameEn: potion.nameEn,
      nameKo: potion.name,
      imageUrl: potion.imageUrl,
      color: potion.pool,
      type: "potion" as const,
      potionData: potion,
    })),
    ...powers.map((power) => ({
      id: power.id,
      nameEn: power.nameEn,
      nameKo: power.name,
      imageUrl: power.imageUrl,
      color: power.type,
      type: "power" as const,
      powerData: power,
    })),
    ...enchantments.map((enchantment) => ({
      id: enchantment.id,
      nameEn: enchantment.nameEn,
      nameKo: enchantment.name,
      imageUrl: enchantment.imageUrl,
      color: enchantment.cardType ?? "Any",
      type: "enchantment" as const,
      enchantmentData: enchantment,
    })),
    ...afflictions.map((affliction) => ({
      id: affliction.id,
      nameEn: affliction.nameEn,
      nameKo: affliction.name,
      imageUrl: affliction.imageUrl,
      color: "affliction",
      type: "affliction" as const,
      afflictionData: affliction,
    })),
    ...events.map((event) => ({
      id: event.id,
      nameEn: event.nameEn,
      nameKo: event.name,
      imageUrl: event.imageUrl,
      color: event.act ?? "none",
      type: "event" as const,
      eventData: event,
    })),
    ...monsters
      .filter((monster) => monster.showInCompendium && isPublicBestiaryMonster(monster.id))
      .map((monster) => ({
        id: monster.id,
        nameEn: monster.nameEn,
        nameKo: monster.name,
        imageUrl: monster.bossImageUrl ?? monster.imageUrl,
        color: monster.type,
        type: "monster" as const,
        monsterData: monster,
      })),
    ...encounters.map((encounter) => ({
      id: encounter.id,
      nameEn: encounter.nameEn,
      nameKo: encounter.name,
      imageUrl: encounter.imageUrl,
      color: encounter.roomType,
      type: "encounter" as const,
      encounterData: encounter,
    })),
    ...ancients.map((ancient) => ({
      id: ancient.id,
      nameEn: ancient.nameEn,
      nameKo: ancient.name,
      imageUrl: ancient.imageUrl,
      color: ancient.act ?? "none",
      type: "ancient" as const,
      ancientData: ancient,
    })),
    ...epochs.map((epoch) => ({
      id: epoch.id,
      nameEn: epoch.nameEn,
      nameKo: epoch.name,
      imageUrl: epoch.imageUrl,
      href: `/compendium/epochs/${epoch.id.toLowerCase()}`,
      color: epoch.affiliation,
      type: "epoch" as const,
      epochData: epoch,
    })),
  ];
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6 font-game-text text-sm text-gray-300">
        {label}
      </main>
    </div>
  );
}

export function CompendiumDirectDetailPage({
  resourceType,
  id,
}: CompendiumDirectDetailPageProps) {
  const [payload, setPayload] = useState<CompendiumDetailPayload | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    fetchDetailPayload()
      .then((nextPayload) => {
        if (active) setPayload(nextPayload);
      })
      .catch((nextError: Error) => {
        if (active) setError(nextError);
      });

    return () => {
      active = false;
    };
  }, []);

  const entities = useMemo(
    () => payload ? buildEntityInfo(payload) : [],
    [payload],
  );

  if (error) {
    return <LoadingState label="상세 정보를 불러오지 못했습니다." />;
  }

  if (!payload) {
    return <LoadingState label="상세 정보를 불러오는 중입니다." />;
  }

  const { serviceLocale, gameUi, history, resources } = payload;
  const { patches, changes, versionDiffs } = history;
  const serviceText = getCodexServiceMessages(serviceLocale);
  const showBetaArt = isBetaSearchEnabled();

  let detail: ReactNode = null;

  if (resourceType === "cards") {
    const card = findByRouteId(resources.cards, id);
    if (card) {
      detail = (
        <CardDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          card={card}
          enchantments={resources.enchantments}
          afflictions={resources.afflictions}
          relatedAncients={resources.ancients}
          relatedEvents={resources.events}
          relatedMonsters={resources.monsters}
          relatedPotions={resources.potions}
          relatedPowers={resources.powers}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
          initialShowBeta={showBetaArt}
          syncBetaSearchParam
        />
      );
    }
  }

  if (resourceType === "relics") {
    const relic = findByRouteId(resources.relics, id);
    if (relic) {
      detail = (
        <RelicDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={gameUi.relicCollectionTitle}
          relic={relic}
          poolLabels={buildRelicPoolLabels(payload)}
          entities={entities}
          relatedCards={resources.cards}
          relatedEvents={resources.events}
          relatedAncients={resources.ancients}
          relatedEnchantments={resources.enchantments}
          relatedPowers={resources.powers}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
        />
      );
    }
  }

  if (resourceType === "potions") {
    const potion = findByRouteId(resources.potions, id);
    if (potion) {
      detail = (
        <PotionDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={gameUi.potionLabTitle}
          potion={potion}
          poolLabels={buildPotionPoolLabels(payload)}
          relatedCards={resources.cards}
          relatedEnchantments={resources.enchantments}
          relatedEvents={resources.events}
          relatedPowers={resources.powers}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
          entities={entities}
        />
      );
    }
  }

  if (resourceType === "powers") {
    const power = findByRouteId(resources.powers, id);
    if (power) {
      detail = (
        <PowerDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={gameUi.nav.powers}
          power={power}
          entities={entities}
          relatedCards={resources.cards}
          relatedRelics={resources.relics}
          relatedPotions={resources.potions}
          relatedEnchantments={resources.enchantments}
          relatedEvents={resources.events}
          relatedMonsters={resources.monsters}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
        />
      );
    }
  }

  if (resourceType === "enchantments") {
    const enchantment = findByRouteId(resources.enchantments, id);
    const affliction = findByRouteId(resources.afflictions, id);
    if (enchantment) {
      detail = (
        <EnchantmentDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={serviceText.enchantmentsView.title}
          enchantment={enchantment}
          entities={entities}
          cards={resources.cards}
          events={resources.events}
          potions={resources.potions}
          powers={resources.powers}
          relics={resources.relics}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
        />
      );
    } else if (affliction) {
      detail = (
        <EnchantmentDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={serviceText.enchantmentsView.title}
          affliction={affliction}
          entities={entities}
          monsters={resources.monsters}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
        />
      );
    }
  }

  if (resourceType === "ancients") {
    const ancient = findByRouteId(resources.ancients, id);
    if (ancient) {
      const ancientRelics = ancient.relicIds
        .map((relicId) => resources.relics.find((relic) => relic.id === relicId))
        .filter(isDefined);

      detail = (
        <AncientDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={gameUi.ancientsTitle}
          ancient={ancient}
          cards={resources.cards}
          relics={ancientRelics}
          entities={entities}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
        />
      );
    }
  }

  if (resourceType === "events") {
    const event = findByRouteId(resources.events, id);
    if (event) {
      detail = (
        <EventDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          event={event}
          cards={resources.cards}
          enchantments={resources.enchantments}
          madScienceBaseCard={resources.madScienceBaseCard}
          potions={resources.potions}
          powers={resources.powers}
          relics={resources.relics}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
        />
      );
    }
  }

  if (resourceType === "keywords") {
    const keyword = findByRouteId(resources.keywords, id);
    if (keyword) {
      detail = (
        <KeywordDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={gameUi.nav.keywords}
          keyword={keyword}
          relatedCards={resources.cards}
          entities={entities}
        />
      );
    }
  }

  if (resourceType === "monsters") {
    const monster = resources.monsters.find((candidate) => (
      candidate.id.toLowerCase() === id.toLowerCase() &&
      candidate.showInCompendium &&
      isPublicBestiaryMonster(candidate.id)
    ));
    if (monster) {
      detail = (
        <MonsterDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={gameUi.bestiaryTitle}
          monster={monster}
          monsters={resources.monsters}
          encounters={resources.encounters}
          afflictions={resources.afflictions}
          cards={resources.cards}
          powers={resources.powers}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
        />
      );
    }
  }

  if (resourceType === "encounters") {
    const encounter = findByRouteId(resources.encounters, id);
    if (encounter) {
      detail = (
        <EncounterDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={serviceText.encountersView.backToList}
          encounter={encounter}
          monsters={resources.monsters}
          patches={patches}
          changes={changes}
        />
      );
    }
  }

  if (resourceType === "epochs") {
    const epoch = findByRouteId(resources.epochs, id);
    if (epoch) {
      detail = (
        <EpochDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          epoch={epoch}
          cards={resources.cards}
          relics={resources.relics}
          potions={resources.potions}
          ancients={resources.ancients}
          epochs={resources.epochs}
          entities={entities}
          initialShowBeta={showBetaArt}
          syncBetaSearchParam
        />
      );
    }
  }

  if (!detail) {
    return <LoadingState label="상세 정보를 찾을 수 없습니다." />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {detail}
    </div>
  );
}
