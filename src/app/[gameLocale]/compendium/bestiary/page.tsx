import {
  generateCompendiumBestiaryMetadata,
  renderCompendiumBestiaryPage,
} from "@/app/(codex)/compendium/bestiary/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateCompendiumBestiaryMetadata(gameLocale);
}

export default async function LocalizedPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderCompendiumBestiaryPage(gameLocale);
}
