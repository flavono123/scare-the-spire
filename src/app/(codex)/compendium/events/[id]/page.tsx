import { CompendiumDirectDetailRoute as CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-route";
import { generateEventStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumEventMetadata } from "@/lib/compendium-detail-metadata";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumEventMetadata(id);
}

export async function generateStaticParams() {
  return generateEventStaticParams();
}

export default async function CompendiumEventDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="events" id={id} />;
}
