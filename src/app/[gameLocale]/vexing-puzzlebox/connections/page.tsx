import {
  generateConnectionsMetadata,
  renderConnectionsPage,
} from "@/app/vexing-puzzlebox/connections/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateConnectionsMetadata(gameLocale);
}

export default async function LocalizedConnectionsPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderConnectionsPage(gameLocale);
}
