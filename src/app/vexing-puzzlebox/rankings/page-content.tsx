import type { Metadata } from "next";
import { RankingsClient } from "@/components/vexing-puzzlebox/rankings-client";
import { VexingPuzzleboxShell } from "@/components/vexing-puzzlebox/vexing-puzzlebox-shell";
import { getVexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { VEXING_PUZZLEBOX_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { composeToyBoxIndexOgDescription, getServiceOgMetadata } from "@/lib/service-metadata";
import { VEXING_PUZZLEBOX_RANKINGS_HREF } from "@/lib/vexing-puzzlebox";
import { getRankingsBoards } from "@/lib/vexing-puzzlebox-data";
import { serviceMessages } from "@/messages/service";

export async function generateRankingsMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const messages = serviceMessages[serviceLocale];
  return getServiceOgMetadata({
    serviceLocale,
    title: `${(await getVexingPuzzleboxGameCopy(gameLocale)).title} ${messages.vexingPuzzlebox.tabRankings}`,
    description: composeToyBoxIndexOgDescription(serviceLocale, messages.vexingPuzzlebox.subtitle),
    image: VEXING_PUZZLEBOX_PAGE_OG_IMAGE,
    canonicalPath: VEXING_PUZZLEBOX_RANKINGS_HREF,
  });
}

export async function renderRankingsPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const [{ connections, quizSets }, gameCopy] = await Promise.all([
    getRankingsBoards(gameLocale),
    getVexingPuzzleboxGameCopy(gameLocale),
  ]);
  return (
    <VexingPuzzleboxShell
      active="rankings"
      gameCopy={gameCopy}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
    >
      <RankingsClient
        connections={connections}
        quizSets={quizSets}
        gameCopy={gameCopy}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
      />
    </VexingPuzzleboxShell>
  );
}
