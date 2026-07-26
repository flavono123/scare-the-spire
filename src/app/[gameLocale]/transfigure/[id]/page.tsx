import {
  generateTransfigurePostMetadata,
  renderTransfigurePostPage,
} from "@/app/transfigure/[id]/page-content";
import {
  getLocalePairFromParams,
  type LocaleRouteParams,
} from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateTransfigurePostMetadata(id, gameLocale);
}

export default async function LocalizedTransfigurePostPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return renderTransfigurePostPage(id, gameLocale);
}
