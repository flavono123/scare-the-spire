import {
  generateDecisionsDecisionsMetadata,
  renderDecisionsDecisionsPage,
} from "@/app/decisions-decisions/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateDecisionsDecisionsMetadata(gameLocale);
}

export default async function LocalizedDecisionsDecisionsPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderDecisionsDecisionsPage(gameLocale);
}
