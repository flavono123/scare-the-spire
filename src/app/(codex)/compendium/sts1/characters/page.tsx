export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_sts1/characters/page";
import { defaultRouteSearchParams } from "../../static-locale";

export function generateMetadata() {
  return generateBaseMetadata({
    searchParams: defaultRouteSearchParams(),
  });
}

export default function Sts1CompendiumCharactersPage() {
  return BasePage({
    searchParams: defaultRouteSearchParams(),
  });
}
