import type { Metadata } from "next";
import { ComboPostView } from "@/components/combo/combo-post-view";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { COMBO_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";

export async function generateComboPostMetadata(
  _id?: string,
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

export async function renderComboPostPage(
  id: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ComboPostView postId={id} gameLocale={gameLocale} />
    </div>
  );
}
