import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexPowers } from "@/lib/codex-data";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
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
  const [powers, patches, changes, versionDiffs, gameUi] = await Promise.all([
    getCodexPowers({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const power = powers.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!power) return {};
  return getCodexMetadata(serviceLocale, `${power.name} — ${gameUi.nav.powers}`);
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
  const [powers, gameUi] = await Promise.all([
    getCodexPowers({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const power = powers.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!power) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PowerDetail serviceLocale={serviceLocale} gameUi={gameUi} power={power} patches={patches} changes={changes} versionDiffs={versionDiffs} />
    </div>
  );
}
