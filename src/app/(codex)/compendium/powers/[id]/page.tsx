import { CompendiumDirectDetailRoute as CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-route";
import { generatePowerStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumPowerMetadata } from "@/lib/compendium-detail-metadata";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumPowerMetadata(id);
}

export async function generateStaticParams() {
  return generatePowerStaticParams();
}

export default async function CompendiumPowerDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="powers" id={id} />;
}
