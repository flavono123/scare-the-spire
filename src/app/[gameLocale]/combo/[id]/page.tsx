import {
  generateComboPostMetadata,
  renderComboPostPage,
} from "@/app/combo/[id]/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateComboPostMetadata(id, gameLocale);
}

export default async function LocalizedComboPostPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return renderComboPostPage(id, gameLocale);
}
