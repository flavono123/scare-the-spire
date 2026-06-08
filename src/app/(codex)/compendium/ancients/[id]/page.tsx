export const dynamic = "force-static";
export const dynamicParams = false;

import BasePage, { generateMetadata as generateBaseMetadata, generateStaticParams as generateBaseStaticParams } from "../../../_codex/ancients/[id]/page";

export const generateMetadata = generateBaseMetadata;

export async function generateStaticParams() {
  return generateBaseStaticParams();
}

export default BasePage;
