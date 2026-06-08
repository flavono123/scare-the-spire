import { generatePotionStaticParams } from "@/lib/codex-static-params";
import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_codex/potions/[id]/page";

export const dynamic = "force-static";
export const dynamicParams = false;

export const generateMetadata = generateBaseMetadata;

export async function generateStaticParams() {
  return generatePotionStaticParams();
}

export default BasePage;
