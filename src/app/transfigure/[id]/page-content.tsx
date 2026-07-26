import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TransfigurePostView } from "@/components/transfigure/transfigure-post-view";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { devToolsEnabled } from "@/lib/dev-tools";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { TRANSFIGURE_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";

export async function generateTransfigurePostMetadata(
  _id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = getServiceMetadataCopy(serviceLocale);
  return {
    ...getServiceOgMetadata({
      serviceLocale,
      title: copy.transfigureTitle,
      description: copy.transfigureDescription,
      image: TRANSFIGURE_PAGE_OG_IMAGE,
    }),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export async function renderTransfigurePostPage(
  id: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  if (!devToolsEnabled()) {
    notFound();
  }

  const gameUi = await getCodexGameUiLabels(gameLocale);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <TransfigurePostView
        postId={id}
        gameLocale={gameLocale}
        upgradeLabel={gameUi.cardLibrary.viewUpgrades}
      />
    </div>
  );
}
