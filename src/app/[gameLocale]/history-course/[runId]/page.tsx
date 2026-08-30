import {
  generateHistoryCourseRunMetadata,
  renderHistoryCourseRunPage,
} from "@/app/(main)/history-course/[runId]/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";
import { generateLocalizedHistoryCourseShellParams } from "@/lib/static-detail-shell";

export const dynamic = "force-static";
export const generateStaticParams = generateLocalizedHistoryCourseShellParams;

type Props = {
  params: Promise<LocaleRouteParams<{ runId: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, runId } = await getLocalePairFromParams(params);
  return generateHistoryCourseRunMetadata(gameLocale, runId);
}

export default async function LocalizedHistoryCourseRunPage() {
  return renderHistoryCourseRunPage();
}
