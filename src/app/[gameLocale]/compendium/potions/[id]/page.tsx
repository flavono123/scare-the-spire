import { LocalizedCompendiumDirectDetailPage } from "@/components/codex/localized-compendium-direct-detail-page";
import { generateLocalizedStaticParams, generatePotionStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumPotionMetadata } from "@/lib/compendium-detail-metadata";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";
export const dynamicParams = false;
type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateStaticParams() {
  return generateLocalizedStaticParams(generatePotionStaticParams);
}

export async function generateMetadata({ params }: Props) {
  const { gameLocale, serviceLocale, id } = await getLocalePairFromParams(params);
  return generateCompendiumPotionMetadata(id, { gameLocale, serviceLocale });
}

export default async function LocalizedDetailPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return <LocalizedCompendiumDirectDetailPage resourceType="potions" id={id} gameLocale={gameLocale} />;
}
