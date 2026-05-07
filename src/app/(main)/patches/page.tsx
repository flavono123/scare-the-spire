import Link from "next/link";
import type { Metadata } from "next";
import { getSTS2Patches } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
  localizeHrefWithGameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import type { PatchType } from "@/lib/types";

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
  const patches = await getSTS2Patches();

  // Sort patches by date descending (newest first)
  const sorted = [...patches].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">{copy.title}</h1>

      <div className="mt-6 space-y-3">
        {sorted.map((patch) => {
          const title = serviceLocale === "ko" ? patch.titleKo : patch.title;
          const summary = serviceLocale === "ko" ? patch.summaryKo : patch.summary;

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
              <p className="mt-0.5 text-xs text-muted-foreground">
                {patch.date} — {summary}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
