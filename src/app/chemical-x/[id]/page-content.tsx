import type { Metadata } from "next";
import { ChemicalXPostView } from "@/components/chemicalx/post-view";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { CHEMICAL_X_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  composeToyBoxPostOgDescription,
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import {
  chemicalPostOgImage,
  getChemicalPostOgFields,
  truncateOgTitle,
} from "@/lib/toybox-post-og";
import { serviceMessages } from "@/messages/service";

export async function generateChemicalXPostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = getServiceMetadataCopy(serviceLocale);
  const description = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: serviceMessages[serviceLocale].nav.chemicalX,
    serviceDescription: copy.chemicalXDescription,
  });
  const fallback = getServiceOgMetadata({
    serviceLocale,
    title: copy.chemicalXTitle,
    description,
    image: CHEMICAL_X_PAGE_OG_IMAGE,
    canonicalPath: id ? `/chemical-x/${id}` : "/chemical-x",
  });
  if (!id) return fallback;

  const fields = await getChemicalPostOgFields(id);
  if (!fields) return fallback;
  return getServiceOgMetadata({
    serviceLocale,
    title: truncateOgTitle(fields.contentText) || copy.chemicalXTitle,
    description,
    image: chemicalPostOgImage(fields.content),
    canonicalPath: `/chemical-x/${id}`,
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
