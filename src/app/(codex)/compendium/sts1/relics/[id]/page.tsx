export const dynamic = "force-static";
export const dynamicParams = false;

import BasePage, {
  generateMetadata as generateBaseMetadata,
  generateStaticParams as generateBaseStaticParams,
} from "../../../../_sts1/relics/[id]/page";
import { defaultRouteSearchParams } from "../../../static-locale";

type DetailProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return generateBaseStaticParams();
}

export function generateMetadata({ params }: DetailProps) {
  return generateBaseMetadata({
    params,
    searchParams: defaultRouteSearchParams(),
  });
}

export default function Sts1CompendiumRelicDetailPage({ params }: DetailProps) {
  return BasePage({
    params,
    searchParams: defaultRouteSearchParams(),
  });
}
