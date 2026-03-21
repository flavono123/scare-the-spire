import { getCodexCards, getCodexCharacters } from "@/lib/codex-data";
import { CardLibrary } from "@/components/codex/card-library";

export default async function CodexCardsPage() {
  const [cards, characters] = await Promise.all([
    getCodexCards(),
    getCodexCharacters(),
  ]);

  return <CardLibrary cards={cards} characters={characters} />;
}
