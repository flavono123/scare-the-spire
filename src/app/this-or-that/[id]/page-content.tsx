import type { Metadata } from "next";
import { ThisOrThatPostView } from "@/components/this-or-that/post-view";
import { getThisOrThatGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { THIS_OR_THAT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  composeToyBoxPostOgDescription,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import {
  getThisOrThatPostOgFields,
  toyboxResourceOgImageUrl,
  truncateOgTitle,
} from "@/lib/toybox-post-og";
import { serviceMessages } from "@/messages/service";

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
    serviceDescription: copy.metadata.description,
  });
  const fallback = getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description,
    image: THIS_OR_THAT_PAGE_OG_IMAGE,
    canonicalPath: id ? `/this-or-that/${id}` : "/this-or-that",
  });
  if (!id) return fallback;

  const fields = await getThisOrThatPostOgFields(id);
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
    canonicalPath: `/this-or-that/${id}`,
  });
}

export async function renderThisOrThatPostPage(
  id: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const gameCopy = await getThisOrThatGameCopy(gameLocale);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <ThisOrThatPostView
        postId={id}
        gameLocale={gameLocale}
        title={gameCopy.title}
        votePrompt={gameCopy.votePrompt}
        voteDone={gameCopy.voteDone}
      />
    </div>
  );
}
