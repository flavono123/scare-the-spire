import { getPotions, getChanges } from "@/lib/data";
import { PotionBrowser } from "@/components/potion-browser";

export default async function PotionsPage() {
  const [potions, changes] = await Promise.all([getPotions(), getChanges()]);

  return <PotionBrowser potions={potions} changes={changes} />;
}
