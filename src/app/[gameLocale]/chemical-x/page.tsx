import {
  generateChemicalXMetadata,
  renderChemicalXPage,
} from "@/app/chemical-x/page";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateChemicalXMetadata(gameLocale);
}

export default async function LocalizedChemicalXPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderChemicalXPage(gameLocale);
}
