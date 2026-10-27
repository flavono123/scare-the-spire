import type { Metadata } from "next";
import { PagestormPostView } from "@/components/pagestorm/pagestorm-post-view";
import { ServiceBackground } from "@/components/service-background";
import { StaticDetailShell } from "@/components/static-detail-shell";
import { getPagestormGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { PAGESTORM_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { PAGESTORM_BACKGROUND_SRC, PAGESTORM_HREF, pagestormPostOgImage } from "@/lib/pagestorm";
import {
  composeToyBoxPostOgDescription,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { clipOgDescription } from "@/lib/toybox-post-og";
import { getPagestormPostOgFields } from "@/lib/toybox-post-og-fields";
import { metadataRecordId } from "@/lib/static-detail-shell";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generatePagestormPostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const gameCopy = await getPagestormGameCopy(gameLocale);
  const copy = serviceMessages[serviceLocale].pagestorm;
  const fallbackDescription = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: gameCopy.title,
    serviceDescription: copy.subtitle,
  });
  const recordId = metadataRecordId(id);
  const fields = recordId ? await getPagestormPostOgFields(recordId) : null;
  const title = fields?.title.trim() || gameCopy.title;
  const description = fields
    ? clipOgDescription(fields.contentText, fallbackDescription)
    : fallbackDescription;
  const image = fields ? pagestormPostOgImage(fields.content) : PAGESTORM_PAGE_OG_IMAGE;
  return getServiceOgMetadata({
    serviceLocale,
    title,
    description,
    image,
    canonicalPath: recordId ? `${PAGESTORM_HREF}/${recordId}` : PAGESTORM_HREF,
  });
}

export async function renderPagestormPostPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const gameCopy = await getPagestormGameCopy(gameLocale);

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]" data-pagestorm-page="detail">
      <ServiceBackground
        src={PAGESTORM_BACKGROUND_SRC}
        imageClassName="object-[42%_center] sm:object-center"
      />
      <div className={TOYBOX_WIDE_SHELL_CLASS}>
        <StaticDetailShell>
          <PagestormPostView postId="" gameCopy={gameCopy} />
        </StaticDetailShell>
      </div>
    </div>
  );
}
