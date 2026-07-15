import { CompendiumDirectDetailRoute as CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-route";
import { generateKeywordStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumKeywordMetadata } from "@/lib/compendium-detail-metadata";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumKeywordMetadata(id);
}

export async function generateStaticParams() {
  return generateKeywordStaticParams();
}

export default async function CompendiumKeywordDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="keywords" id={id} />;
}
