import type { Metadata } from "next";
import { PagestormPostView } from "@/components/pagestorm/pagestorm-post-view";
import { ServiceBackground } from "@/components/service-background";
import { StaticDetailShell } from "@/components/static-detail-shell";
import { getPagestormGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { PAGESTORM_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { PAGESTORM_BACKGROUND_SRC, PAGESTORM_HREF } from "@/lib/pagestorm";
import {
  composeToyBoxPostOgDescription,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
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
  const description = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: gameCopy.title,
    serviceDescription: copy.subtitle,
  });
  const recordId = metadataRecordId(id);
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description,
    image: PAGESTORM_PAGE_OG_IMAGE,
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
