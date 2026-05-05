import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexPowers } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { PowerDetail } from "@/components/codex/power-detail";

export async function generateStaticParams() {
  const powers = await getCodexPowers();
  return powers.map((p) => ({ id: p.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const serviceText = getCodexServiceMessages(serviceLocale);
  const powers = await getCodexPowers({ gameLocale });
  const power = powers.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!power) return {};
  return getCodexMetadata(serviceLocale, `${power.name} — ${serviceText.powersView.title}`);
}

export default async function PowerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const powers = await getCodexPowers({ gameLocale });
  const power = powers.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!power) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PowerDetail serviceLocale={serviceLocale} power={power} />
    </div>
  );
}
