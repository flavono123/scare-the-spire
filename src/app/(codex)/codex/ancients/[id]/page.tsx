import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexAncients, getCodexRelics } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { AncientDetail } from "@/components/codex/ancient-detail";
import type { CodexRelic } from "@/lib/codex-types";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateStaticParams() {
  const ancients = await getCodexAncients();
  return ancients.map((a) => ({ id: a.id.toLowerCase() }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [ancients, gameUi] = await Promise.all([
    getCodexAncients({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const ancient = ancients.find((a) => a.id.toLowerCase() === id.toLowerCase());
  if (!ancient) return {};
  return getCodexMetadata(serviceLocale, `${ancient.name} — ${gameUi.ancientsTitle}`);
}

export default async function AncientDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [ancients, relics, gameUi] = await Promise.all([
    getCodexAncients({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);

  const ancient = ancients.find((a) => a.id.toLowerCase() === id.toLowerCase());
  if (!ancient) notFound();

  const ancientRelics = ancient.relicIds
    .map((rid) => relics.find((r) => r.id === rid))
    .filter((r): r is CodexRelic => r !== undefined);

  return <AncientDetail serviceLocale={serviceLocale} gameUi={gameUi} ancient={ancient} relics={ancientRelics} />;
}
