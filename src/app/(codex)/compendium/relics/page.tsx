export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../_codex/relics/page";
import { defaultRouteSearchParams, type RouteSearchParams } from "../static-locale";

export function generateMetadata({ searchParams }: { searchParams: RouteSearchParams }) {
  return generateBaseMetadata({
    searchParams: defaultRouteSearchParams(searchParams),
  });
}

export default function CompendiumRelicsPage({ searchParams }: { searchParams: RouteSearchParams }) {
  return BasePage({
    searchParams: defaultRouteSearchParams(searchParams),
  });
}
