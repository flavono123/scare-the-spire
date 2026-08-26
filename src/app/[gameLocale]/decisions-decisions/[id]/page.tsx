import {
  generateDecisionsDecisionsPostMetadata,
  renderDecisionsDecisionsPostPage,
} from "@/app/decisions-decisions/[id]/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateDecisionsDecisionsPostMetadata(id, gameLocale);
}

export default async function LocalizedDecisionsDecisionsPostPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return renderDecisionsDecisionsPostPage(id, gameLocale);
}
