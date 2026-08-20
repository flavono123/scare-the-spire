import type { Metadata } from "next";
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
    serviceDescription: copy.transfigureDescription,
  });
  const fallback = getServiceOgMetadata({
    serviceLocale,
    title: copy.transfigureTitle,
    description,
    image: TRANSFIGURE_PAGE_OG_IMAGE,
    canonicalPath: id ? `/transfigure/${id}` : "/transfigure",
  });
  if (!id) return fallback;

  const fields = await getTransfigurePostOgFields(id);
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
    canonicalPath: `/transfigure/${id}`,
  });
}

export async function renderTransfigurePostPage(
  id: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const gameCopy = await getTransfigureGameCopy(gameLocale);

  return (
    <div className={TOYBOX_NARROW_SHELL_CLASS}>
      <TransfigurePostView
        postId={id}
        gameLocale={gameLocale}
        upgradeLabel={gameCopy.viewUpgrades}
      />
    </div>
  );
}
