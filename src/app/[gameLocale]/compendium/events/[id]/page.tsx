import { LocalizedCompendiumDirectDetailPage } from "@/components/codex/localized-compendium-direct-detail-page";
import { generateEventStaticParams, generateLocalizedStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumEventMetadata } from "@/lib/compendium-detail-metadata";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";
export const dynamicParams = false;
type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateStaticParams() {
  return generateLocalizedStaticParams(generateEventStaticParams);
}

export async function generateMetadata({ params }: Props) {
  const { gameLocale, serviceLocale, id } = await getLocalePairFromParams(params);
  return generateCompendiumEventMetadata(id, { gameLocale, serviceLocale });
}

export default async function LocalizedDetailPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return <LocalizedCompendiumDirectDetailPage resourceType="events" id={id} gameLocale={gameLocale} />;
}
