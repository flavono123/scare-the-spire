import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexModifiers } from "@/lib/codex-data";
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
import { ModifierLibrary } from "@/components/codex/modifier-library";

export const dynamic = "force-static";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const modifierId = firstRouteSearchParam(resolvedSearchParams.modifier);
  const [gameUi, modifiers] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    modifierId ? getCodexModifiers({ gameLocale }) : Promise.resolve(null),
  ]);
  const modifier = modifiers ? findCodexResourceByRouteId(modifiers, modifierId) : undefined;
  if (modifier) {
    return getCodexResourceOgMetadata(serviceLocale, gameUi.nav.modifiers, modifier);
  }
  return getCodexMetadata(serviceLocale, gameUi.nav.modifiers, "/compendium/modifiers");
}

export default async function CodexModifiersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [modifiers, entities, gameUi] = await Promise.all([
    getCodexModifiers({ gameLocale }),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);

  return (
    <Suspense>
      <ModifierLibrary
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
        gameUi={gameUi}
        title={gameUi.nav.modifiers}
        modifiers={modifiers}
        entities={entities}
      />
    </Suspense>
  );
}
