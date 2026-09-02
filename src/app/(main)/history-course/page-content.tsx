import type { Metadata } from "next";
import Image from "next/image";
import { HistoryCourseLanding } from "@/components/history-course/history-course-landing";
import { ServiceBackground } from "@/components/service-background";
import { ToyBoxIndexHeading } from "@/components/toybox-index-heading";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { loadAllEntities } from "@/lib/load-all-entities";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { withPageOgImage } from "@/lib/page-og-images";
import { getHistoryCourseLandingGameCopy } from "@/lib/borrowed-game-copy";
import { composeToyBoxIndexOgDescription } from "@/lib/service-metadata";
import { TOYBOX_WIDE_MAX_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generateHistoryCourseMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = await getHistoryCourseLandingGameCopy(gameLocale);
  return withPageOgImage({
    title: copy.title,
    description: composeToyBoxIndexOgDescription(
      serviceLocale,
      serviceMessages[serviceLocale].historyCourse.subtitle,
    ),
  }, "/history-course");
}

export async function renderHistoryCourseIndexPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const [copy, entities] = await Promise.all([
    getHistoryCourseLandingGameCopy(gameLocale),
    loadAllEntities({ gameLocale }),
  ]);
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const headingCopy = serviceMessages[serviceLocale].historyCourse;

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src="/images/sts2/events/war_historian_repy.webp"
        imageClassName="object-[38%_center] sm:object-center"
      />
      <div className={`${TOYBOX_WIDE_MAX_CLASS} px-4 py-10`}>
        <header className="space-y-2">
          <div className="flex items-center gap-4">
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
          </div>
          </div>
          <ToyBoxIndexHeading
            subtitle={headingCopy.subtitle}
            hero={copy.heroQuote}
          />
        </header>

        <div className="mt-8">
          <HistoryCourseLanding entities={entities} />
        </div>
      </div>
    </div>
  );
}
