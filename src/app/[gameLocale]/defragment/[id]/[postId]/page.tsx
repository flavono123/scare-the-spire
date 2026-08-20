import {
  generateDefragmentFederatedPostMetadata,
  renderDefragmentFederatedPostPage,
} from "@/app/defragment/[id]/[postId]/page-content";
import {
  getLocalePairFromParams,
  type LocaleRouteParams,
} from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams<{ id: string; postId: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id: service, postId } = await getLocalePairFromParams(params);
  return generateDefragmentFederatedPostMetadata(service, postId, gameLocale);
}

export default async function LocalizedDefragmentFederatedPostPage({ params }: Props) {
  const { gameLocale, id: service, postId } = await getLocalePairFromParams(params);
  return renderDefragmentFederatedPostPage(service, postId, gameLocale);
}
