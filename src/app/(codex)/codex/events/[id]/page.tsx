import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexEvents } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { EventDetail } from "@/components/codex/event-detail";

export async function generateStaticParams() {
  const events = await getCodexEvents();
  return events.map((e) => ({ id: e.id.toLowerCase() }));
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
  const [events, gameUi] = await Promise.all([
    getCodexEvents({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const event = events.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!event) return {};
  return getCodexMetadata(serviceLocale, `${event.name} — ${gameUi.eventsTitle}`);
}

export default async function EventDetailPage({
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
  const [events, gameUi] = await Promise.all([
    getCodexEvents({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const event = events.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!event) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <EventDetail serviceLocale={serviceLocale} gameUi={gameUi} event={event} />
    </div>
  );
}
