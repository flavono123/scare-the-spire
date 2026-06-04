import {
  generateCompendiumBestiaryMetadata,
  renderCompendiumBestiaryPage,
} from "@/app/(codex)/compendium/bestiary/page";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";

type Props = {
  params: Promise<LocaleRouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateCompendiumBestiaryMetadata(gameLocale, await searchParams);
}

export default async function LocalizedPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderCompendiumBestiaryPage(gameLocale);
}
