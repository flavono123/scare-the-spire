import type { Metadata } from "next";
import { loadAllEntities } from "@/lib/load-all-entities";
import { ChemicalXClient } from "@/components/chemicalx/chemicalx-client";
import { ServiceBackground } from "@/components/service-background";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { CHEMICAL_X_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { getChemicalXPlaceholder } from "@/lib/borrowed-game-copy";

export async function generateChemicalXMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = getServiceMetadataCopy(serviceLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: copy.chemicalXTitle,
    description: copy.chemicalXDescription,
    image: CHEMICAL_X_PAGE_OG_IMAGE,
  });
}

export async function renderChemicalXPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const [entities, placeholder] = await Promise.all([
    loadAllEntities({ gameLocale }),
    getChemicalXPlaceholder(gameLocale),
  ]);

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src="/images/sts2/cards/eradicate.webp"
        imageClassName="object-center"
      />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <ChemicalXClient entities={entities} placeholder={placeholder} />
      </div>
    </div>
  );
}
