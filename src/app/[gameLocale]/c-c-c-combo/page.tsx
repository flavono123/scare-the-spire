import {
  generateComboMetadata,
  renderComboPage,
} from "@/app/c-c-c-combo/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateComboMetadata(gameLocale);
}

export default async function LocalizedComboPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderComboPage(gameLocale);
}
