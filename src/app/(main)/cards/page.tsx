import { getCards, getChanges } from "@/lib/data";
import { CardBrowser } from "@/components/card-browser";

export default async function CardsPage() {
  const [cards, changes] = await Promise.all([getCards(), getChanges()]);

  return <CardBrowser cards={cards} changes={changes} />;
}
