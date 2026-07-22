import {
  generateThisOrThatPostMetadata,
  renderThisOrThatPostPage,
} from "@/app/this-or-that/[id]/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateThisOrThatPostMetadata(id, gameLocale);
}

export default async function LocalizedThisOrThatPostPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return renderThisOrThatPostPage(id, gameLocale);
}
