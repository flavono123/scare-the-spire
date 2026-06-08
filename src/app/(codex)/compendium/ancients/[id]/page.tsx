import { CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-page";
import { generateAncientStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumAncientMetadata } from "@/lib/compendium-detail-metadata";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumAncientMetadata(id);
}

export async function generateStaticParams() {
  return generateAncientStaticParams();
}

export default async function CompendiumAncientDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="ancients" id={id} />;
}
