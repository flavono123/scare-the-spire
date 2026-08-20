import {
  generateDefragmentFederatedPostMetadata,
  renderDefragmentFederatedPostPage,
} from "@/app/defragment/[service]/[id]/page-content";
import {
  getLocalePairFromParams,
  type LocaleRouteParams,
} from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams<{ service: string; id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, service, id } = await getLocalePairFromParams(params);
  return generateDefragmentFederatedPostMetadata(service, id, gameLocale);
}

export default async function LocalizedDefragmentFederatedPostPage({ params }: Props) {
  const { gameLocale, service, id } = await getLocalePairFromParams(params);
  return renderDefragmentFederatedPostPage(service, id, gameLocale);
}
