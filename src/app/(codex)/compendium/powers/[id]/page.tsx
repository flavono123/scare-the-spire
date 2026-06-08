export const dynamic = "force-static";
export const dynamicParams = false;

import { generatePowerStaticParams } from "@/lib/codex-static-params";
import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_codex/powers/[id]/page";

export const generateMetadata = generateBaseMetadata;

export async function generateStaticParams() {
  return generatePowerStaticParams();
}

export default BasePage;
