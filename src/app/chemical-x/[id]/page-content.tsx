import type { Metadata } from "next";
import { ChemicalXPostView } from "@/components/chemicalx/post-view";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { CHEMICAL_X_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";

export async function generateChemicalXPostMetadata(
  _id?: string,
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

export async function renderChemicalXPostPage(
  id: string,
) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ChemicalXPostView postId={id} />
    </div>
  );
}
