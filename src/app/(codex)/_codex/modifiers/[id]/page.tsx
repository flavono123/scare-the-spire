import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexModifiers } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { ModifierDetail } from "@/components/codex/modifier-detail";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const modifiers = await getCodexModifiers();
  return modifiers.map((modifier) => ({ id: modifier.id.toLowerCase() }));
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
  const [modifiers, gameUi] = await Promise.all([
    getCodexModifiers({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const modifier = findCodexResourceByRouteId(modifiers, id);
  if (!modifier) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.nav.modifiers, modifier);
}

export default async function ModifierDetailPage({
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
  const [modifiers, entities, gameUi] = await Promise.all([
    getCodexModifiers({ gameLocale }),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const modifier = modifiers.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!modifier) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ModifierDetail
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        backToListTitle={gameUi.nav.modifiers}
        modifier={modifier}
        entities={entities}
      />
    </div>
  );
}
