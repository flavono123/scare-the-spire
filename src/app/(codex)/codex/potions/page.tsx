import { getCodexPotions, getCodexCharacters } from "@/lib/codex-data";
import { PotionLibrary } from "@/components/codex/potion-library";

export default async function CodexPotionsPage() {
  const [potions, characters] = await Promise.all([
    getCodexPotions(),
    getCodexCharacters(),
  ]);

  return <PotionLibrary potions={potions} characters={characters} />;
}
