import type { Metadata } from "next";
import { StaticDetailShell } from "@/components/static-detail-shell";
import { ThisOrThatPostView } from "@/components/this-or-that/post-view";
import { getThisOrThatGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { THIS_OR_THAT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  composeToyBoxPostOgDescription,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { metadataRecordId } from "@/lib/static-detail-shell";
import {
  getThisOrThatPostOgFields,
  toyboxResourceOgImageUrl,
  truncateOgTitle,
} from "@/lib/toybox-post-og";
import { serviceMessages } from "@/messages/service";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";

export async function generateThisOrThatPostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const gameCopy = await getThisOrThatGameCopy(gameLocale);
  const copy = serviceMessages[serviceLocale].thisOrThat;
  const description = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: serviceMessages[serviceLocale].nav.thisOrThat,
    serviceDescription: copy.subtitle,
  });
  const recordId = metadataRecordId(id);
  const fallback = getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description,
    image: THIS_OR_THAT_PAGE_OG_IMAGE,
    canonicalPath: recordId ? `/this-or-that/${recordId}` : "/this-or-that",
  });
  if (!recordId) return fallback;

  const fields = await getThisOrThatPostOgFields(recordId);
  if (!fields) return fallback;
  const title = truncateOgTitle(fields.reason) || gameCopy.title;
  const imageUrl = toyboxResourceOgImageUrl(fields.leftType, fields.leftId);
  return getServiceOgMetadata({
    serviceLocale,
    title,
    description,
    image: imageUrl
      ? { url: imageUrl, alt: title }
      : THIS_OR_THAT_PAGE_OG_IMAGE,
    canonicalPath: `/this-or-that/${recordId}`,
  });
}

export async function renderThisOrThatPostPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const gameCopy = await getThisOrThatGameCopy(gameLocale);

  return (
    <div className={TOYBOX_WIDE_SHELL_CLASS}>
      <StaticDetailShell>
        <ThisOrThatPostView
          postId=""
          gameLocale={gameLocale}
          title={gameCopy.title}
          votePrompt={gameCopy.votePrompt}
          voteDone={gameCopy.voteDone}
        />
      </StaticDetailShell>
    </div>
  );
}
