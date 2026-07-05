import {
  generateByrdispatchMetadata,
  renderByrdispatchPage,
} from "@/app/(main)/byrdispatch/page";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateByrdispatchMetadata(gameLocale);
}

export default async function LocalizedByrdispatchPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderByrdispatchPage(gameLocale);
}
