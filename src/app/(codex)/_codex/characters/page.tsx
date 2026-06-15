import { Suspense } from "react";
import type { Metadata } from "next";
import { CharacterList } from "@/components/codex/character-list";
import {
  getCodexAncients,
  getCodexCards,
  getCodexCharacters,
  getCodexPotions,
  getCodexRelics,
} from "@/lib/codex-data";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { getCodexMetadata } from "@/lib/codex-service";
import {
  findCodexResourceByRouteId,
  firstCodexImageUrl,
  firstRouteSearchParam,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { getEntityVersionDiffs, getSTS2Changes, getSTS2Patches } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { loadAllEntities } from "@/lib/load-all-entities";

export const dynamic = "force-static";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const characterId = firstRouteSearchParam(resolvedSearchParams.character);
  const [gameUi, characters] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    characterId ? getCodexCharacters({ gameLocale }) : Promise.resolve(null),
  ]);
  const character = characters ? findCodexResourceByRouteId(characters, characterId) : undefined;
  if (character) {
    return getCodexResourceOgMetadata(serviceLocale, gameUi.charactersTitle, {
      name: character.name,
      description: character.description,
      imageUrl: firstCodexImageUrl(
        character.combatImageUrl,
        character.selectImageUrl,
        character.imageUrl,
        character.iconUrl,
      ),
    });
  }
  return getCodexMetadata(serviceLocale, gameUi.charactersTitle);
}

export default async function CodexCharactersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [characters, cards, relics, potions, ancients, patches, changes, versionDiffs, entities, gameUi] = await Promise.all([
    getCodexCharacters({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexAncients({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);

  return (
    <Suspense>
      <CharacterList
        serviceLocale={serviceLocale}
        title={gameUi.charactersTitle}
        characters={characters}
        cards={cards}
        relics={relics}
        potions={potions}
        ancients={ancients}
        patches={patches}
        changes={changes}
        versionDiffs={versionDiffs}
        entities={entities}
      />
    </Suspense>
  );
}
