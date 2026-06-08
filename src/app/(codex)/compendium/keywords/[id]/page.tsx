export const dynamic = "force-static";
export const dynamicParams = false;

import BasePage, {
  generateMetadata as generateBaseMetadata,
  generateStaticParams,
} from "../../../_codex/keywords/[id]/page";
import { defaultRouteSearchParams, type RouteSearchParams } from "../../static-locale";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: RouteSearchParams;
};

export { generateStaticParams };

export function generateMetadata({ params, searchParams }: DetailProps) {
  return generateBaseMetadata({
    params,
    searchParams: defaultRouteSearchParams(searchParams),
  });
}

export default function CompendiumKeywordDetailPage({ params, searchParams }: DetailProps) {
  return BasePage({
    params,
    searchParams: defaultRouteSearchParams(searchParams),
  });
}
