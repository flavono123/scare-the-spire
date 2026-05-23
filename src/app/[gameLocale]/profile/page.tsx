import { generateProfileMetadata, renderProfilePage } from "@/app/(main)/profile/page";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateProfileMetadata(gameLocale);
}

export default async function LocalizedProfilePage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderProfilePage(gameLocale);
}
