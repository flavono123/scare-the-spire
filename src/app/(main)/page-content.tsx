import { getStories, getSTS2Stories, getCards, getRelics, getPotions, getChanges, getSTS2PatchLines } from "@/lib/data";
import { ByrdispatchTeaser } from "@/components/byrdispatch-teaser";
import { StoryFeed } from "@/components/story-feed";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { getStoryComposerPlaceholder } from "@/lib/sts2-game-ui-copy";
import { getLatestByrdispatchEntry } from "@/lib/byrdispatch";

export async function renderHome(gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  // STS2 entities, changes and patches are left to the client: only the story
  // modal and the composer read them, and neither renders on the server.
  const [stories, sts2Stories, cards, relics, potions, changes, sts2PatchLines, storyPlaceholder, latestByrdispatchEntry] = await Promise.all([
    getStories(),
    getSTS2Stories(),
    getCards(),
    getRelics(),
    getPotions(),
    getChanges(),
    getSTS2PatchLines(),
    getStoryComposerPlaceholder(gameLocale),
    getLatestByrdispatchEntry(),
  ]);
  const mergedStories = [...stories, ...sts2Stories];
  const referencedPatchLineIds = new Set(
    mergedStories.flatMap((story) => story.patchLineId ? [story.patchLineId] : []),
  );
  const referencedSts2PatchLines = sts2PatchLines.filter((line) => referencedPatchLineIds.has(line.id));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl space-y-2">
        <ByrdispatchTeaser
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          latestDate={latestByrdispatchEntry?.date}
        />
        {/* Feed */}
        <div className="rounded-lg border border-border bg-card/20">
          {mergedStories.length === 0 ? (
            <div className="px-4 py-16 text-center text-muted-foreground">
              아직 이야기가 없습니다
            </div>
          ) : (
            <StoryFeed
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              storyPlaceholder={storyPlaceholder}
              stories={mergedStories}
              cards={cards}
              relics={relics}
              potions={potions}
              changes={changes}
              sts2PatchLines={referencedSts2PatchLines}
            />
          )}
        </div>
      </main>
    </div>
  );
}
