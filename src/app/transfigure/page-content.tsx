import type { Metadata } from "next";
import { ServiceBackground } from "@/components/service-background";
import { TransfigureClient } from "@/components/transfigure/transfigure-client";
import { getTransfigureGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { loadAllEntities } from "@/lib/load-all-entities";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { TRANSFIGURE_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";

export async function generateTransfigureMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = getServiceMetadataCopy(serviceLocale);
  return {
    ...getServiceOgMetadata({
      serviceLocale,
      title: copy.transfigureTitle,
      description: copy.transfigureDescription,
      image: TRANSFIGURE_PAGE_OG_IMAGE,
    }),
  };
}

export async function renderTransfigurePage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const [entities, gameCopy] = await Promise.all([
    loadAllEntities({ gameLocale }),
    getTransfigureGameCopy(gameLocale),
  ]);

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src="/images/sts2/cards/transfigure.webp"
        imageClassName="object-[58%_center] sm:object-center"
      />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <TransfigureClient
          entities={entities}
          gameLocale={gameLocale}
          title={gameCopy.title}
          subtitle={gameCopy.subtitle}
          upgradeLabel={gameCopy.viewUpgrades}
        />
      </div>
    </div>
  );
}
