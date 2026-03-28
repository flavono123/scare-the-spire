import Link from "next/link";
import { getSTS2Patches } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import type { PatchType } from "@/lib/types";

const PATCH_TYPE_STYLES: Record<PatchType, { label: string; className: string }> = {
  release: { label: "출시", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  beta: { label: "베타", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  stable: { label: "안정", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  hotfix: { label: "핫픽스", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
};

export const metadata = {
  title: "패치 노트 — 슬서운 이야기",
  description: "슬레이 더 스파이어 2 전체 패치 히스토리와 밸런스 변경 이력",
};

export default async function PatchesPage() {
  const patches = await getSTS2Patches();

  // Sort patches by date descending (newest first)
  const sorted = [...patches].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">패치 노트</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        슬레이 더 스파이어 2 — 전체 패치 히스토리
      </p>

      <div className="mt-6 space-y-3">
        {sorted.map((patch) => {
          const style = PATCH_TYPE_STYLES[patch.type];

          return (
            <Link
              key={patch.id}
              href={`/patches/${patch.version}`}
              className="block rounded-lg border border-border bg-card/50 p-4 hover:border-yellow-500/40 hover:bg-card/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">v{patch.version}</span>
                <Badge variant="outline" className={style.className}>
                  {style.label}
                </Badge>
                {patch.hasBalanceChanges && (
                  <Badge variant="outline" className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
                    밸런스
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm font-medium">{patch.titleKo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {patch.date} — {patch.summaryKo}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
