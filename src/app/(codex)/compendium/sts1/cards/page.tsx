export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_sts1/cards/page";
import { defaultRouteSearchParams } from "../../static-locale";

export function generateMetadata() {
  return generateBaseMetadata({
    searchParams: defaultRouteSearchParams(),
  });
}

export default function Sts1CompendiumCardsPage() {
  return BasePage({
    searchParams: defaultRouteSearchParams(),
  });
}
