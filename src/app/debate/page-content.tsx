import type { Metadata } from "next";
import { DebateView } from "@/components/debate/debate-view";
import { ServiceBackground } from "@/components/service-background";
import { getDebateGameCopy } from "@/lib/borrowed-game-copy";
import { DEBATE_BACKGROUND_SRC, DEBATE_HREF } from "@/lib/debate";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { DEBATE_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { composeToyBoxIndexOgDescription, getServiceOgMetadata } from "@/lib/service-metadata";
import { TOYBOX_NARROW_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generateDebateMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].debate;
  const gameCopy = await getDebateGameCopy(gameLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description: composeToyBoxIndexOgDescription(serviceLocale, copy.subtitle),
    image: DEBATE_PAGE_OG_IMAGE,
    canonicalPath: DEBATE_HREF,
  });
}

export async function renderDebatePage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].debate;
  const gameCopy = await getDebateGameCopy(gameLocale);

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]" data-debate-page="index">
      <ServiceBackground
        src={DEBATE_BACKGROUND_SRC}
        imageClassName="object-[18%_22%] opacity-70 sm:object-[22%_28%]"
      />
      <div className={TOYBOX_NARROW_SHELL_CLASS}>
        <DebateView
          title={gameCopy.title}
          subtitle={copy.subtitle}
          hero={gameCopy.hero}
          emptyLabel={copy.empty}
        />
      </div>
    </div>
  );
}
