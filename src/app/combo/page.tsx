import type { Metadata } from "next";
import { ComboClient } from "@/components/combo/combo-client";
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

export async function generateMetadata(): Promise<Metadata> {
  return generateComboMetadata();
}

export async function renderComboPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const entities = await loadAllEntities({ gameLocale });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ComboClient entities={entities} gameLocale={gameLocale} />
    </div>
  );
}

export default async function ComboPage() {
  return renderComboPage();
}
