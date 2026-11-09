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
  // Only the shell's metadata: a record's own fields are the main Worker's job
  // (workers/detail-shell-og.ts, on with DETAIL_SHELL_OG=d1), not the build's.
  return getServiceOgMetadata({
    serviceLocale,
    title: copy.transfigureTitle,
    description,
    image: TRANSFIGURE_PAGE_OG_IMAGE,
    canonicalPath: recordId ? `/transfigure/${recordId}` : undefined,
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
