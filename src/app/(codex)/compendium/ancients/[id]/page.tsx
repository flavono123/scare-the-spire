import { generateAncientStaticParams } from "@/lib/codex-static-params";
import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_codex/ancients/[id]/page";
import { defaultRouteSearchParams } from "../../static-locale";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export function generateMetadata({ params }: DetailProps) {
  return generateBaseMetadata({
    params,
    searchParams: defaultRouteSearchParams(),
  });
}

export async function generateStaticParams() {
  return generateAncientStaticParams();
}

export default function CompendiumAncientDetailPage({ params }: DetailProps) {
  return BasePage({
    params,
    searchParams: defaultRouteSearchParams(),
  });
}
