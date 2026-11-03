import type { Metadata } from "next";
import { ConnectionsClient } from "@/components/vexing-puzzlebox/connections-client";
import { VexingPuzzleboxShell } from "@/components/vexing-puzzlebox/vexing-puzzlebox-shell";
import { getVexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { VEXING_PUZZLEBOX_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { composeToyBoxIndexOgDescription, getServiceOgMetadata } from "@/lib/service-metadata";
import { VEXING_PUZZLEBOX_HREF } from "@/lib/vexing-puzzlebox";
import { getConnectionsPuzzles } from "@/lib/vexing-puzzlebox-data";
import { serviceMessages } from "@/messages/service";

export async function generateVexingPuzzleboxMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const messages = serviceMessages[serviceLocale];
  return getServiceOgMetadata({
    serviceLocale,
    title: (await getVexingPuzzleboxGameCopy(gameLocale)).title,
    description: composeToyBoxIndexOgDescription(serviceLocale, messages.vexingPuzzlebox.subtitle),
    image: VEXING_PUZZLEBOX_PAGE_OG_IMAGE,
    canonicalPath: VEXING_PUZZLEBOX_HREF,
  });
}

export async function renderVexingPuzzleboxPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const [puzzles, gameCopy] = await Promise.all([
    getConnectionsPuzzles(gameLocale),
    getVexingPuzzleboxGameCopy(gameLocale),
  ]);
  return (
    <VexingPuzzleboxShell
      active="connections"
      gameCopy={gameCopy}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
    >
      <ConnectionsClient
        puzzles={puzzles}
        gameCopy={gameCopy}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
      />
    </VexingPuzzleboxShell>
  );
}
