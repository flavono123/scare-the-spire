import type { Metadata } from "next";
import { PagestormClient } from "@/components/pagestorm/pagestorm-client";
import { ServiceBackground } from "@/components/service-background";
import { getPagestormGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { PAGESTORM_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  PAGESTORM_BACKGROUND_SRC,
  PAGESTORM_HREF,
} from "@/lib/pagestorm";
import { composeToyBoxIndexOgDescription, getServiceOgMetadata } from "@/lib/service-metadata";
import { TOYBOX_NARROW_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generatePagestormMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const gameCopy = await getPagestormGameCopy(gameLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description: composeToyBoxIndexOgDescription(
      serviceLocale,
      serviceMessages[serviceLocale].pagestorm.subtitle,
    ),
    image: PAGESTORM_PAGE_OG_IMAGE,
    canonicalPath: PAGESTORM_HREF,
  });
}

export async function renderPagestormPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const gameCopy = await getPagestormGameCopy(gameLocale);

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]" data-pagestorm-page="index">
      <ServiceBackground
        src={PAGESTORM_BACKGROUND_SRC}
        imageClassName="object-[42%_center] sm:object-center"
      />
      <div className={TOYBOX_NARROW_SHELL_CLASS}>
        <PagestormClient gameCopy={gameCopy} />
      </div>
    </div>
  );
}
