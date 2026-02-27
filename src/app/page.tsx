import { getStories, getCards, getRelics, getPotions, getChanges } from "@/lib/data";
import { StoryFeed } from "@/components/story-feed";

export default async function Home() {
  const [stories, cards, relics, potions, changes] = await Promise.all([
    getStories(),
    getCards(),
    getRelics(),
    getPotions(),
    getChanges(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-2xl">
        {/* Feed */}
        <div className="rounded-lg border border-border bg-card/20">
          {stories.length === 0 ? (
            <div className="px-4 py-16 text-center text-muted-foreground">
              아직 이야기가 없습니다
            </div>
          ) : (
            <StoryFeed stories={stories} cards={cards} relics={relics} potions={potions} changes={changes} />
          )}
        </div>
      </main>
    </div>
  );
}
