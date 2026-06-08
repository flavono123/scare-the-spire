import { CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-page";
import { generatePotionStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumPotionMetadata } from "@/lib/compendium-detail-metadata";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumPotionMetadata(id);
}

export async function generateStaticParams() {
  return generatePotionStaticParams();
}

export default async function CompendiumPotionDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="potions" id={id} />;
}
