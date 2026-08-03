import {
  generateContactMetadata,
  renderContactPage,
} from "@/app/(main)/contact/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateContactMetadata(gameLocale);
}

export default async function LocalizedContactPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderContactPage(gameLocale);
}
