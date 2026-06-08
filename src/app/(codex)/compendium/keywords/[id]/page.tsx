export const dynamic = "force-static";
export const dynamicParams = false;

import BasePage, {
  generateMetadata as generateBaseMetadata,
  generateStaticParams,
} from "../../../_codex/keywords/[id]/page";
import { defaultRouteSearchParams } from "../../static-locale";

type DetailProps = {
  params: Promise<{ id: string }>;
};

export { generateStaticParams };

export function generateMetadata({ params }: DetailProps) {
  return generateBaseMetadata({
    params,
    searchParams: defaultRouteSearchParams(),
  });
}

export default function CompendiumKeywordDetailPage({ params }: DetailProps) {
  return BasePage({
    params,
    searchParams: defaultRouteSearchParams(),
  });
}
