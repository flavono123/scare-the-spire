import {
  generateHistoryCourseRunMetadata,
  renderHistoryCourseRunPage,
} from "@/app/(main)/history-course/[runId]/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams<{ runId: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateHistoryCourseRunMetadata(gameLocale);
}

export default async function LocalizedHistoryCourseRunPage({ params }: Props) {
  const { runId } = await getLocalePairFromParams(params);
  return renderHistoryCourseRunPage(runId);
}
