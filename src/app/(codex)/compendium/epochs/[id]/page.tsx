import { CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-page";
import { generateEpochStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumEpochMetadata } from "@/lib/compendium-detail-metadata";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumEpochMetadata(id);
}

export async function generateStaticParams() {
  return generateEpochStaticParams();
}

export default async function CompendiumEpochDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="epochs" id={id} />;
}
