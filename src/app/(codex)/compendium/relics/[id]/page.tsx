import { CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-page";
import { generateRelicStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumRelicMetadata } from "@/lib/compendium-detail-metadata";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumRelicMetadata(id);
}

export async function generateStaticParams() {
  return generateRelicStaticParams();
}

export default async function CompendiumRelicDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="relics" id={id} />;
}
