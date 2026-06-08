import { generateEventStaticParams } from "@/lib/codex-static-params";
import BasePage, { generateMetadata as generateBaseMetadata } from "../../../_codex/events/[id]/page";
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
  return generateEventStaticParams();
}

export default function CompendiumEventDetailPage({ params }: DetailProps) {
  return BasePage({
    params,
    searchParams: defaultRouteSearchParams(),
  });
}
