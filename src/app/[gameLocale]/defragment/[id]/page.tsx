import {
  generateDefragmentPostMetadata,
  renderDefragmentPostPage,
} from "@/app/defragment/[id]/page-content";
import {
  getLocalePairFromParams,
  type LocaleRouteParams,
} from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateDefragmentPostMetadata(id, gameLocale);
}

export default async function LocalizedDefragmentPostPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return renderDefragmentPostPage(id, gameLocale);
}
