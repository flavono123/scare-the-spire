"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { Potion, PotionRarity, Change } from "@/lib/types";
import { ChangeList } from "@/components/change-list";
import { CharacterBadge, characterRing } from "@/components/character-badge";

const RARITY_SECTIONS: { value: PotionRarity; label: string; description: string; color: string }[] = [
  { value: "common", label: "일반", description: "첨탑에서 가장 흔하게 찾을 수 있는 포션들입니다.", color: "text-zinc-400" },
  { value: "uncommon", label: "고급", description: "일반 포션보다는 드물게 나타나는 조금 더 강력한 포션입니다.", color: "text-blue-400" },
  { value: "rare", label: "희귀", description: "가끔 보이는 독특하고 강력한 포션들입니다.", color: "text-yellow-500" },
];

function PotionModal({
  potion,
  changes,
  onClose,
}: {
  potion: Potion;
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
              src={`/images/potions/${potion.id}.webp`}
              alt={potion.name}
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{potion.nameKo}</h2>
            <p className="text-sm text-muted-foreground">{potion.name}</p>
            <CharacterBadge character={potion.character} className="mt-1 text-xs" />
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{potion.description}</p>

        {changes.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-yellow-500">
              변경 이력 ({changes.length})
            </h3>
            <ChangeList changes={changes} />
          </div>
        )}
      </div>
    </div>
  );
}

function PotionIcon({
  potion,
  changes,
}: {
  potion: Potion;
  changes: Change[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const hasChanges = changes.length > 0;
  const charRing = characterRing(potion.character);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`group relative flex h-16 w-16 items-center justify-center rounded-lg transition-all hover:scale-110 hover:bg-card/50 ${charRing}`}
        title={`${potion.nameKo} (${potion.name})`}
      >
        {!imgError ? (
          <Image
            src={`/images/potions/${potion.id}.webp`}
            alt={potion.name}
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
      </button>
      {modalOpen && (
        <PotionModal
          potion={potion}
          changes={changes}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

export function PotionBrowser({
  potions,
  changes,
}: {
  potions: Potion[];
  changes: Change[];
}) {
  const [changeFilter, setChangeFilter] = useState<"all" | "changed">("all");

  const changeIndex = useMemo(() => {
    const idx = new Map<string, Change[]>();
    for (const c of changes) {
      if (c.entityType !== "potion") continue;
      if (!idx.has(c.entityId)) idx.set(c.entityId, []);
      idx.get(c.entityId)!.push(c);
    }
    return idx;
  }, [changes]);

  const sections = useMemo(() => {
    return RARITY_SECTIONS.map((sec) => {
      let items = potions.filter((p) => p.rarity === sec.value);
      if (changeFilter === "changed") items = items.filter((p) => changeIndex.has(p.id));
      return { ...sec, potions: items };
    }).filter((sec) => sec.potions.length > 0);
  }, [potions, changeFilter, changeIndex]);

  const totalShown = sections.reduce((s, sec) => s + sec.potions.length, 0);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-4">
        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <span className="text-muted-foreground">필터:</span>
          {([
            { value: "all", label: "전체" },
            { value: "changed", label: "변경이력 있음" },
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
                {sec.potions.map((potion) => (
                  <PotionIcon
                    key={potion.id}
                    potion={potion}
                    changes={changeIndex.get(potion.id) ?? []}
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
