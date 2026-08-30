import type { Metadata } from "next";
import { StaticDetailShell } from "@/components/static-detail-shell";
import { FavoriteTournamentPostView } from "@/components/this-or-that/favorite-tournament-post-view";
import { getDecisionsDecisionsGameCopy, getThisOrThatGameCopy } from "@/lib/borrowed-game-copy";
import { FAVORITE_TOURNAMENT_HREF } from "@/lib/favorite-tournament";
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

export async function generateFavoriteTournamentPostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].favoriteTournament;
  const title = serviceMessages[serviceLocale].nav.favoriteTournament;
  const description = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: title,
    serviceDescription: copy.subtitle,
  });
  const recordId = metadataRecordId(id);
  return getServiceOgMetadata({
    serviceLocale,
    title,
    description,
    image: THIS_OR_THAT_PAGE_OG_IMAGE,
    canonicalPath: recordId ? `${FAVORITE_TOURNAMENT_HREF}/${recordId}` : FAVORITE_TOURNAMENT_HREF,
  });
}

export async function renderFavoriteTournamentPostPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const [totCopy, decisionsCopy] = await Promise.all([
    getThisOrThatGameCopy(gameLocale),
    getDecisionsDecisionsGameCopy(gameLocale),
  ]);

  return (
    <div className={TOYBOX_WIDE_SHELL_CLASS}>
      <StaticDetailShell>
        <FavoriteTournamentPostView
          postId=""
          gameLocale={gameLocale}
          votePrompt={totCopy.votePrompt}
          voteDone={totCopy.voteDone}
          presetLabels={decisionsCopy.presetLabels}
        />
      </StaticDetailShell>
    </div>
  );
}
