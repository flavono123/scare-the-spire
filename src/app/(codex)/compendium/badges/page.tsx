export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../_codex/badges/page";
import { defaultRouteSearchParams } from "../static-locale";

export function generateMetadata() {
  return generateBaseMetadata({ searchParams: defaultRouteSearchParams() });
}

export default function CompendiumBadgesPage() {
  return BasePage({ searchParams: defaultRouteSearchParams() });
}
