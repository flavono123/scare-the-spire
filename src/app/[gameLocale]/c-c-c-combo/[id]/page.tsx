import {
  generateComboPostMetadata,
  renderComboPostPage,
} from "@/app/c-c-c-combo/[id]/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";
import { generateLocalizedStaticDetailShellParams } from "@/lib/static-detail-shell";

export const dynamic = "force-static";
export const generateStaticParams = generateLocalizedStaticDetailShellParams;

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateComboPostMetadata(id, gameLocale);
}

export default async function LocalizedComboPostPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderComboPostPage(gameLocale);
}
