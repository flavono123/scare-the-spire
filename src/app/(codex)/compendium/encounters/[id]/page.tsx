import { CompendiumDirectDetailRoute as CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-route";
import { generateEncounterStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumEncounterMetadata } from "@/lib/compendium-detail-metadata";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumEncounterMetadata(id);
}

export async function generateStaticParams() {
  return generateEncounterStaticParams();
}

export default async function CompendiumEncounterDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="encounters" id={id} />;
}
