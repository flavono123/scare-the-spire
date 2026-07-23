import type { Metadata } from "next";
import { ComboClient } from "@/components/combo/combo-client";
import { ServiceBackground } from "@/components/service-background";
import { getComboPlaceholder } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { loadAllEntities } from "@/lib/load-all-entities";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { COMBO_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";

export async function generateComboMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = getServiceMetadataCopy(serviceLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: copy.comboTitle,
    description: copy.comboDescription,
    image: COMBO_PAGE_OG_IMAGE,
  });
}

export async function renderComboPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const [entities, placeholder] = await Promise.all([
    loadAllEntities({ gameLocale }),
    getComboPlaceholder(gameLocale),
  ]);

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src="/images/sts2/events/amalgamator.webp"
        imageClassName="object-[38%_center] sm:object-center"
      />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <ComboClient
          entities={entities}
          gameLocale={gameLocale}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
