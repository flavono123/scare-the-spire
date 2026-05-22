import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import { Badge } from "@/components/ui/badge";
import { getSTS2Patches } from "@/lib/data";
import { loadAllEntities } from "@/lib/load-all-entities";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { withPageOgImage } from "@/lib/page-og-images";
import { resolvePatchArt, type ResolvedPatchArt } from "@/lib/sts2-patch-art";
import type { PatchType } from "@/lib/types";

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
    building: "작성 중",
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
    building: "Building",
    steamOriginal: "Steam original",
    types: {
      release: "Release",
      beta: "Beta",
      stable: "Stable",
      hotfix: "Hotfix",
    },
  },
};

function SineText({ text }: { text: string }) {
  return (
    <span className="rich-sine">
      {Array.from(text).map((char, i) => (
        <span
          key={`${char}-${i}`}
          className="rich-sine-letter"
          style={{ "--rich-sine-index": i } as CSSProperties}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

const PATCH_TYPE_CLASSES: Record<PatchType, string> = {
  release: "bg-green-500/15 text-green-400 border-green-500/30",
  beta: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  stable: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  hotfix: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function PatchArtPreview({ art }: { art: ResolvedPatchArt }) {
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
        className="h-full w-full object-cover"
        style={{ objectPosition: art.objectPosition }}
      />
    </div>
  );
}

export function getPatchListMetadata(serviceLocale: ServiceLocale): Metadata {
  const copy = PATCH_COPY[serviceLocale];
  return withPageOgImage({
    ...getCodexMetadata(serviceLocale, copy.title),
    description: copy.description,
  }, "/patches");
}

export async function PatchListPage({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = PATCH_COPY[serviceLocale];
  const [patches, entities] = await Promise.all([
    getSTS2Patches(),
    loadAllEntities({ gameLocale }),
  ]);
  const entitiesByKey = new Map(entities.map((entity) => [`${entity.type}:${entity.id}`, entity]));

  const sorted = [...patches].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">{copy.title}</h1>

      <div className="mt-6 space-y-3">
        {sorted.map((patch) => {
          const title = serviceLocale === "ko" ? patch.titleKo : patch.title;
          const isBuilding = patch.status === "building";
          const patchArt = isBuilding ? null : resolvePatchArt(patch, entitiesByKey, serviceLocale);

          if (isBuilding) {
            return (
              <article
                key={patch.id}
                className="block rounded-lg border border-zinc-800 bg-zinc-950/35 p-4 shadow-inner"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-zinc-500">v{patch.version}</span>
                  <Badge variant="outline" className="border-zinc-700 bg-zinc-900/50 text-zinc-500">
                    {copy.types[patch.type]}
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
                <div className="mt-3 text-sm font-semibold text-zinc-500">
                  <SineText text={copy.building} />
                </div>
                <p className="mt-2 text-xs text-zinc-600">{patch.date}</p>
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
                <span className="text-lg font-semibold">v{patch.version}</span>
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
              {patchArt && <PatchArtPreview art={patchArt} />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
