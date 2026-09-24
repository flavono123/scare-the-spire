import { generateLocalizedStaticDetailShellParams } from "@/lib/static-detail-shell";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";
import {
  generateColorfulPhilosopherPostMetadata,
  renderColorfulPhilosopherPostPage,
} from "@/app/colorful-philosophers/[id]/page-content";

export const dynamic = "force-static";
export const generateStaticParams = generateLocalizedStaticDetailShellParams;

type Props = { params: Promise<LocaleRouteParams<{ id: string }>> };

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateColorfulPhilosopherPostMetadata(id, gameLocale);
}

export default function LocalizedColorfulPhilosopherPostPage() {
  return renderColorfulPhilosopherPostPage();
}
