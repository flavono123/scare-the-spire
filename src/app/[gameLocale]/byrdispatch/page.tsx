import {
  generateShaNewsMetadata,
  renderShaNewsPage,
} from "@/app/(main)/byrdispatch/page";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateShaNewsMetadata(gameLocale);
}

export default async function LocalizedShaNewsPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderShaNewsPage(gameLocale);
}
