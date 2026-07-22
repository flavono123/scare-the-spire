import {
  generateThisOrThatMetadata,
  renderThisOrThatPage,
} from "@/app/this-or-that/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateThisOrThatMetadata(gameLocale);
}

export default async function LocalizedThisOrThatPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderThisOrThatPage(gameLocale);
}
