import { getStories, getSTS2Stories, getCards, getRelics, getPotions, getChanges, getSTS2Changes, getSTS2Patches } from "@/lib/data";
import { StoryFeed } from "@/components/story-feed";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";

export async function renderHome(gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const [stories, sts2Stories, cards, relics, potions, changes, sts2Changes, sts2Patches, sts2Entities] = await Promise.all([
    getStories(),
    getSTS2Stories(),
    getCards(),
    getRelics(),
    getPotions(),
    getChanges(),
    getSTS2Changes(),
    getSTS2Patches(),
    loadAllEntities({ gameLocale }),
  ]);
  const mergedStories = [...stories, ...sts2Stories];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl">
        {/* Feed */}
        <div className="rounded-lg border border-border bg-card/20">
          {mergedStories.length === 0 ? (
            <div className="px-4 py-16 text-center text-muted-foreground">
              아직 이야기가 없습니다
            </div>
          ) : (
            <StoryFeed
              serviceLocale={serviceLocale}
              stories={mergedStories}
              cards={cards}
              relics={relics}
              potions={potions}
              changes={changes}
              sts2Changes={sts2Changes}
              sts2Patches={sts2Patches}
              sts2Entities={sts2Entities}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default async function Home() {
  return renderHome();
}
