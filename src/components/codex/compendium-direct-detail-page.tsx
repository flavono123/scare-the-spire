"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import { AncientDetail } from "@/components/codex/ancient-detail";
import { CardDetail } from "@/components/codex/card-detail";
import { CharacterDetail } from "@/components/codex/character-detail";
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
import { versionCodexEntities, versionCodexEntity, type CodexVersionContext } from "@/lib/codex-versioning";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import { latestPatchVersion, resolveKnownVersion } from "@/lib/entity-versioning";
import type { EntityLifecycle } from "@/lib/entity-lifecycle";
import type { VersionedEntityType } from "@/lib/types";
import {
  loadCompendiumDetailPayload,
  type CompendiumDetailPayload,
  type CompendiumDetailResourceType,
} from "@/lib/compendium-detail-payload";
import type { CompendiumDetailSeoSummary } from "@/lib/compendium-detail-metadata";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { toEventCharacterQuoteSpeaker } from "@/lib/event-character-quotes";
import { useHydrationSafePathname, useHydrationSafeSearchParam } from "@/components/codex/use-hydration-safe-search-param";
import { getGameLocaleFromPathname, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import type { PotionPool, RelicPool } from "@/lib/codex-types";

type CompendiumDirectDetailPageProps = {
  resourceType: CompendiumDetailResourceType;
  id: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  initialSummary?: CompendiumDetailSeoSummary | null;
  /** Server-rendered text and links shown until the interactive detail loads. */
  staticContent?: ReactNode;
};

const DETAIL_TYPES_WITH_VISIBLE_H1 = new Set<CompendiumDetailResourceType>([
  "ancients",
  "encounters",
  "epochs",
  "events",
  "monsters",
]);

const payloadPromises = new Map<string, Promise<CompendiumDetailPayload>>();

function fetchDetailPayload(
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): Promise<CompendiumDetailPayload> {
  const cacheKey = `${serviceLocale}:${gameLocale}`;
  const existingPromise = payloadPromises.get(cacheKey);
  if (existingPromise) return existingPromise;

  const nextPromise = loadCompendiumDetailPayload(serviceLocale, gameLocale)
    .catch((error: unknown) => {
      payloadPromises.delete(cacheKey);
      throw error;
    });

  payloadPromises.set(cacheKey, nextPromise);
  return nextPromise;
}

function findByRouteId<T extends { id: string }>(
  rows: T[],
  routeId: string,
): T | undefined {
  return rows.find((row) => row.id.toLowerCase() === routeId.toLowerCase());
}

function versionDetailEntity<T extends EntityLifecycle>(
  entity: T | undefined,
  entityType: VersionedEntityType,
  context: CodexVersionContext,
): T | null {
  if (!entity) return null;
  return versionCodexEntity(entity, entityType, context);
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
      href: buildCompendiumResourceHref("keyword", keyword.id),
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
      href: buildCompendiumResourceHref("epoch", epoch.id),
      color: epoch.affiliation,
      type: "epoch" as const,
      epochData: epoch,
    })),
  ];
}

function LoadingState({
  label,
  summary,
}: {
  label: string;
  summary?: CompendiumDetailSeoSummary | null;
}) {
  if (!summary) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6 font-game-text text-sm text-gray-300">
          {label}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center p-6">
        <article className="flex w-full flex-col items-center gap-4 text-center">
          {summary.imageUrl && (
            <Image
              src={summary.imageUrl}
              alt={summary.title}
              width={160}
              height={160}
              loading="eager"
              className="max-h-40 max-w-40 object-contain drop-shadow-lg"
            />
          )}
          <h1 className="font-game-title text-3xl font-bold text-gray-100 sm:text-4xl">
            {summary.title}
          </h1>
          {summary.description && (
            <p className="max-w-2xl font-game-text text-sm leading-relaxed text-gray-300 sm:text-base">
              {summary.description}
            </p>
          )}
          <p className="font-service text-xs text-gray-500" aria-live="polite">
            {label}
          </p>
        </article>
      </main>
    </div>
  );
}

export function CompendiumDirectDetailPage({
  resourceType,
  id,
  serviceLocale: routeServiceLocale,
  gameLocale: routeGameLocale,
  initialSummary,
  staticContent,
}: CompendiumDirectDetailPageProps) {
  const payloadKey = `${routeServiceLocale}:${routeGameLocale}`;
  const [payload, setPayload] = useState<CompendiumDetailPayload | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loadedKey, setLoadedKey] = useState(payloadKey);
  const urlVersion = useHydrationSafeSearchParam("version");
  const pathname = useHydrationSafePathname("/");
  const urlGameLocale = getGameLocaleFromPathname(pathname);

  if (loadedKey !== payloadKey) {
    setLoadedKey(payloadKey);
    setPayload(null);
    setError(null);
  }

  useEffect(() => {
    let active = true;
    fetchDetailPayload(routeServiceLocale, routeGameLocale)
      .then((nextPayload) => {
        if (active) setPayload(nextPayload);
      })
      .catch((nextError: Error) => {
        if (active) setError(nextError);
      });

    return () => {
      active = false;
    };
  }, [routeServiceLocale, routeGameLocale]);

  const entities = useMemo(
    () => payload ? buildEntityInfo(payload) : [],
    [payload],
  );

  // The server-rendered content stays in place until the interactive detail
  // is ready, and also when its data fails to load.
  if (error || !payload || payload.gameLocale !== urlGameLocale) {
    if (staticContent) return staticContent;
    return (
      <LoadingState
        label={error ? "상세 정보를 불러오지 못했습니다." : "상세 정보를 불러오는 중입니다."}
        summary={initialSummary}
      />
    );
  }

  const { serviceLocale, gameUi, history, resources } = payload;
  const { patches, changes, versionDiffs } = history;
  const serviceText = getCodexServiceMessages(serviceLocale);
  const showBetaArt = isBetaSearchEnabled();
  const currentVersion = latestPatchVersion(patches);
  // Any published patch is a real point in time, including hotfixes with no
  // field diffs. The dropdown list stays limited to versions that changed data.
  const selectedVersion = resolveKnownVersion(
    urlVersion,
    patches.map((patch) => patch.version),
  ) ?? currentVersion.replace(/^v/, "");
  const versionContext: CodexVersionContext = {
    selectedVersion,
    currentVersion,
    patches,
    changes,
    versionDiffs,
  };

  let detail: ReactNode = null;

  if (resourceType === "cards") {
    const card = versionDetailEntity(findByRouteId(resources.cards, id), "card", versionContext);
    if (card) {
      detail = (
        <CardDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          card={card}
          enchantments={versionCodexEntities(resources.enchantments, "enchantment", versionContext)}
          afflictions={resources.afflictions}
          relatedAncients={resources.ancients}
          relatedEvents={resources.events}
          relatedMonsters={resources.monsters}
          relatedPotions={resources.potions}
          relatedPowers={resources.powers}
          tipCatalogSources={payload.cardSideTipSources}
          tipCatalogCards={resources.cards}
          tipCatalogKeywords={resources.keywords}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
          initialShowBeta={showBetaArt}
          syncBetaSearchParam
          captureSnapshot={{ gameLocale: payload.gameLocale, version: selectedVersion }}
        />
      );
    }
  }

  if (resourceType === "relics") {
    const relic = versionDetailEntity(findByRouteId(resources.relics, id), "relic", versionContext);
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
          relatedMonsters={resources.monsters}
          relatedPotions={resources.potions}
          tipCatalogSources={payload.cardSideTipSources}
          tipCatalogCards={resources.cards}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
          captureSnapshot={{ gameLocale: payload.gameLocale, version: selectedVersion }}
        />
      );
    }
  }

  if (resourceType === "characters") {
    const character = findByRouteId(resources.characters, id);
    if (character) {
      detail = (
        <CharacterDetail
          serviceLocale={serviceLocale}
          backToListTitle={gameUi.charactersTitle}
          character={character}
          characters={resources.characters}
          cards={resources.cards}
          relics={resources.relics}
          potions={resources.potions}
          ancients={resources.ancients}
          entities={entities}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
        />
      );
    }
  }

  if (resourceType === "potions") {
    const potion = versionDetailEntity(findByRouteId(resources.potions, id), "potion", versionContext);
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
          relatedMonsters={resources.monsters}
          tipCatalogSources={payload.cardSideTipSources}
          tipCatalogCards={resources.cards}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
        />
      );
    }
  }

  if (resourceType === "powers") {
    const power = versionDetailEntity(findByRouteId(resources.powers, id), "power", versionContext);
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
    const enchantment = versionDetailEntity(findByRouteId(resources.enchantments, id), "enchantment", versionContext);
    const affliction = versionDetailEntity(findByRouteId(resources.afflictions, id), "affliction", versionContext);
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
    const ancient = versionDetailEntity(findByRouteId(resources.ancients, id), "ancient", versionContext);
    if (ancient) {
      detail = (
        <AncientDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={gameUi.ancientsTitle}
          ancient={ancient}
          cards={resources.cards}
          characters={resources.characters}
          entities={entities}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
        />
      );
    }
  }

  if (resourceType === "events") {
    const event = versionDetailEntity(findByRouteId(resources.events, id), "event", versionContext);
    if (event) {
      detail = (
        <EventDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          event={event}
          cards={resources.cards}
          characters={resources.characters.map(toEventCharacterQuoteSpeaker)}
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
    const monster = versionDetailEntity(resources.monsters.find((candidate) => (
      candidate.id.toLowerCase() === id.toLowerCase() &&
      candidate.showInCompendium &&
      isPublicBestiaryMonster(candidate.id)
    )), "monster", versionContext);
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
          selectedVersion={selectedVersion}
        />
      );
    }
  }

  if (resourceType === "encounters") {
    const encounter = versionDetailEntity(findByRouteId(resources.encounters, id), "encounter", versionContext);
    if (encounter) {
      detail = (
        <EncounterDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={serviceText.encountersView.backToList}
          encounter={encounter}
          characters={resources.characters}
          monsters={resources.monsters}
          patches={patches}
          changes={changes}
        />
      );
    }
  }

  if (resourceType === "epochs") {
    const epoch = versionDetailEntity(findByRouteId(resources.epochs, id), "epoch", versionContext);
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
    // The id exists but not at the chosen version (added later or removed).
    const label = selectedVersion !== currentVersion.replace(/^v/, "")
      ? serviceText.common.notInSelectedVersion.replace("{version}", `v${selectedVersion}`)
      : "상세 정보를 찾을 수 없습니다.";
    return <LoadingState label={label} summary={initialSummary} />;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {initialSummary && !DETAIL_TYPES_WITH_VISIBLE_H1.has(resourceType) && (
        <h1 className="sr-only">{initialSummary.title}</h1>
      )}
      {detail}
    </main>
  );
}
