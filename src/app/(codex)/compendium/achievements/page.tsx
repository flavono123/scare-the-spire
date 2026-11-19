export const dynamic = "force-static";

import BasePage, { generateMetadata as generateBaseMetadata } from "../../_codex/achievements/page";
import { defaultRouteSearchParams } from "../static-locale";

export function generateMetadata() {
  return generateBaseMetadata({ searchParams: defaultRouteSearchParams() });
}

export default function CompendiumAchievementsPage() {
  return BasePage({ searchParams: defaultRouteSearchParams() });
}
