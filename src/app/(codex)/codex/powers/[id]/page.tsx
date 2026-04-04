import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexPowers } from "@/lib/codex-data";
import { PowerDetail } from "@/components/codex/power-detail";
import { POWER_TYPE_CONFIG } from "@/lib/codex-types";

export async function generateStaticParams() {
  const powers = await getCodexPowers();
  return powers.map((p) => ({ id: p.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const powers = await getCodexPowers();
  const power = powers.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!power) return {};
  return {
    title: `${power.name} — 슬서운 파워 도감`,
    description: `${power.name} (${power.nameEn}) — ${POWER_TYPE_CONFIG[power.type].label}`,
  };
}

export default async function PowerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const powers = await getCodexPowers();
  const power = powers.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!power) notFound();

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-200">
      <PowerDetail power={power} />
    </div>
  );
}
