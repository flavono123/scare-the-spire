import type { Metadata } from "next";
import Link from "next/link";
import { StaticDetailShell } from "@/components/static-detail-shell";
import { StoryDetail } from "@/components/story-feed";
import { getCards, getChanges, getPotions, getRelics, getStories, getSTS2PatchLines, getSTS2Stories } from "@/lib/data";
import { getServiceLocaleForGameLocale, localizeHrefWithGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { getHomeServiceMetadata } from "@/lib/service-metadata";
import { serviceMessages } from "@/messages/service";

/**
 * The prerendered shell has no story id, so this is the home metadata; the
 * main Worker fills a story's title, description and image (workers/detail-shell-og.ts).
 */
export function generateStoryMetadata(gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE): Metadata {
  return getHomeServiceMetadata(getServiceLocaleForGameLocale(gameLocale));
}

export async function renderStoryPage(gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const [stories, sts2Stories, cards, relics, potions, changes, sts2PatchLines] = await Promise.all([
    getStories(),
    getSTS2Stories(),
    getCards(),
    getRelics(),
    getPotions(),
    getChanges(),
    getSTS2PatchLines(),
  ]);
  const mergedStories = [...stories, ...sts2Stories];
  const referencedPatchLineIds = new Set(
    mergedStories.flatMap((story) => story.patchLineId ? [story.patchLineId] : []),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl space-y-3 px-3 py-4 sm:px-0">
        <Link
          href={localizeHrefWithGameLocale("/", serviceLocale, gameLocale)}
          prefetch={false}
          className="inline-flex items-center gap-1 font-service text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span aria-hidden>←</span>
          {serviceMessages[serviceLocale].placeIndex.backHome}
        </Link>
        <StaticDetailShell idProp="storyId">
          <StoryDetail
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
            stories={mergedStories}
            cards={cards}
            relics={relics}
            potions={potions}
            changes={changes}
            sts2PatchLines={sts2PatchLines.filter((line) => referencedPatchLineIds.has(line.id))}
          />
        </StaticDetailShell>
      </main>
    </div>
  );
}
