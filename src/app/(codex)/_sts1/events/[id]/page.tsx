export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1EventDetail } from "@/components/sts1/event-detail";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getSts1EventLabels } from "@/lib/sts1/compendium-extras";
import { getSts1Metadata, getSts1UiLabels, sts1RouteIds } from "@/lib/sts1/data";
import { plainSts1Text } from "@/lib/sts1/description";
import { getSts1EntityRefs, getSts1Event, getSts1Events, sts1EventItemRefs } from "@/lib/sts1/events";
import { sts1DetailPath, sts1EventImageUrl } from "@/lib/sts1/paths";
import { getSts1Related } from "@/lib/sts1/relations";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return sts1RouteIds(await getSts1Events());
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const event = await getSts1Event(id, getGameLocaleFromSearchRecord(resolved));
  if (!event) return {};
  const intro = event.scenes[event.start]?.body.filter((part) => typeof part === "string").join("") ?? "";
  return {
    ...getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), event.name, sts1DetailPath("events", event.slug)),
    description: plainSts1Text(intro.replace(/[~@]/g, "")).slice(0, 160),
    ...(event.image ? { openGraph: { images: [sts1EventImageUrl(event.image)] } } : {}),
  };
}

export default async function Sts1EventDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [event, labels, eventLabels] = await Promise.all([
    getSts1Event(id, gameLocale),
    getSts1UiLabels(gameLocale),
    getSts1EventLabels(gameLocale),
  ]);
  if (!event) notFound();
  const [refs, related] = await Promise.all([
    getSts1EntityRefs(sts1EventItemRefs([event]), gameLocale),
    getSts1Related("events", event.slug, gameLocale),
  ]);
  return (
    <Sts1EventDetail event={event} refs={refs} related={related} labels={labels} eventLabels={eventLabels} serviceLocale={serviceLocale} />
  );
}
