import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CharacterDetail } from "@/components/codex/character-detail";
import {
  getCodexAncients,
  getCodexCards,
  getCodexCharacters,
  getCodexPotions,
  getCodexRelics,
} from "@/lib/codex-data";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  firstCodexImageUrl,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { getEntityVersionDiffs, getSTS2Changes, getSTS2Patches } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { loadAllEntities } from "@/lib/load-all-entities";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const characters = await getCodexCharacters();
  return characters.map((character) => ({ id: character.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [characters, gameUi] = await Promise.all([
    getCodexCharacters({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const character = findCodexResourceByRouteId(characters, id);
  if (!character) return {};
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

export default async function CharacterDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [characters, cards, relics, potions, ancients, entities, patches, changes, versionDiffs, gameUi] = await Promise.all([
    getCodexCharacters({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexAncients({ gameLocale }),
    loadAllEntities({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const character = characters.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!character) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CharacterDetail
        serviceLocale={serviceLocale}
        backToListTitle={gameUi.charactersTitle}
        character={character}
        characters={characters}
        cards={cards}
        relics={relics}
        potions={potions}
        ancients={ancients}
        entities={entities}
        patches={patches}
        changes={changes}
        versionDiffs={versionDiffs}
      />
    </div>
  );
}
