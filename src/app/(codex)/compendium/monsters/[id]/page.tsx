import { generateMonsterStaticParams } from "@/lib/codex-static-params";
import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_codex/monsters/[id]/page";

export const dynamic = "force-static";
export const dynamicParams = false;

export const generateMetadata = generateBaseMetadata;

export async function generateStaticParams() {
  return generateMonsterStaticParams();
}

export default BasePage;
