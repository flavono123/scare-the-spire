import { CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-page";
import { generateMonsterStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumMonsterMetadata } from "@/lib/compendium-detail-metadata";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumMonsterMetadata(id);
}

export async function generateStaticParams() {
  return generateMonsterStaticParams();
}

export default async function CompendiumMonsterDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="monsters" id={id} />;
}
