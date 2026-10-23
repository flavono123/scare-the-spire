import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexCharacters, getCodexEvents } from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
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
import { EventListLoader } from "@/components/codex/event-list-loader";
import { CompendiumEntryLinkIndex } from "@/components/codex/compendium-entry-link-index";
import { toEventCharacterQuoteSpeaker } from "@/lib/event-character-quotes";

export const dynamic = "force-static";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const eventId = firstRouteSearchParam(resolvedSearchParams.event);
  const [gameUi, events] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    eventId ? getCodexEvents({ gameLocale }) : Promise.resolve(null),
  ]);
  const event = events ? findCodexResourceByRouteId(events, eventId) : undefined;
  if (event) {
    return getCodexResourceOgMetadata(serviceLocale, gameUi.eventsTitle, event);
  }
  return getCodexMetadata(serviceLocale, gameUi.eventsTitle, "/compendium/events");
}

export default async function CodexEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [events, characters, patches, versionDiffs, meta, gameUi] = await Promise.all([
    getCodexEvents({ gameLocale }),
    getCodexCharacters({ gameLocale }),
    getSTS2Patches(),
    getEntityVersionDiffs(gameLocale),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const versions = getVersionsWithDiffs(patches, versionDiffs);
  return (
    <>
      <Suspense>
        <EventListLoader
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          title={gameUi.eventsTitle}
          events={events}
          characters={characters.map(toEventCharacterQuoteSpeaker)}
          versions={versions}
          currentVersion={meta.version}
          patches={patches}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={gameUi.eventsTitle}
        groups={[{ type: "event", entries: events }]}
      />
    </>
  );
}
