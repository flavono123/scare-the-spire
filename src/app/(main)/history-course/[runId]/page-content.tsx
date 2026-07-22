import type { Metadata } from "next";
import { DeferredRunDetailLoader } from "@/components/history-course/deferred-run-detail-loader";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { withPageOgImage } from "@/lib/page-og-images";
import { serviceMessages } from "@/messages/service";

export async function generateHistoryCourseRunMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  return withPageOgImage({
    title: `${serviceMessages[serviceLocale].nav.historyCourse} — ${serviceMessages[serviceLocale].historyCourse.runTitleSuffix}`,
    description: serviceMessages[serviceLocale].historyCourse.runDescription,
  }, "/history-course/[runId]");
}

export async function renderHistoryCourseRunPage(
  runId: string,
) {
  return <DeferredRunDetailLoader runId={runId} />;
}
