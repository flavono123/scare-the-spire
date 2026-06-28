import { LocalizedCompendiumDirectDetailPage } from "@/components/codex/localized-compendium-direct-detail-page";
import { generateCardStaticParams, generateLocalizedStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumCardMetadata } from "@/lib/compendium-detail-metadata";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";
export const dynamicParams = false;
type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateStaticParams() {
  return generateLocalizedStaticParams(generateCardStaticParams);
}

export async function generateMetadata({ params }: Props) {
  const { gameLocale, serviceLocale, id } = await getLocalePairFromParams(params);
  return generateCompendiumCardMetadata(id, { gameLocale, serviceLocale });
}

export default async function LocalizedDetailPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return <LocalizedCompendiumDirectDetailPage resourceType="cards" id={id} gameLocale={gameLocale} />;
}
