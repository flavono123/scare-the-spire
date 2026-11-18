export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../_codex/blitz-shop/page";
import { defaultRouteSearchParams } from "../static-locale";

export function generateMetadata() {
  return generateBaseMetadata({ searchParams: defaultRouteSearchParams() });
}

export default function CompendiumBlitzShopPage() {
  return BasePage({ searchParams: defaultRouteSearchParams() });
}
