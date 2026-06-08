export const dynamic = "force-static";
export const dynamicParams = false;

import { generateAncientStaticParams } from "@/lib/codex-static-params";
import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_codex/ancients/[id]/page";

export const generateMetadata = generateBaseMetadata;

export async function generateStaticParams() {
  return generateAncientStaticParams();
}

export default BasePage;
