import { getRelics, getChanges } from "@/lib/data";
import { RelicBrowser } from "@/components/relic-browser";

export default async function RelicsPage() {
  const [relics, changes] = await Promise.all([getRelics(), getChanges()]);

  return <RelicBrowser relics={relics} changes={changes} />;
}
