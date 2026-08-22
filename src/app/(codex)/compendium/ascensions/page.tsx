export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../_codex/ascensions/page";
import { defaultRouteSearchParams } from "../static-locale";

export function generateMetadata() {
  return generateBaseMetadata({ searchParams: defaultRouteSearchParams() });
}

export default function CompendiumAscensionsPage() {
  return BasePage({ searchParams: defaultRouteSearchParams() });
}
