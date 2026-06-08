export const dynamic = "force-static";
export const dynamicParams = false;

import { generateEventStaticParams } from "@/lib/codex-static-params";
import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_codex/events/[id]/page";

export const generateMetadata = generateBaseMetadata;

export async function generateStaticParams() {
  return generateEventStaticParams();
}

export default BasePage;
