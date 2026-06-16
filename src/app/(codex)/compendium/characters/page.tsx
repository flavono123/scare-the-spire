export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../_codex/characters/page";
import { defaultRouteSearchParams } from "../static-locale";

export function generateMetadata() {
  return generateBaseMetadata({
    searchParams: defaultRouteSearchParams(),
  });
}

export default function CompendiumCharactersPage() {
  return BasePage({
    searchParams: defaultRouteSearchParams(),
  });
}
