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
  // Only the shell's metadata: a record's own fields are the main Worker's job
  // (workers/detail-shell-og.ts, on with DETAIL_SHELL_OG=d1), not the build's.
  return getServiceOgMetadata({
    serviceLocale,
    title: gameCopy.title,
    description,
    image: THIS_OR_THAT_PAGE_OG_IMAGE,
    canonicalPath: recordId ? `/this-or-that/${recordId}` : undefined,
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
