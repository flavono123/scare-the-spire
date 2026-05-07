import Link from "next/link";
import Image from "@/components/ui/static-image";
import type { Metadata } from "next";
import { getSTS2Patches } from "@/lib/data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { Badge } from "@/components/ui/badge";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
  localizeHrefWithGameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import type { PatchType, STS2Patch } from "@/lib/types";
import type { EntityInfo } from "@/components/patch-note-renderer";

const PATCH_COPY: Record<ServiceLocale, {
  title: string;
  description: string;
  balance: string;
  building: string;
  types: Record<PatchType, string>;
}> = {
  ko: {
    title: "패치 노트",
    description: "슬레이 더 스파이어 2 전체 패치 히스토리와 밸런스 변경 이력",
    balance: "밸런스",
    building: "작성 중",
    types: {
      release: "출시",
      beta: "베타",
      stable: "안정",
      hotfix: "핫픽스",
    },
  },
  en: {
    title: "Patch Notes",
    description: "Full Slay the Spire 2 patch history and balance changes.",
    balance: "Balance",
    building: "Building",
    types: {
      release: "Release",
      beta: "Beta",
      stable: "Stable",
      hotfix: "Hotfix",
    },
  },
};

const PATCH_TYPE_CLASSES: Record<PatchType, string> = {
  release: "bg-green-500/15 text-green-400 border-green-500/30",
  beta: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  stable: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  hotfix: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function entityAssetUrl(entity: EntityInfo): string | null {
  return entity.cardData?.imageUrl ?? entity.cardData?.betaImageUrl ?? entity.imageUrl;
}

function PatchFeaturedAssets({ entities }: { entities: EntityInfo[] }) {
  if (entities.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-5 gap-2" aria-label="패치 주요 변경 대상">
      {entities.slice(0, 5).map((entity) => {
        const imageUrl = entityAssetUrl(entity);
        const isCard = entity.type === "card";
        const isMonster = entity.type === "monster";

        return (
          <span
            key={`${entity.type}:${entity.id}`}
            className="min-w-0 rounded-md border border-white/10 bg-black/20 px-1.5 py-1.5"
          >
            <span className="flex h-12 items-center justify-center">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={entity.nameKo}
                  width={isCard ? 36 : 46}
                  height={isCard ? 52 : 46}
                  className={isCard ? "h-12 w-auto object-contain" : isMonster ? "h-12 w-12 object-contain" : "h-10 w-10 object-contain"}
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded bg-muted/30 text-[10px] font-semibold text-muted-foreground">
                  {entity.nameKo.slice(0, 2)}
                </span>
              )}
            </span>
            <span className="mt-1 block truncate text-center text-[10px] font-medium text-muted-foreground">
              {entity.nameKo}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function getFeaturedEntities(
  patch: STS2Patch,
  entitiesByKey: Map<string, EntityInfo>,
): EntityInfo[] {
  return (patch.featuredEntities ?? [])
    .map((entity) => entitiesByKey.get(`${entity.type}:${entity.id}`))
    .filter((entity): entity is EntityInfo => Boolean(entity));
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const serviceLocale = getServiceLocaleFromSearchRecord(await searchParams);
  const copy = PATCH_COPY[serviceLocale];
  return {
    ...getCodexMetadata(serviceLocale, copy.title),
    description: copy.description,
  };
}

export default async function PatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const copy = PATCH_COPY[serviceLocale];
  const [patches, entities] = await Promise.all([
    getSTS2Patches(),
    loadAllEntities({ gameLocale }),
  ]);
  const entitiesByKey = new Map(entities.map((entity) => [`${entity.type}:${entity.id}`, entity]));

  // Sort patches by date descending (newest first)
  const sorted = [...patches].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">{copy.title}</h1>

      <div className="mt-6 space-y-3">
        {sorted.map((patch) => {
          const title = serviceLocale === "ko" ? patch.titleKo : patch.title;
          const summary = serviceLocale === "ko" ? patch.summaryKo : patch.summary;
          const featuredEntities = patch.status === "building" ? [] : getFeaturedEntities(patch, entitiesByKey);

          return (
            <Link
              key={patch.id}
              href={localizeHrefWithGameLocale(`/patches/${patch.version}`, serviceLocale, gameLocale)}
              prefetch={false}
              className="block rounded-lg border border-border bg-card/50 p-4 hover:border-yellow-500/40 hover:bg-card/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">v{patch.version}</span>
                <Badge variant="outline" className={PATCH_TYPE_CLASSES[patch.type]}>
                  {copy.types[patch.type]}
                </Badge>
                {patch.hasBalanceChanges && (
                  <Badge variant="outline" className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
                    {copy.balance}
                  </Badge>
                )}
                {patch.status === "building" && (
                  <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                    {copy.building}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm font-medium">{title}</p>
              {featuredEntities.length > 0 ? (
                <>
                  <p className="mt-0.5 text-xs text-muted-foreground">{patch.date}</p>
                  <PatchFeaturedAssets entities={featuredEntities} />
                </>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {patch.date} — {summary}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
