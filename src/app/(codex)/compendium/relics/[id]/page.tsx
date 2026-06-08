export const dynamic = "force-static";
export const dynamicParams = false;

import { generateRelicStaticParams } from "@/lib/codex-static-params";
import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_codex/relics/[id]/page";

export const generateMetadata = generateBaseMetadata;

export async function generateStaticParams() {
  return generateRelicStaticParams();
}

export default BasePage;
