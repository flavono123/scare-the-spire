import { notFound } from "next/navigation";
import { getCodexAncients, getCodexRelics } from "@/lib/codex-data";
import { AncientDetail } from "@/components/codex/ancient-detail";
import type { CodexRelic } from "@/lib/codex-types";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const ancients = await getCodexAncients();
  return ancients.map((a) => ({ id: a.id.toLowerCase() }));
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const ancients = await getCodexAncients();
  const ancient = ancients.find((a) => a.id.toLowerCase() === id.toLowerCase());
  if (!ancient) return { title: "Not Found" };
  return {
    title: `${ancient.name} — 슬서운 이야기`,
    description: `슬레이 더 스파이어 2 에인션트: ${ancient.name} (${ancient.epithet})`,
  };
}

export default async function AncientDetailPage({ params }: Props) {
  const { id } = await params;
  const [ancients, relics] = await Promise.all([
    getCodexAncients(),
    getCodexRelics(),
  ]);

  const ancient = ancients.find((a) => a.id.toLowerCase() === id.toLowerCase());
  if (!ancient) notFound();

  const ancientRelics = ancient.relicIds
    .map((rid) => relics.find((r) => r.id === rid))
    .filter((r): r is CodexRelic => r !== undefined);

  return <AncientDetail ancient={ancient} relics={ancientRelics} />;
}
