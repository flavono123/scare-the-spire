import { Suspense } from "react";
import type { Metadata } from "next";
import {
  getCodexAfflictions,
  getCodexEncounters,
  getCodexCards,
  getCodexMonsters,
  getCodexPowers,
} from "@/lib/codex-data";
import { getCodexMeta, getEntityVersionDiffs, getSTS2Patches, getSTS2Changes } from "@/lib/data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";
import {
  firstRouteSearchParam,
  getCodexEncounterOgResource,
  getCodexMonsterOgResource,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { BestiaryLibrary } from "@/components/codex/bestiary-library";

export const dynamic = "force-static";

type SearchParamsRecord = Record<string, string | string[] | undefined>;

export async function generateCompendiumBestiaryMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
  searchParams: SearchParamsRecord = {},
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const monsterId = firstRouteSearchParam(searchParams.monster);
  const encounterId = firstRouteSearchParam(searchParams.encounter);
  const [gameUi, monsters, encounters] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    monsterId || encounterId ? getCodexMonsters({ gameLocale }) : Promise.resolve(null),
    encounterId ? getCodexEncounters({ gameLocale }) : Promise.resolve(null),
  ]);

  if (encounterId && encounters && monsters) {
    const encounter = encounters.find((item) => item.id.toLowerCase() === encounterId.toLowerCase());
    if (encounter) {
      return getCodexResourceOgMetadata(
        serviceLocale,
        gameUi.bestiaryTitle,
        getCodexEncounterOgResource(encounter, monsters, serviceLocale),
      );
    }
  }

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
        getCodexMonsterOgResource(monster, serviceLocale),
      );
    }
  }

  return getCodexMetadata(serviceLocale, gameUi.bestiaryTitle);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}): Promise<Metadata> {
  return generateCompendiumBestiaryMetadata(DEFAULT_ROUTE_GAME_LOCALE, await searchParams);
}

export async function renderCompendiumBestiaryPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
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
      <BestiaryLibrary
        serviceLocale={serviceLocale}
        gameUi={gameUi}
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

export default async function CompendiumBestiaryPage() {
  return renderCompendiumBestiaryPage();
}
