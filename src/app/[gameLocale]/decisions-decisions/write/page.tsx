import {
  generateDecisionsDecisionsWriteMetadata,
  renderDecisionsDecisionsWritePage,
} from "@/app/decisions-decisions/write/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateDecisionsDecisionsWriteMetadata(gameLocale);
}

export default async function LocalizedDecisionsDecisionsWritePage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderDecisionsDecisionsWritePage(gameLocale);
}
