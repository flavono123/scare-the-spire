import { generateDebateMetadata, renderDebatePage } from "@/app/debate/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateDebateMetadata(gameLocale);
}

export default async function LocalizedDebatePage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderDebatePage(gameLocale);
}
