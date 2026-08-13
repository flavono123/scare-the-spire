import type { Metadata } from "next";
import { ComboPostView } from "@/components/combo/combo-post-view";
import { getComboPlaceholder } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { COMBO_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  composeToyBoxPostOgDescription,
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import {
  comboPostOgImage,
  getComboPostOgFields,
  truncateOgTitle,
} from "@/lib/toybox-post-og";
import { serviceMessages } from "@/messages/service";

export async function generateComboPostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = getServiceMetadataCopy(serviceLocale);
  const description = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: serviceMessages[serviceLocale].nav.combo,
    serviceDescription: copy.comboDescription,
  });
  const fallback = getServiceOgMetadata({
    serviceLocale,
    title: copy.comboTitle,
    description,
    image: COMBO_PAGE_OG_IMAGE,
    canonicalPath: id ? `/c-c-c-combo/${id}` : "/c-c-c-combo",
  });
  if (!id) return fallback;

  const fields = await getComboPostOgFields(id);
  if (!fields) return fallback;
  return getServiceOgMetadata({
    serviceLocale,
    title: truncateOgTitle(fields.contentText) || copy.comboTitle,
    description,
    image: comboPostOgImage(fields) ?? COMBO_PAGE_OG_IMAGE,
    canonicalPath: `/c-c-c-combo/${id}`,
  });
}

export async function renderComboPostPage(
  id: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const placeholder = await getComboPlaceholder(gameLocale);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ComboPostView postId={id} gameLocale={gameLocale} placeholder={placeholder} />
    </div>
  );
}
