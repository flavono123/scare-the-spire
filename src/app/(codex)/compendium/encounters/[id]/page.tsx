export const dynamic = "force-static";
export const dynamicParams = false;

import { generateEncounterStaticParams } from "@/lib/codex-static-params";
import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_codex/encounters/[id]/page";

export const generateMetadata = generateBaseMetadata;

export async function generateStaticParams() {
  return generateEncounterStaticParams();
}

export default BasePage;
