import { generateColorfulPhilosophersMetadata, renderColorfulPhilosophersPage } from "@/app/colorful-philosophers/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = { params: Promise<LocaleRouteParams> };

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateColorfulPhilosophersMetadata(gameLocale);
}

export default async function LocalizedColorfulPhilosophersPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderColorfulPhilosophersPage(gameLocale);
}
