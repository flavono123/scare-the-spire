import { Suspense } from "react";
import type { Metadata } from "next";
import {
  getCodexAfflictions,
  getCodexCards,
  getCodexEncounters,
  getCodexMonsters,
  getCodexPowers,
} from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMeta, getEntityVersionDiffs, getSTS2Changes, getSTS2Patches } from "@/lib/data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";
import {
  firstRouteSearchParam,
  getCodexMonsterOgResource,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { MonsterLibrary } from "@/components/codex/monster-library";

export const dynamic = "force-static";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const monsterId = firstRouteSearchParam(resolvedSearchParams.monster);
  const [gameUi, monsters] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    monsterId ? getCodexMonsters({ gameLocale }) : Promise.resolve(null),
  ]);

  if (monsterId && monsters) {
    const monster = monsters.find(
      (item) =>
        item.id.toLowerCase() === monsterId.toLowerCase() &&
        item.showInCompendium &&
        isPublicBestiaryMonster(item.id),
    );
    if (monster) {
      return getCodexResourceOgMetadata(
        serviceLocale,
        gameUi.bestiaryTitle,
        getCodexMonsterOgResource(monster, gameUi),
      );
    }
  }

  return getCodexMetadata(serviceLocale, gameUi.bestiaryTitle);
}

export default async function CodexMonstersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [monsters, encounters, afflictions, cards, powers, patches, changes, versionDiffs, meta, gameUi] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <MonsterLibrary
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        title={gameUi.bestiaryTitle}
        monsters={monsters}
        encounters={encounters}
        afflictions={afflictions}
        cards={cards}
        powers={powers}
        patches={patches}
        changes={changes}
        versions={versions}
        currentVersion={meta.version}
        versionDiffs={versionDiffs}
      />
    </Suspense>
  );
}
