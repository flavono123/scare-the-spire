import type { Metadata } from "next";
import { ColorfulPhilosophersIndex } from "@/components/colorful-philosophers/index-view";
import { ServiceBackground } from "@/components/service-background";
import { getDebateGameCopy } from "@/lib/borrowed-game-copy";
import { COLORFUL_PHILOSOPHERS_BACKGROUND_SRC, COLORFUL_PHILOSOPHERS_HREF } from "@/lib/colorful-philosophers";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { COLORFUL_PHILOSOPHERS_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { composeToyBoxIndexOgDescription, getServiceOgMetadata } from "@/lib/service-metadata";
import { TOYBOX_NARROW_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generateColorfulPhilosophersMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const gameCopy = await getDebateGameCopy(gameLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description: composeToyBoxIndexOgDescription(serviceLocale, copy.subtitle),
    image: COLORFUL_PHILOSOPHERS_PAGE_OG_IMAGE,
    canonicalPath: COLORFUL_PHILOSOPHERS_HREF,
  });
}

export async function renderColorfulPhilosophersPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const gameCopy = await getDebateGameCopy(gameLocale);
  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src={COLORFUL_PHILOSOPHERS_BACKGROUND_SRC}
        imageClassName="object-[18%_22%] opacity-70 sm:object-[22%_28%]"
      />
      <div className={TOYBOX_NARROW_SHELL_CLASS}>
        <ColorfulPhilosophersIndex
          title={gameCopy.title}
          subtitle={copy.subtitle}
          hero={gameCopy.hero}
        />
      </div>
    </div>
  );
}
