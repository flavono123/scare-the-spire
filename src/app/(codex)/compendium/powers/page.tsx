export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../codex/powers/page";
import { defaultRouteSearchParams } from "../static-locale";

export function generateMetadata() {
  return generateBaseMetadata({
    searchParams: defaultRouteSearchParams(),
  });
}

export default function CompendiumPowersPage() {
  return BasePage({
    searchParams: defaultRouteSearchParams(),
  });
}
