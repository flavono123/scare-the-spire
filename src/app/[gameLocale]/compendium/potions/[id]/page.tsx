import { generateMetadata as generateBaseMetadata } from "@/app/(codex)/_codex/potions/[id]/page";
import { LocalizedCompendiumDirectDetailPage } from "@/components/codex/localized-compendium-direct-detail-page";
import { generateLocalizedStaticParams, generatePotionStaticParams } from "@/lib/codex-static-params";
import { getLocalePairFromParams, searchRecordForGameLocale, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";
export const dynamicParams = false;
type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateStaticParams() {
  return generateLocalizedStaticParams(generatePotionStaticParams);
}

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateBaseMetadata({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}

export default async function LocalizedDetailPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return <LocalizedCompendiumDirectDetailPage resourceType="potions" id={id} gameLocale={gameLocale} />;
}
