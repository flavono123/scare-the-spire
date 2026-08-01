import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexAncients, getCodexCards, getCodexCharacters } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getEntityVersionDiffs, getSTS2Changes, getSTS2Patches } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { AncientDetail } from "@/components/codex/ancient-detail";
import {
  findCodexResourceByRouteId,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const ancients = await getCodexAncients();
  return ancients.map((ancient) => ({ id: ancient.id.toLowerCase() }));
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
  const ancient = findCodexResourceByRouteId(ancients, id);
  if (!ancient) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.ancientsTitle, ancient);
}

export default async function AncientDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [ancients, cards, characters, patches, changes, versionDiffs, entities, gameUi] = await Promise.all([
    getCodexAncients({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexCharacters({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);

  const ancient = ancients.find((a) => a.id.toLowerCase() === id.toLowerCase());
  if (!ancient) notFound();

  return (
    <AncientDetail
      serviceLocale={serviceLocale}
      gameUi={gameUi}
      backToListTitle={gameUi.ancientsTitle}
      ancient={ancient}
      cards={cards}
      characters={characters}
      entities={entities}
      patches={patches}
      changes={changes}
      versionDiffs={versionDiffs}
    />
  );
}
