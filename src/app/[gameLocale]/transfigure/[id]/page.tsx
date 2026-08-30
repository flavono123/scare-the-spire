import {
  generateTransfigurePostMetadata,
  renderTransfigurePostPage,
} from "@/app/transfigure/[id]/page-content";
import {
  getLocalePairFromParams,
  type LocaleRouteParams,
} from "@/lib/locale-routing";
import { generateLocalizedStaticDetailShellParams } from "@/lib/static-detail-shell";

export const dynamic = "force-static";
export const generateStaticParams = generateLocalizedStaticDetailShellParams;

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateTransfigurePostMetadata(id, gameLocale);
}

export default async function LocalizedTransfigurePostPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderTransfigurePostPage(gameLocale);
}
