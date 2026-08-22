import BasePage, {
  generateMetadata as generateBaseMetadata,
  generateStaticParams as generateBaseStaticParams,
} from "../../../_codex/modifiers/[id]/page";
import { defaultRouteSearchParams } from "../../static-locale";

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return generateBaseStaticParams();
}

export function generateMetadata({ params }: Props) {
  return generateBaseMetadata({ params, searchParams: defaultRouteSearchParams() });
}

export default function CompendiumModifierDetailPage({ params }: Props) {
  return BasePage({ params, searchParams: defaultRouteSearchParams() });
}
