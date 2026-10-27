import BasePage, {
  generateMetadata as generateBaseMetadata,
  generateStaticParams as generateBaseStaticParams,
} from "@/app/(codex)/_codex/modifiers/[id]/page";
import { generateLocalizedStaticParams } from "@/lib/codex-static-params";
import {
  getLocalePairFromParams,
  searchRecordForGameLocale,
  type LocaleRouteParams,
} from "@/lib/locale-routing";
import { withSearchCanonical } from "@/lib/search-canonical";

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<LocaleRouteParams<{ id: string }>> };

export function generateStaticParams() {
  return generateLocalizedStaticParams(generateBaseStaticParams);
}

export async function generateMetadata({ params }: Props) {
  const { gameLocale, serviceLocale, id } = await getLocalePairFromParams(params);
  const metadata = await generateBaseMetadata({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
  if (!metadata.title) return metadata;
  // Same canonical, hreflang, and og:url as every other Compendium detail page.
  return withSearchCanonical(
    metadata,
    `/compendium/modifiers/${encodeURIComponent(id.toLowerCase())}`,
    serviceLocale,
  );
}

async function LocalizedModifierDetailPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return BasePage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}

export default LocalizedModifierDetailPage;
