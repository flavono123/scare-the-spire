import type { Metadata } from "next";
import { StaticDetailShell } from "@/components/static-detail-shell";
import { TransfigurePostView } from "@/components/transfigure/transfigure-post-view";
import { getTransfigureGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { TRANSFIGURE_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  composeToyBoxPostOgDescription,
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { metadataRecordId } from "@/lib/static-detail-shell";
import {
  getTransfigurePostOgFields,
  toyboxResourceOgImageUrl,
  truncateOgTitle,
} from "@/lib/toybox-post-og";
import { TOYBOX_NARROW_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generateTransfigurePostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = getServiceMetadataCopy(serviceLocale);
  const description = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: serviceMessages[serviceLocale].nav.transfigure,
    serviceDescription: serviceMessages[serviceLocale].transfigure.subtitle,
  });
  const recordId = metadataRecordId(id);
  const fallback = getServiceOgMetadata({
    serviceLocale,
    title: copy.transfigureTitle,
    description,
    image: TRANSFIGURE_PAGE_OG_IMAGE,
    canonicalPath: recordId ? `/transfigure/${recordId}` : "/transfigure",
  });
  if (!recordId) return fallback;

  const fields = await getTransfigurePostOgFields(recordId);
  if (!fields) return fallback;
  const title = truncateOgTitle(
    fields.title?.trim()
    || fields.transformedName?.trim()
    || copy.transfigureTitle,
  );
  const imageUrl = toyboxResourceOgImageUrl(fields.resourceType, fields.resourceId);
  return getServiceOgMetadata({
    serviceLocale,
    title,
    description,
    image: imageUrl
      ? { url: imageUrl, alt: title }
      : TRANSFIGURE_PAGE_OG_IMAGE,
    canonicalPath: `/transfigure/${recordId}`,
  });
}

export async function renderTransfigurePostPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const gameCopy = await getTransfigureGameCopy(gameLocale);

  return (
    <div className={TOYBOX_NARROW_SHELL_CLASS}>
      <StaticDetailShell>
        <TransfigurePostView
          postId=""
          gameLocale={gameLocale}
          upgradeLabel={gameCopy.viewUpgrades}
        />
      </StaticDetailShell>
    </div>
  );
}
