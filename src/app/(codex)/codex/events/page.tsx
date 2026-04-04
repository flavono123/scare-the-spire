import { Suspense } from "react";
import { getCodexEvents } from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import { EventList } from "@/components/codex/event-list";

export const metadata = {
  title: "이벤트 — Spire Codex",
  description: "슬레이 더 스파이어 2 이벤트",
};

export default async function CodexEventsPage() {
  const [events, patches, versionDiffs, meta] = await Promise.all([
    getCodexEvents(),
    getSTS2Patches(),
    getEntityVersionDiffs(),
    getCodexMeta(),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <EventList
        events={events}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        versionDiffs={versionDiffs}
      />
    </Suspense>
  );
}
