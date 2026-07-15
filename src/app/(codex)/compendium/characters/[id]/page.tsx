import { CompendiumDirectDetailRoute as CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-route";
import { generateCharacterStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumCharacterMetadata } from "@/lib/compendium-detail-metadata";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumCharacterMetadata(id);
}

export async function generateStaticParams() {
  return generateCharacterStaticParams();
}

export default async function CompendiumCharacterDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="characters" id={id} />;
}
