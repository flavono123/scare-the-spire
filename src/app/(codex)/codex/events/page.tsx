import { getCodexEvents } from "@/lib/codex-data";
import { EventList } from "@/components/codex/event-list";

export const metadata = {
  title: "이벤트 — Spire Codex",
  description: "슬레이 더 스파이어 2 이벤트 백과사전 — 첨탑에서 마주하는 선택의 순간",
};

export default async function CodexEventsPage() {
  const events = await getCodexEvents();

  return <EventList events={events} />;
}
