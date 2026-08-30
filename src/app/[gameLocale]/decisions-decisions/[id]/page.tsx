import {
  generateDecisionsDecisionsPostMetadata,
  renderDecisionsDecisionsPostPage,
} from "@/app/decisions-decisions/[id]/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";
import { generateLocalizedStaticDetailShellParams } from "@/lib/static-detail-shell";

export const dynamic = "force-static";
export const generateStaticParams = generateLocalizedStaticDetailShellParams;

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateDecisionsDecisionsPostMetadata(id, gameLocale);
}

export default async function LocalizedDecisionsDecisionsPostPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderDecisionsDecisionsPostPage(gameLocale);
}
