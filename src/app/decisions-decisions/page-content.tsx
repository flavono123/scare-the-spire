import type { Metadata } from "next";
import { DecisionsDecisionsClient } from "@/components/decisions-decisions/decisions-decisions-client";
import { ServiceBackground } from "@/components/service-background";
import { getDecisionsDecisionsGameCopy } from "@/lib/borrowed-game-copy";
import {
  DECISIONS_DECISIONS_BACKGROUND_SRC,
  DECISIONS_DECISIONS_HREF,
} from "@/lib/decisions-decisions";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { DECISIONS_DECISIONS_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { composeToyBoxIndexOgDescription, getServiceOgMetadata } from "@/lib/service-metadata";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generateDecisionsDecisionsMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const gameCopy = await getDecisionsDecisionsGameCopy(gameLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description: composeToyBoxIndexOgDescription(
      serviceLocale,
      serviceMessages[serviceLocale].decisionsDecisions.subtitle,
    ),
    image: DECISIONS_DECISIONS_PAGE_OG_IMAGE,
    canonicalPath: DECISIONS_DECISIONS_HREF,
  });
}

export async function renderDecisionsDecisionsPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const gameCopy = await getDecisionsDecisionsGameCopy(gameLocale);

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]" data-decisions-decisions-page="index">
      <ServiceBackground
        src={DECISIONS_DECISIONS_BACKGROUND_SRC}
        imageClassName="object-[42%_center] sm:object-center"
      />
      <div className={TOYBOX_WIDE_SHELL_CLASS}>
        <DecisionsDecisionsClient gameLocale={gameLocale} gameCopy={gameCopy} />
      </div>
    </div>
  );
}
