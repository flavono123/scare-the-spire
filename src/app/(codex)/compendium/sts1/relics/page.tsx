export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_sts1/relics/page";
import { defaultRouteSearchParams } from "../../static-locale";

export function generateMetadata() {
  return generateBaseMetadata({
    searchParams: defaultRouteSearchParams(),
  });
}

export default function Sts1CompendiumRelicsPage() {
  return BasePage({
    searchParams: defaultRouteSearchParams(),
  });
}
