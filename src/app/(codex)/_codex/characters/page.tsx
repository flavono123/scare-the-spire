import { Suspense } from "react";
import type { Metadata } from "next";
import { CharacterListLoader } from "@/components/codex/character-list-loader";
import { CompendiumEntryLinkIndex } from "@/components/codex/compendium-entry-link-index";
import { getCodexCharacters } from "@/lib/codex-data";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { getCodexMetadata } from "@/lib/codex-service";
import {
  findCodexResourceByRouteId,
  firstCodexImageUrl,
  firstRouteSearchParam,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { getSTS2Patches } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";

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
  return getCodexMetadata(serviceLocale, gameUi.charactersTitle, "/compendium/characters");
}

export default async function CodexCharactersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [characters, patches, gameUi] = await Promise.all([
    getCodexCharacters({ gameLocale }),
    getSTS2Patches(),
    getCodexGameUiLabels(gameLocale),
  ]);
  return (
    <>
      <Suspense>
        <CharacterListLoader
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          title={gameUi.charactersTitle}
          characters={characters}
          patches={patches}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={gameUi.charactersTitle}
        groups={[{ type: "character", entries: characters }]}
      />
    </>
  );
}
