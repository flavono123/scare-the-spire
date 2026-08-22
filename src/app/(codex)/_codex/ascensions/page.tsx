import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexAscensions } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  firstRouteSearchParam,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { AscensionLibrary } from "@/components/codex/ascension-library";

export const dynamic = "force-static";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const ascensionId = firstRouteSearchParam(resolvedSearchParams.ascension);
  const [gameUi, ascensions] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    ascensionId ? getCodexAscensions({ gameLocale }) : Promise.resolve(null),
  ]);
  const ascension = ascensions ? findCodexResourceByRouteId(ascensions, ascensionId) : undefined;
  if (ascension) {
    return getCodexResourceOgMetadata(serviceLocale, gameUi.nav.ascensions, ascension);
  }
  return getCodexMetadata(serviceLocale, gameUi.nav.ascensions, "/compendium/ascensions");
}

export default async function CodexAscensionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [ascensions, entities, gameUi] = await Promise.all([
    getCodexAscensions({ gameLocale }),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);

  return (
    <Suspense>
      <AscensionLibrary
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
        gameUi={gameUi}
        title={gameUi.nav.ascensions}
        ascensions={ascensions}
        entities={entities}
      />
    </Suspense>
  );
}
