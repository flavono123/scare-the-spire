import {
  generateChemicalXPostMetadata,
  renderChemicalXPostPage,
} from "@/app/chemical-x/[id]/page";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateChemicalXPostMetadata(gameLocale);
}

export default async function LocalizedChemicalXPostPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return renderChemicalXPostPage(id, gameLocale);
}
