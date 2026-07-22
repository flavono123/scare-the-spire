import {
  generateHistoryCourseMetadata,
  renderHistoryCourseIndexPage,
} from "@/app/(main)/history-course/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateHistoryCourseMetadata(gameLocale);
}

export default async function LocalizedHistoryCoursePage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderHistoryCourseIndexPage(gameLocale);
}
