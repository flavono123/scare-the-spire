export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1EventLibrary } from "@/components/sts1/event-library";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getSts1EventLabels } from "@/lib/sts1/compendium-extras";
import { getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { getSts1EntityRefs, getSts1Events, sts1EventItemRefs } from "@/lib/sts1/events";
import { sts1IndexPath } from "@/lib/sts1/paths";
import { getSts1RelatedMap } from "@/lib/sts1/relations";

type ListProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ListProps): Promise<Metadata> {
  const resolved = await searchParams;
  const labels = await getSts1EventLabels(getGameLocaleFromSearchRecord(resolved));
  return getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), labels.title, sts1IndexPath("events"));
}

export default async function Sts1EventsPage({ searchParams }: ListProps) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [events, labels, eventLabels] = await Promise.all([
    getSts1Events(gameLocale),
    getSts1UiLabels(gameLocale),
    getSts1EventLabels(gameLocale),
  ]);
  const [refs, related] = await Promise.all([
    getSts1EntityRefs(sts1EventItemRefs(events), gameLocale),
    getSts1RelatedMap("events", events.map((event) => event.slug), gameLocale),
  ]);
  return (
    <Suspense>
      <Sts1EventLibrary
        events={events}
        refs={refs}
        related={related}
        labels={labels}
        eventLabels={eventLabels}
        serviceLocale={serviceLocale}
      />
    </Suspense>
  );
}
