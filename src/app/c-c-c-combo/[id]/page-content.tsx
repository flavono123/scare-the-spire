import type { Metadata } from "next";
import { ComboPostView } from "@/components/combo/combo-post-view";
import { StaticDetailShell } from "@/components/static-detail-shell";
import { getComboPlaceholder } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { COMBO_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  composeToyBoxPostOgDescription,
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { metadataRecordId } from "@/lib/static-detail-shell";
import {
  comboPostOgImage,
  getComboPostOgFields,
  truncateOgTitle,
} from "@/lib/toybox-post-og";
import { serviceMessages } from "@/messages/service";
import { TOYBOX_NARROW_SHELL_CLASS } from "@/lib/toybox-layout";

export async function generateComboPostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = getServiceMetadataCopy(serviceLocale);
  const description = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: serviceMessages[serviceLocale].nav.combo,
    serviceDescription: serviceMessages[serviceLocale].combo.subtitle,
  });
  const recordId = metadataRecordId(id);
  const fallback = getServiceOgMetadata({
    serviceLocale,
    title: copy.comboTitle,
    description,
    image: COMBO_PAGE_OG_IMAGE,
    canonicalPath: recordId ? `/c-c-c-combo/${recordId}` : "/c-c-c-combo",
  });
  if (!recordId) return fallback;

  const fields = await getComboPostOgFields(recordId);
  if (!fields) return fallback;
  return getServiceOgMetadata({
    serviceLocale,
    title: truncateOgTitle(fields.contentText) || copy.comboTitle,
    description,
    image: comboPostOgImage(fields) ?? COMBO_PAGE_OG_IMAGE,
    canonicalPath: `/c-c-c-combo/${recordId}`,
  });
}

export async function renderComboPostPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const placeholder = await getComboPlaceholder(gameLocale);

  return (
    <div className={TOYBOX_NARROW_SHELL_CLASS}>
      <StaticDetailShell>
        <ComboPostView postId="" gameLocale={gameLocale} placeholder={placeholder} />
      </StaticDetailShell>
    </div>
  );
}
