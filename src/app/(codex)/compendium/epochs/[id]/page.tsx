import { generateEpochStaticParams } from "@/lib/codex-static-params";
import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_codex/epochs/[id]/page";

export const dynamic = "force-static";
export const dynamicParams = false;

export const generateMetadata = generateBaseMetadata;

export async function generateStaticParams() {
  return generateEpochStaticParams();
}

export default BasePage;
