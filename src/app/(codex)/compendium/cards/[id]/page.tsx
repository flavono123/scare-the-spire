import { generateCardStaticParams } from "@/lib/codex-static-params";
import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_codex/cards/[id]/page";

export const dynamic = "force-static";
export const dynamicParams = false;

export const generateMetadata = generateBaseMetadata;

export async function generateStaticParams() {
  return generateCardStaticParams();
}

export default BasePage;
