import { LocalizedCompendiumDirectDetailPage } from "@/components/codex/localized-compendium-direct-detail-page";
import { generateEncounterStaticParams, generateLocalizedStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumEncounterMetadata } from "@/lib/compendium-detail-metadata";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";
export const dynamicParams = false;
type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateStaticParams() {
  return generateLocalizedStaticParams(generateEncounterStaticParams);
}

export async function generateMetadata({ params }: Props) {
  const { gameLocale, serviceLocale, id } = await getLocalePairFromParams(params);
  return generateCompendiumEncounterMetadata(id, { gameLocale, serviceLocale });
}

export default async function LocalizedDetailPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return <LocalizedCompendiumDirectDetailPage resourceType="encounters" id={id} gameLocale={gameLocale} />;
}
