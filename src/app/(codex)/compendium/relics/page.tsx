export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../codex/relics/page";
import { defaultRouteSearchParams } from "../static-locale";

export function generateMetadata() {
  return generateBaseMetadata({
    searchParams: defaultRouteSearchParams(),
  });
}

export default function CompendiumRelicsPage() {
  return BasePage({
    searchParams: defaultRouteSearchParams(),
  });
}
