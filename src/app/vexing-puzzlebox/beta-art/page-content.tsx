import type { Metadata } from "next";
import { BetaArtClient } from "@/components/vexing-puzzlebox/beta-art-client";
import { VexingPuzzleboxShell } from "@/components/vexing-puzzlebox/vexing-puzzlebox-shell";
import { getVexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { VEXING_PUZZLEBOX_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { composeToyBoxIndexOgDescription, getServiceOgMetadata } from "@/lib/service-metadata";
import { VEXING_PUZZLEBOX_BETA_ART_HREF } from "@/lib/vexing-puzzlebox";
import { getBetaArtCatalog } from "@/lib/vexing-puzzlebox-data";
import { serviceMessages } from "@/messages/service";

export async function generateBetaArtMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const messages = serviceMessages[serviceLocale];
  return getServiceOgMetadata({
    serviceLocale,
    title: `${(await getVexingPuzzleboxGameCopy(gameLocale)).title} ${messages.vexingPuzzlebox.tabBetaArt}`,
    description: composeToyBoxIndexOgDescription(serviceLocale, messages.vexingPuzzlebox.subtitle),
    image: VEXING_PUZZLEBOX_PAGE_OG_IMAGE,
    canonicalPath: VEXING_PUZZLEBOX_BETA_ART_HREF,
  });
}

export async function renderBetaArtPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const [{ entries, characters }, gameCopy] = await Promise.all([
    getBetaArtCatalog(gameLocale),
    getVexingPuzzleboxGameCopy(gameLocale),
  ]);
  return (
    <VexingPuzzleboxShell
      active="beta-art"
      title={gameCopy.title}
      hero={gameCopy.hero}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
    >
      <BetaArtClient
        entries={entries}
        characters={characters}
        gameCopy={gameCopy}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
      />
    </VexingPuzzleboxShell>
  );
}
