import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexEvents } from "@/lib/codex-data";
import { EVENT_ACT_CONFIG, EVENT_ACT_UNKNOWN } from "@/lib/codex-types";
import { EventDetail } from "@/components/codex/event-detail";

export async function generateStaticParams() {
  const events = await getCodexEvents();
  return events.map((e) => ({ id: e.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const events = await getCodexEvents();
  const event = events.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!event) return {};
  const actConfig = event.act
    ? (EVENT_ACT_CONFIG[event.act] ?? EVENT_ACT_UNKNOWN)
    : EVENT_ACT_UNKNOWN;
  return {
    title: `${event.name} — 슬서운 이벤트`,
    description: `${event.name} (${event.nameEn}) — ${actConfig.labelKo}`,
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const events = await getCodexEvents();
  const event = events.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!event) notFound();

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-200">
      <EventDetail event={event} />
    </div>
  );
}
