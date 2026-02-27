"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import type { Card, CardClass, CardType, Rarity, Change } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const CLASS_TABS: { value: CardClass; label: string; color: string }[] = [
  { value: "ironclad", label: "아이언클래드", color: "text-red-400" },
  { value: "silent", label: "사일런트", color: "text-green-400" },
  { value: "defect", label: "디펙트", color: "text-blue-400" },
  { value: "watcher", label: "와쳐", color: "text-purple-400" },
  { value: "colorless", label: "무색", color: "text-zinc-400" },
  { value: "curse", label: "저주", color: "text-red-600" },
  { value: "status", label: "상태이상", color: "text-yellow-600" },
];

const TYPE_FILTERS: { value: CardType | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "attack", label: "공격" },
  { value: "skill", label: "스킬" },
  { value: "power", label: "파워" },
];

const RARITY_FILTERS: { value: Rarity | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "starter", label: "기본" },
  { value: "common", label: "일반" },
  { value: "uncommon", label: "고급" },
  { value: "rare", label: "희귀" },
  { value: "special", label: "특수" },
];

const RARITY_BORDER: Record<string, string> = {
  starter: "border-zinc-700",
  common: "border-zinc-600",
  uncommon: "border-blue-500/60",
  rare: "border-yellow-500/60",
  special: "border-pink-500/60",
};

function StoryButton() {
  const [clicked, setClicked] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setClicked(true);
      }}
      className={`mt-2 w-full rounded py-1 text-xs font-medium transition-colors ${
        clicked
          ? "bg-zinc-800 text-muted-foreground cursor-default"
          : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500/20"
      }`}
    >
      {clicked ? "Coming Soon ✨" : "이야기 만들기"}
    </button>
  );
}

function ChangeModal({
  card,
  changes,
  onClose,
}: {
  card: Card;
  changes: Change[];
  onClose: () => void;
}) {
  const [showBeta, setShowBeta] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="relative w-24 shrink-0">
            <Image
              src={
                showBeta
                  ? `/images/cards/${card.id}_beta.webp`
                  : `/images/cards/${card.id}.webp`
              }
              alt={card.name}
              width={170}
              height={219}
              className="rounded"
            />
            <button
              onClick={() => setShowBeta(!showBeta)}
              className="mt-1 w-full rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showBeta ? "일반 아트" : "베타 아트"}
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{card.nameKo}</h2>
            <p className="text-sm text-muted-foreground">{card.name}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">
                {card.cardType === "attack"
                  ? "공격"
                  : card.cardType === "skill"
                    ? "스킬"
                    : card.cardType === "power"
                      ? "파워"
                      : card.cardType}
              </Badge>
              <Badge variant="outline" className="text-xs">
                비용: {typeof card.cost === "number" ? card.cost : card.cost}
              </Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Changes */}
        {changes.length > 0 ? (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-yellow-500">
              변경 이력 ({changes.length})
            </h3>
            <div className="relative pl-4">
              <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
              {changes.map((c) => (
                <div key={c.id} className="relative mb-4 last:mb-0">
                  <div className="absolute -left-2.5 top-1.5 h-2 w-2 rounded-full border-2 border-yellow-500 bg-background" />
                  <div className="rounded border border-border bg-card/50 p-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-yellow-500">
                        {c.patch}
                      </span>
                      {c.date && (
                        <span className="text-muted-foreground">{c.date}</span>
                      )}
                    </div>
                    {c.summary && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.summary}
                      </p>
                    )}
                    <div className="mt-1.5 space-y-0.5">
                      {c.diffs.filter((d) => !d.upgraded).length > 0 && (
                        <div className="space-y-0.5">
                          {c.diffs.filter((d) => !d.upgraded).map((d, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs">
                              <span className="text-muted-foreground">
                                {d.displayName}:
                              </span>
                              <span className="text-red-400">
                                {String(d.before)}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="text-green-400">
                                {String(d.after)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {c.diffs.filter((d) => d.upgraded).length > 0 && (
                        <div className="mt-1 space-y-0.5 border-l-2 border-green-500/30 pl-2">
                          <span className="text-[10px] font-medium text-green-400/70">+</span>
                          {c.diffs.filter((d) => d.upgraded).map((d, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs">
                              <span className="text-muted-foreground">
                                {d.displayName}:
                              </span>
                              <span className="text-red-400">
                                {String(d.before)}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="text-green-400">
                                {String(d.after)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <StoryButton />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">변경 이력 없음</p>
        )}
      </div>
    </div>
  );
}

function CardTile({
  card,
  changes,
  upgraded,
}: {
  card: Card;
  changes: Change[];
  upgraded: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  useEffect(() => setImgError(false), [upgraded]);
  const hasChanges = changes.length > 0;
  const wantUpgraded = upgraded && card.class !== "curse";
  const imgSrc = wantUpgraded && !imgError
    ? `/images/cards/${card.id}_upgraded.webp`
    : `/images/cards/${card.id}.webp`;

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`group relative overflow-hidden rounded-lg border-2 ${
          RARITY_BORDER[card.rarity] ?? "border-border"
        } bg-card/30 transition-all hover:scale-105 hover:shadow-lg hover:shadow-black/30`}
      >
        <Image
          src={imgSrc}
          alt={card.name}
          width={170}
          height={219}
          className="w-full"
          onError={() => setImgError(true)}
        />
        {/* Change indicator */}
        {hasChanges && (
          <div className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-black">
            {changes.length}
          </div>
        )}
      </button>
      {modalOpen && (
        <ChangeModal
          card={card}
          changes={changes}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

export function CardBrowser({
  cards,
  changes,
}: {
  cards: Card[];
  changes: Change[];
}) {
  const [activeClass, setActiveClass] = useState<CardClass>("ironclad");
  const [typeFilter, setTypeFilter] = useState<CardType | "all">("all");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "all">("all");
  const [changeFilter, setChangeFilter] = useState<"all" | "changed" | "unchanged">("all");
  const [showUpgraded, setShowUpgraded] = useState(false);

  const changeIndex = useMemo(() => {
    const idx = new Map<string, Change[]>();
    for (const c of changes) {
      if (c.entityType !== "card") continue;
      if (!idx.has(c.entityId)) idx.set(c.entityId, []);
      idx.get(c.entityId)!.push(c);
    }
    return idx;
  }, [changes]);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (c.class !== activeClass) return false;
      if (typeFilter !== "all" && c.cardType !== typeFilter) return false;
      if (rarityFilter !== "all" && c.rarity !== rarityFilter) return false;
      if (changeFilter === "changed" && !changeIndex.has(c.id)) return false;
      if (changeFilter === "unchanged" && changeIndex.has(c.id)) return false;
      return true;
    });
  }, [cards, activeClass, typeFilter, rarityFilter, changeFilter, changeIndex]);

  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cards) counts[c.class] = (counts[c.class] || 0) + 1;
    return counts;
  }, [cards]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-4">
        {/* Class tabs */}
        <div className="flex flex-wrap gap-1 mb-4">
          {CLASS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setActiveClass(tab.value);
                setTypeFilter("all");
                setRarityFilter("all");
                setChangeFilter("all");
                setShowUpgraded(false);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeClass === tab.value
                  ? `${tab.color} bg-card border border-border`
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="ml-1 text-xs text-muted-foreground">
                {classCounts[tab.value] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">타입:</span>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`rounded px-2 py-0.5 transition-colors ${
                  typeFilter === f.value
                    ? "bg-card border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">희귀도:</span>
            {RARITY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setRarityFilter(f.value)}
                className={`rounded px-2 py-0.5 transition-colors ${
                  rarityFilter === f.value
                    ? "bg-card border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">강화:</span>
            <button
              onClick={() => setShowUpgraded(!showUpgraded)}
              className={`rounded px-2 py-0.5 transition-colors ${
                showUpgraded
                  ? "bg-yellow-500/20 border border-yellow-500/50 text-yellow-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {showUpgraded ? "강화 ON" : "강화 OFF"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">변경이력:</span>
            {([
              { value: "all", label: "전체" },
              { value: "changed", label: "있음" },
              { value: "unchanged", label: "없음" },
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
          </div>
        </div>

        {/* Card count */}
        <div className="mb-3 text-sm text-muted-foreground">
          {filtered.length}장
        </div>

        {/* Card grid */}
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border px-4 py-16 text-center text-muted-foreground">
            해당하는 카드가 없습니다
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {filtered.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                changes={changeIndex.get(card.id) ?? []}
                upgraded={showUpgraded}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
