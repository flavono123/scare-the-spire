import type { Metadata } from "next";
import { DefragmentClient } from "@/components/defragment/defragment-client";
import { ServiceBackground } from "@/components/service-background";
import { getDefragmentGameCopy } from "@/lib/borrowed-game-copy";
import { DEFRAGMENT_BACKGROUND_SRC } from "@/lib/defragment";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { loadAllEntities } from "@/lib/load-all-entities";
import { DEFRAGMENT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { getServiceOgMetadata } from "@/lib/service-metadata";
import { serviceMessages } from "@/messages/service";

export async function generateDefragmentMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const gameCopy = await getDefragmentGameCopy(gameLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description: serviceMessages[serviceLocale].defragment.metadata.description,
    image: DEFRAGMENT_PAGE_OG_IMAGE,
    canonicalPath: "/defragment",
  });
}

export async function renderDefragmentPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const [entities, gameCopy] = await Promise.all([
    loadAllEntities({ gameLocale }),
    getDefragmentGameCopy(gameLocale),
  ]);

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src={DEFRAGMENT_BACKGROUND_SRC}
        imageClassName="object-[58%_center] sm:object-center"
      />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <DefragmentClient
          entities={entities}
          gameLocale={gameLocale}
          title={gameCopy.title}
          subtitle={gameCopy.subtitle}
          placeholder={gameCopy.placeholder}
        />
      </div>
    </div>
  );
}
