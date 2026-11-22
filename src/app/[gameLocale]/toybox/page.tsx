import { generateToyboxMetadata, renderToyboxPage } from "@/app/toybox/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateToyboxMetadata(gameLocale);
}

export default async function LocalizedToyboxPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderToyboxPage(gameLocale);
}
