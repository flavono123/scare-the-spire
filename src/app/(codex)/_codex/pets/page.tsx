import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexPets } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  firstRouteSearchParam,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { PetLibraryLoader } from "@/components/codex/pet-library-loader";
import { CompendiumEntryLinkIndex } from "@/components/codex/compendium-entry-link-index";

export const dynamic = "force-static";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const resourceId = firstRouteSearchParam(resolvedSearchParams.pet);
  const pets = resourceId ? await getCodexPets({ gameLocale }) : null;
  const pet = pets ? findCodexResourceByRouteId(pets, resourceId) : undefined;
  if (pet) {
    return getCodexResourceOgMetadata(serviceLocale, getCodexServiceMessages(serviceLocale).pets, pet);
  }
  return getCodexMetadata(serviceLocale, getCodexServiceMessages(serviceLocale).pets, "/compendium/pets");
}

export default async function CodexPetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [pets, gameUi] = await Promise.all([
    getCodexPets({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  return (
    <>
      <Suspense>
        <PetLibraryLoader
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          gameUi={gameUi}
          title={getCodexServiceMessages(serviceLocale).pets}
          pets={pets}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={getCodexServiceMessages(serviceLocale).pets}
        groups={[{ type: "pet", entries: pets }]}
      />
    </>
  );
}
