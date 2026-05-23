import type { Metadata } from "next";
import { RunDetailLoader } from "@/components/history-course/run-detail-loader";
import { getCodexCards, getCodexRelics } from "@/lib/codex-data";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { withPageOgImage } from "@/lib/page-og-images";
import { getHistoryCourseLandingGameCopy } from "@/lib/borrowed-game-copy";
import { serviceMessages } from "@/messages/service";

export async function generateHistoryCourseRunMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = await getHistoryCourseLandingGameCopy(gameLocale);
  return withPageOgImage({
    title: `${copy.title} — ${serviceMessages[serviceLocale].historyCourse.runTitleSuffix}`,
    description: serviceMessages[serviceLocale].historyCourse.runDescription,
  }, "/history-course/[runId]");
}

export async function generateMetadata(): Promise<Metadata> {
  return generateHistoryCourseRunMetadata();
}

// runId is content-addressable and per-browser; we never enumerate.
// The loader resolves runId from IndexedDB on the client.
export const dynamic = "force-dynamic";

export async function renderHistoryCourseRunPage(
  runId: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const [allCards, allRelics] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
  ]);
  return (
    <RunDetailLoader runId={runId} allCards={allCards} allRelics={allRelics} />
  );
}

export default async function HistoryCourseRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return renderHistoryCourseRunPage(runId);
}
