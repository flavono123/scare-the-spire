import { CompendiumDirectDetailRoute as CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-route";
import { generateCompendiumCardMetadata } from "@/lib/compendium-detail-metadata";
import { generateCardStaticParams } from "@/lib/codex-static-params";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumCardMetadata(id);
}

export async function generateStaticParams() {
  return generateCardStaticParams();
}

export default async function CompendiumCardDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="cards" id={id} />;
}
