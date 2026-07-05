import Link from "next/link";
import type { Metadata } from "next";
import Image from "@/components/ui/static-image";
import { Badge } from "@/components/ui/badge";
import { getSTS2Patches } from "@/lib/data";
import { loadAllEntities } from "@/lib/load-all-entities";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { PATCH_NOTES_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { getPatchVersionLabel } from "@/lib/sts2-patch-labels";
import { resolvePatchArt, type ResolvedPatchArt } from "@/lib/sts2-patch-art";
import type { PatchType, STS2Patch } from "@/lib/types";
import { getPatchStageGameCopy } from "@/lib/borrowed-game-copy";

const PATCH_COPY: Record<ServiceLocale, {
  title: string;
  description: string;
  balance: string;
  building: string;
  steamOriginal: string;
  types: Record<PatchType, string>;
}> = {
  ko: {
    title: "패치 노트",
    description: "슬레이 더 스파이어 2 전체 패치 히스토리와 밸런스 변경 이력",
    balance: "밸런스",
    building: "작업 도구",
    steamOriginal: "Steam 원문",
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
    building: "Tools of the Trade",
    steamOriginal: "Steam original",
    types: {
      release: "Release",
      beta: "Beta",
      stable: "Stable",
      hotfix: "Hotfix",
    },
  },
};

type PatchVisualStage = "prep_time" | "delay" | "building" | "ready";
type PatchWatchStage = NonNullable<STS2Patch["watchStage"]>;

const DEFAULT_WATCH_STAGE: PatchWatchStage = "prep_time";

const PATCH_STAGE_TOKENS: Record<PatchVisualStage, {
  src: string;
  alt: Record<ServiceLocale, string>;
}> = {
  prep_time: {
    src: "/images/sts2/intents/animated/sleep.webp",
    alt: { ko: "수면", en: "Sleep" },
  },
  delay: {
    src: "/images/sts2/intents/animated/unknown.webp",
    alt: { ko: "미지", en: "Unknown" },
  },
  building: {
    src: "/images/sts2/powers/tools_of_the_trade_power.webp",
    alt: { ko: "작업 도구", en: "Tools of the Trade" },
  },
  ready: {
    src: "/images/sts2/nav/patch_notes_icon.png",
    alt: { ko: "패치 노트", en: "Patch Notes" },
  },
};

function patchWatchStage(patch: STS2Patch): PatchWatchStage {
  return patch.watchStage ?? DEFAULT_WATCH_STAGE;
}

function patchVisualStage(patch: STS2Patch): PatchVisualStage {
  if (patch.status === "watching") return patchWatchStage(patch);
  if (patch.status === "building") return "building";
  return "ready";
}

function PatchStageTitle({
  stage,
  text,
  serviceLocale,
  className = "text-lg font-semibold",
}: {
  stage: PatchVisualStage;
  text: string;
  serviceLocale: ServiceLocale;
  className?: string;
}) {
  const token = PATCH_STAGE_TOKENS[stage];

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <Image
        src={token.src}
        alt={token.alt[serviceLocale]}
        width={24}
        height={24}
        className="h-6 w-6 shrink-0 object-contain"
      />
      <span className="min-w-0">{text}</span>
    </span>
  );
}

const PATCH_TYPE_CLASSES: Record<PatchType, string> = {
  release: "bg-green-500/15 text-green-400 border-green-500/30",
  beta: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  stable: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  hotfix: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function PatchArtPreview({
  art,
  priority = false,
  tone = "normal",
}: {
  art: ResolvedPatchArt;
  priority?: boolean;
  tone?: "normal" | "building" | "watching";
}) {
  const imageClassName = {
    normal: "h-full w-full object-cover",
    building: "h-full w-full object-cover grayscale opacity-45 saturate-0",
    watching: "h-full w-full object-cover opacity-75 sepia saturate-150",
  }[tone];

  return (
    <div
      className="mt-3 aspect-[16/7] overflow-hidden rounded-md border border-border/70 bg-zinc-950"
      aria-label="패치 대표 아트"
    >
      <Image
        src={art.imageUrl}
        alt={art.alt}
        width={960}
        height={420}
        loading={priority ? undefined : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        priority={priority}
        className={imageClassName}
        style={{ objectPosition: art.objectPosition }}
      />
    </div>
  );
}

export function getPatchListMetadata(serviceLocale: ServiceLocale): Metadata {
  const copy = getServiceMetadataCopy(serviceLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: copy.patchesTitle,
    description: copy.patchesDescription,
    image: PATCH_NOTES_PAGE_OG_IMAGE,
  });
}

export async function PatchListPage({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = PATCH_COPY[serviceLocale];
  const [patches, entities, patchStageCopy] = await Promise.all([
    getSTS2Patches(),
    loadAllEntities({ gameLocale }),
    getPatchStageGameCopy(gameLocale),
  ]);
  const entitiesByKey = new Map(entities.map((entity) => [`${entity.type}:${entity.id}`, entity]));

  const sorted = [...patches].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">{copy.title}</h1>

      <div className="mt-6 space-y-3">
        {sorted.map((patch, index) => {
          const title = serviceLocale === "ko" ? patch.titleKo : patch.title;
          const versionLabel = getPatchVersionLabel(patch, serviceLocale);
          const isWatching = patch.status === "watching";
          const isBuilding = patch.status === "building";
          const visualStage = patchVisualStage(patch);
          const watchStage = isWatching ? patchWatchStage(patch) : null;
          const patchArt = resolvePatchArt(patch, entitiesByKey, serviceLocale);

          if (isWatching) {
            const stageCopy = watchStage === "delay" ? patchStageCopy.delay : patchStageCopy.prepTime;
            return (
              <article
                key={patch.id}
                className="block rounded-lg border border-amber-500/30 bg-amber-950/10 p-4 shadow-inner"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PatchStageTitle
                    stage={visualStage}
                    text={stageCopy.title}
                    serviceLocale={serviceLocale}
                    className="text-lg font-semibold text-amber-200/80"
                  />
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                    {copy.types[patch.type]}
                  </Badge>
                  {patch.hasBalanceChanges && (
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                      {copy.balance}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-amber-100/75">{stageCopy.description}</p>
                <p className="mt-2 text-xs text-amber-100/45">{patch.date}</p>
                <PatchArtPreview art={patchArt} priority={index === 0} tone="watching" />
              </article>
            );
          }

          if (isBuilding) {
            return (
              <article
                key={patch.id}
                className="block rounded-lg border border-zinc-800 bg-zinc-950/35 p-4 shadow-inner"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PatchStageTitle
                    stage="building"
                    text={versionLabel}
                    serviceLocale={serviceLocale}
                    className="text-lg font-semibold text-zinc-500"
                  />
                  <Badge variant="outline" className="border-zinc-700 bg-zinc-900/50 text-zinc-500">
                    {copy.types[patch.type]}
                  </Badge>
                  <Badge variant="outline" className="border-zinc-700 bg-zinc-900/50 text-zinc-500">
                    {patchStageCopy.workToolsTitle || copy.building}
                  </Badge>
                  {patch.hasBalanceChanges && (
                    <Badge variant="outline" className="border-zinc-700 bg-zinc-900/50 text-zinc-500">
                      {copy.balance}
                    </Badge>
                  )}
                  {patch.steamUrl && (
                    <a
                      href={patch.steamUrl}
                      className="ml-auto inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 transition-colors hover:border-blue-300/50 hover:text-blue-300"
                    >
                      {copy.steamOriginal} &rarr;
                    </a>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-zinc-500">{title}</p>
                <p className="mt-2 text-xs text-zinc-600">{patch.date}</p>
                <PatchArtPreview art={patchArt} priority={index === 0} tone="building" />
              </article>
            );
          }

          return (
            <Link
              key={patch.id}
              href={localizeHrefWithGameLocale(`/patches/${patch.version}`, serviceLocale, gameLocale)}
              prefetch={false}
              className="block rounded-lg border border-border bg-card/50 p-4 hover:border-yellow-500/40 hover:bg-card/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <PatchStageTitle
                  stage="ready"
                  text={versionLabel}
                  serviceLocale={serviceLocale}
                />
                <Badge variant="outline" className={PATCH_TYPE_CLASSES[patch.type]}>
                  {copy.types[patch.type]}
                </Badge>
                {patch.hasBalanceChanges && (
                  <Badge variant="outline" className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
                    {copy.balance}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm font-medium">{title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{patch.date}</p>
              {patchArt && <PatchArtPreview art={patchArt} priority={index === 0} />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
