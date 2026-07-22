import type { Metadata } from "next";
import Image from "next/image";
import { HistoryCourseLanding } from "@/components/history-course/history-course-landing";
import { ServiceBackground } from "@/components/service-background";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { withPageOgImage } from "@/lib/page-og-images";
import { getHistoryCourseLandingGameCopy } from "@/lib/borrowed-game-copy";
import { serviceMessages } from "@/messages/service";

export async function generateHistoryCourseMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = await getHistoryCourseLandingGameCopy(gameLocale);
  return withPageOgImage({
    title: copy.title,
    description: serviceMessages[serviceLocale].historyCourse.description.replace(
      "{runHistory}",
      copy.runHistoryLabel,
    ),
  }, "/history-course");
}

export async function generateMetadata(): Promise<Metadata> {
  return generateHistoryCourseMetadata();
}

export async function renderHistoryCourseIndexPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const copy = await getHistoryCourseLandingGameCopy(gameLocale);

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src="/images/sts2/events/war_historian_repy.webp"
        imageClassName="object-[38%_center] sm:object-center"
      />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="flex items-center gap-4">
          <Image
            src="/images/sts2/relics/history_course.webp"
            alt={copy.title}
            width={56}
            height={56}
            className="h-14 w-14 object-contain drop-shadow"
          />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-50">
              {copy.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
              {copy.heroQuote}
            </p>
          </div>
        </header>

        <div className="mt-8">
          <HistoryCourseLanding />
        </div>
      </div>
    </div>
  );
}

export default async function HistoryCourseIndexPage() {
  return renderHistoryCourseIndexPage();
}
