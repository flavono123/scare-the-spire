"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { Relic, Rarity, Change } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const RARITY_SECTIONS: { value: Rarity; label: string; description: string; color: string }[] = [
  { value: "starter", label: "시작", description: "각 캐릭터가 처음부터 갖고 시작하는 유물입니다.", color: "text-green-400" },
  { value: "common", label: "일반", description: "쉽게 찾을 수 있는 평범한 유물입니다.", color: "text-zinc-400" },
  { value: "uncommon", label: "고급", description: "일반적으로 쉽게 찾을 수 없는 강력한 유물입니다.", color: "text-blue-400" },
  { value: "rare", label: "희귀", description: "매우 강력하고 드문 유물입니다.", color: "text-yellow-500" },
  { value: "boss", label: "보스", description: "보스를 처치하면 얻을 수 있는 유물입니다.", color: "text-red-400" },
  { value: "shop", label: "상점", description: "상점에서 구매할 수 있는 유물입니다.", color: "text-emerald-400" },
  { value: "event", label: "이벤트", description: "특정 이벤트에서만 얻을 수 있는 유물입니다.", color: "text-purple-400" },
  { value: "special", label: "특수", description: "특수한 방법으로만 얻을 수 있는 유물입니다.", color: "text-pink-400" },
];

function DiffLine({ diff }: { diff: Change["diffs"][0] }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {diff.upgraded && (
        <span className="text-[10px] font-medium text-green-400 bg-green-500/10 rounded px-1">+</span>
      )}
      <span className="text-muted-foreground">{diff.displayName}</span>
      <span className="text-red-400">{String(diff.before)}</span>
      <span className="text-muted-foreground">→</span>
      <span className="text-green-400">{String(diff.after)}</span>
    </div>
  );
}

function RelicModal({
  relic,
  changes,
  onClose,
}: {
  relic: Relic;
  changes: Change[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-background p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <Image
              src={`/images/relics/${relic.id}.webp`}
              alt={relic.name}
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{relic.nameKo}</h2>
              {relic.deprecated && (
                <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">삭제됨</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{relic.name}</p>
            {relic.character && (
              <Badge variant="outline" className="mt-1 text-xs">{relic.character}</Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{relic.description}</p>

        {changes.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-yellow-500">
              변경 이력 ({changes.length})
            </h3>
            <div className="relative pl-4">
              <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
              {changes.map((c) => (
                <div key={c.id} className="relative mb-3 last:mb-0">
                  <div className="absolute -left-2.5 top-1.5 h-2 w-2 rounded-full border-2 border-yellow-500 bg-background" />
                  <div className="rounded border border-border bg-card/50 p-3">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span className="font-medium text-yellow-500">{c.patch}</span>
                      {c.date && <span className="text-muted-foreground">{c.date}</span>}
                    </div>
                    {c.summary && (
                      <p className="text-xs text-muted-foreground mb-1">{c.summary}</p>
                    )}
                    <div className="space-y-0.5">
                      {c.diffs.map((d, i) => (
                        <DiffLine key={i} diff={d} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RelicIcon({
  relic,
  changes,
}: {
  relic: Relic;
  changes: Change[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const hasChanges = changes.length > 0;

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`group relative flex h-16 w-16 items-center justify-center rounded-lg transition-all hover:scale-110 hover:bg-card/50 ${
          relic.deprecated ? "opacity-50 grayscale" : ""
        }`}
        title={`${relic.nameKo} (${relic.name})`}
      >
        {!imgError ? (
          <Image
            src={`/images/relics/${relic.id}.webp`}
            alt={relic.name}
            width={48}
            height={48}
            className="object-contain drop-shadow-md"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-xs text-muted-foreground">
            ?
          </div>
        )}
        {hasChanges && (
          <div className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[9px] font-bold text-black">
            {changes.length}
          </div>
        )}
        {relic.deprecated && (
          <div className="absolute -bottom-0.5 inset-x-0 text-center text-[8px] text-red-400 font-medium">
            삭제
          </div>
        )}
      </button>
      {modalOpen && (
        <RelicModal
          relic={relic}
          changes={changes}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

export function RelicBrowser({
  relics,
  changes,
}: {
  relics: Relic[];
  changes: Change[];
}) {
  const [changeFilter, setChangeFilter] = useState<"all" | "changed" | "deprecated">("all");

  const changeIndex = useMemo(() => {
    const idx = new Map<string, Change[]>();
    for (const c of changes) {
      if (c.entityType !== "relic") continue;
      if (!idx.has(c.entityId)) idx.set(c.entityId, []);
      idx.get(c.entityId)!.push(c);
    }
    return idx;
  }, [changes]);

  const sections = useMemo(() => {
    return RARITY_SECTIONS.map((sec) => {
      let items = relics.filter((r) => r.rarity === sec.value);
      if (changeFilter === "changed") items = items.filter((r) => changeIndex.has(r.id));
      if (changeFilter === "deprecated") items = items.filter((r) => r.deprecated);
      return { ...sec, relics: items };
    }).filter((sec) => sec.relics.length > 0);
  }, [relics, changeFilter, changeIndex]);

  const totalShown = sections.reduce((s, sec) => s + sec.relics.length, 0);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-4">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <span className="text-muted-foreground">필터:</span>
          {([
            { value: "all", label: "전체" },
            { value: "changed", label: "변경이력 있음" },
            { value: "deprecated", label: "삭제된 유물" },
          ] as const).map((f) => (
            <button
              key={f.value}
              onClick={() => setChangeFilter(f.value)}
              className={`rounded px-2 py-0.5 transition-colors ${
                changeFilter === f.value
                  ? "bg-card border border-border text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {totalShown}개
          </span>
        </div>

        {/* Rarity sections - matching in-game layout */}
        <div className="space-y-8">
          {sections.map((sec) => (
            <section key={sec.value}>
              <div className="mb-3">
                <h2 className={`text-lg font-bold ${sec.color}`}>
                  {sec.label}:
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {sec.description}
                  </span>
                </h2>
              </div>
              <div className="flex flex-wrap gap-1">
                {sec.relics.map((relic) => (
                  <RelicIcon
                    key={relic.id}
                    relic={relic}
                    changes={changeIndex.get(relic.id) ?? []}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
