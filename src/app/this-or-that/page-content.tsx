import type { Metadata } from "next";
import { ThisOrThatClient } from "@/components/this-or-that/this-or-that-client";
import { ServiceBackground } from "@/components/service-background";
import { getThisOrThatGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { THIS_OR_THAT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { getServiceOgMetadata } from "@/lib/service-metadata";
import { serviceMessages } from "@/messages/service";

export async function generateThisOrThatMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const gameCopy = await getThisOrThatGameCopy(gameLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description: serviceMessages[serviceLocale].thisOrThat.metadata.description,
    image: THIS_OR_THAT_PAGE_OG_IMAGE,
  });
}

export async function renderThisOrThatPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const gameCopy = await getThisOrThatGameCopy(gameLocale);

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src="/images/sts2/events/this_or_that.webp"
        imageClassName="object-[38%_center] sm:object-center"
      />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <ThisOrThatClient
          gameLocale={gameLocale}
          title={gameCopy.title}
          prompt={gameCopy.prompt}
        />
      </div>
    </div>
  );
}
