import { generateStoryMetadata, renderStoryPage } from "@/app/(main)/stories/[id]/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";
import { generateLocalizedStaticDetailShellParams } from "@/lib/static-detail-shell";

export const dynamic = "force-static";
export const generateStaticParams = generateLocalizedStaticDetailShellParams;

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateStoryMetadata(gameLocale);
}

export default async function LocalizedStoryPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderStoryPage(gameLocale);
}
