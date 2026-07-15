import { CompendiumDirectDetailRoute as CompendiumDirectDetailPage } from "@/components/codex/compendium-direct-detail-route";
import { generateEnchantmentStaticParams } from "@/lib/codex-static-params";
import { generateCompendiumEnchantmentMetadata } from "@/lib/compendium-detail-metadata";

export const dynamic = "force-static";
export const dynamicParams = false;

type DetailProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: DetailProps) {
  const { id } = await params;
  return generateCompendiumEnchantmentMetadata(id);
}

export async function generateStaticParams() {
  return generateEnchantmentStaticParams();
}

export default async function CompendiumEnchantmentDetailPage({ params }: DetailProps) {
  const { id } = await params;
  return <CompendiumDirectDetailPage resourceType="enchantments" id={id} />;
}
