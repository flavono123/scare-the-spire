import type { Metadata } from "next";
import { RunDetailLoader } from "@/components/history-course/run-detail-loader";
import { getCodexCards, getCodexRelics } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleForGameLocale,
} from "@/lib/i18n";
import { getHistoryCourseLandingGameCopy } from "@/lib/borrowed-game-copy";
import { serviceMessages } from "@/messages/service";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = await getHistoryCourseLandingGameCopy(gameLocale);
  return {
    title: `${copy.title} — ${serviceMessages[serviceLocale].historyCourse.runTitleSuffix}`,
    description: serviceMessages[serviceLocale].historyCourse.runDescription,
  };
}

// runId is content-addressable and per-browser; we never enumerate.
// The loader resolves runId from IndexedDB on the client.
export const dynamic = "force-dynamic";

export default async function HistoryCourseRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { runId } = await params;
  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const [allCards, allRelics] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
  ]);
  return (
    <RunDetailLoader runId={runId} allCards={allCards} allRelics={allRelics} />
  );
}
