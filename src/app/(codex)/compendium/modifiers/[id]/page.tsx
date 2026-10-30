import BasePage, {
  generateMetadata as generateBaseMetadata,
  generateStaticParams as generateBaseStaticParams,
} from "../../../_codex/modifiers/[id]/page";
import { withSearchCanonical } from "@/lib/search-canonical";
import { defaultRouteSearchParams } from "../../static-locale";

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return generateBaseStaticParams();
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const metadata = await generateBaseMetadata({ params, searchParams: defaultRouteSearchParams() });
  if (!metadata.title) return metadata;
  // Same canonical, hreflang, and og:url as every other Compendium detail page.
  return withSearchCanonical(metadata, `/compendium/modifiers/${encodeURIComponent(id.toLowerCase())}`, "ko");
}

export default function CompendiumModifierDetailPage({ params }: Props) {
  return BasePage({ params, searchParams: defaultRouteSearchParams() });
}
