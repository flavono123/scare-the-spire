import {
  generateDefragmentMetadata,
  renderDefragmentPage,
} from "@/app/defragment/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateDefragmentMetadata(gameLocale);
}

export default async function LocalizedDefragmentPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderDefragmentPage(gameLocale);
}
