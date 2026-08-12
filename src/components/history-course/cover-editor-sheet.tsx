"use client";

import Image from "next/image";
import { Dialog } from "radix-ui";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ScrollableBoundedCarousel } from "@/components/codex/bounded-carousel";
import { GameScrollArea } from "@/components/game-scroll-area";
import { HistoryCourseCover } from "@/components/history-course/history-course-cover";
import {
  coverCatalogCard,
  useCoverCardCatalog,
} from "@/hooks/use-cover-card-catalog";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { displayNameForCoverElement } from "@/lib/run-cover-display";
import {
  coverCharacterArtStyle,
  coverCharacterSelectBackgroundSrc,
} from "@/lib/run-cover-character-frame";
import {
  coverCardArtSrc,
  coverCharacterSelectSrc,
  coverElementImageSrc,
} from "@/lib/run-cover-display";
import {
  listRankedCoverBackgroundCards,
  listRankedCoverElements,
  suggestCoverPhrases,
  suggestCovers,
  suggestDefaultCover,
} from "@/lib/run-cover-suggest";
import type { CoverElement, CoverElementKind, CoverSpec } from "@/lib/run-cover-types";
import type { ReplayBadge, ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

export type CoverEditorMeta = {
  win: boolean;
  totalFloors: number;
  ascension: number;
  build: string;
  seed: string;
  runTimeSeconds?: number | null;
  badges?: ReplayBadge[];
};

export interface CoverEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  run: ReplayRun;
  character: string;
  meta: CoverEditorMeta;
  initialCover: CoverSpec;
  onSave: (cover: CoverSpec) => void | Promise<void>;
}

type Variant = "A" | "B";

function backgroundCardId(cover: CoverSpec): string | null {
  return cover.background.kind === "card-beta" ? cover.background.cardId : null;
}

function withoutBackgroundCard(
  elements: CoverElement[],
  cardId: string | null,
): CoverElement[] {
  if (!cardId) return elements;
  return elements.filter((el) => !(el.kind === "card" && el.id === cardId));
}

function withAutoFalse(cover: CoverSpec): CoverSpec {
  return { ...cover, auto: false };
}

export function CoverEditorSheet({
  open,
  onOpenChange,
  runId,
  run,
  character,
  meta,
  initialCover,
  onSave,
}: CoverEditorSheetProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].historyCourse.coverEditor;
  const catalog = useCoverCardCatalog();
  const [reshuffle, setReshuffle] = useState(0);
  const [phraseSeed, setPhraseSeed] = useState(0);
  const [variant, setVariant] = useState<Variant>(
    initialCover.background.kind === "card-beta" ? "B" : "A",
  );
  const [draft, setDraft] = useState<CoverSpec>(initialCover);
  const [elementFilter, setElementFilter] = useState<CoverElementKind | "all">(
    "all",
  );
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const suggested = useMemo(
    () => suggestCovers({ runId, run, reshuffle }),
    [reshuffle, run, runId],
  );

  useEffect(() => {
    if (!open) return;
    setDraft(initialCover);
    setVariant(initialCover.background.kind === "card-beta" ? "B" : "A");
    setReshuffle(0);
    setPhraseSeed(0);
    setQuery("");
    setElementFilter("all");
  }, [initialCover, open]);

  const bgCardId = backgroundCardId(draft);
  const phraseChips = useMemo(
    () =>
      suggestCoverPhrases(
        run,
        draft.elements,
        `${runId}:phrase:${phraseSeed}`,
        5,
      ),
    [draft.elements, phraseSeed, run, runId],
  );

  const elementCandidates = useMemo(() => {
    const ranked = listRankedCoverElements(run, {
      kind: elementFilter,
      exclude: draft.elements.map((el) => ({ kind: el.kind, id: el.id })),
      backgroundCardId: bgCardId,
    });
    const q = query.trim().toLowerCase();
    if (!q) return ranked.slice(0, 24);
    return ranked
      .filter((item) => {
        const name = displayNameForCoverElement({
          kind: item.kind,
          id: item.id,
        }).toLowerCase();
        return item.id.toLowerCase().includes(q) || name.includes(q);
      })
      .slice(0, 36);
  }, [bgCardId, draft.elements, elementFilter, query, run]);

  const backgroundCandidates = useMemo(
    () => listRankedCoverBackgroundCards(run).slice(0, 32),
    [run],
  );

  const selectVariant = (next: Variant) => {
    setVariant(next);
    if (next === "A") {
      setDraft((prev) => ({
        ...prev,
        background: { kind: "character" },
        suggestSeed: suggested.covers[0]!.suggestSeed,
      }));
      return;
    }
    const focusId =
      suggested.covers[1]!.background.kind === "card-beta"
        ? suggested.covers[1]!.background.cardId
        : backgroundCandidates[0]?.id ?? null;
    setDraft((prev) => ({
      ...prev,
      background: focusId
        ? { kind: "card-beta", cardId: focusId }
        : { kind: "character" },
      elements: withoutBackgroundCard(prev.elements, focusId),
      suggestSeed: suggested.covers[1]!.suggestSeed,
    }));
  };

  const applyReshuffle = () => {
    const nextShuffle = reshuffle + 1;
    setReshuffle(nextShuffle);
    const next = suggestCovers({ runId, run, reshuffle: nextShuffle });
    const picked = variant === "A" ? next.covers[0]! : next.covers[1]!;
    setDraft({
      ...picked,
      // Keep editing session custom until save/reset — reshuffle replaces content.
      auto: false,
    });
  };

  const resetToAuto = () => {
    const auto = suggestDefaultCover(runId, run, 0);
    setReshuffle(0);
    setVariant(auto.background.kind === "card-beta" ? "B" : "A");
    setDraft(auto);
  };

  const addElement = (item: { kind: CoverElementKind; id: string; copies: number }) => {
    setDraft((prev) => {
      if (prev.elements.length >= 3) return prev;
      if (prev.elements.some((el) => el.kind === item.kind && el.id === item.id)) {
        return prev;
      }
      if (item.kind === "card" && bgCardId === item.id) return prev;
      const nextEl: CoverElement = {
        kind: item.kind,
        id: item.id,
        ...(item.kind === "card" && item.copies >= 2
          ? { copies: item.copies }
          : {}),
      };
      return { ...prev, elements: [...prev.elements, nextEl] };
    });
  };

  const removeElement = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      elements: prev.elements.filter((_, i) => i !== index),
    }));
  };

  const moveElement = (index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const next = [...prev.elements];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return { ...prev, elements: next };
    });
  };

  const setBackgroundCard = (cardId: string) => {
    setVariant("B");
    setDraft((prev) => ({
      ...prev,
      background: { kind: "card-beta", cardId },
      elements: withoutBackgroundCard(prev.elements, cardId),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = withAutoFalse({
        ...draft,
        phrase: draft.phrase.trim() || suggested.covers[0]!.phrase,
        elements: draft.elements.slice(0, 3),
      });
      await onSave(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-[121] flex h-[min(92dvh,52rem)] max-h-[min(92dvh,52rem)] flex-col overflow-hidden rounded-t-2xl border border-amber-300/20 bg-black shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-[min(92dvh,52rem)] sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <Pencil className="h-4 w-4 text-amber-300/70" aria-hidden />
            <Dialog.Title className="flex-1 font-service text-sm font-bold text-amber-100">
              {copy.title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={serviceMessages[serviceLocale].codex.common.close}
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-white/5 bg-black p-4 shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
              <HistoryCourseCover
                cover={draft}
                character={character}
                meta={meta}
              />
            </div>

            <GameScrollArea
              aria-label={copy.scrollbar}
              className="min-h-0 flex-1"
              dataTestId="cover-editor-body"
              size="large"
            >
            <div className="relative z-0 space-y-5 p-4">
              <section className="relative z-0 space-y-2">
                <h3 className="text-xs font-bold text-zinc-300">{copy.variantLabel}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(["A", "B"] as const).map((key) => {
                    const bCardId =
                      bgCardId
                      ?? (suggested.covers[1]!.background.kind === "card-beta"
                        ? suggested.covers[1]!.background.cardId
                        : backgroundCandidates[0]?.id ?? null);
                    const selected = variant === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectVariant(key)}
                        className={cn(
                          "relative z-0 overflow-hidden rounded-lg ring-2 transition",
                          selected
                            ? "ring-amber-300/80"
                            : "ring-white/10 hover:ring-amber-300/25",
                        )}
                      >
                        <span
                          className={cn(
                            "block transition-[filter]",
                            !selected && "grayscale",
                          )}
                        >
                          <VariantBackgroundThumb
                            kind={key}
                            character={character}
                            cardId={bCardId}
                          />
                        </span>
                        <span
                          className={cn(
                            "block px-2 py-1 text-center text-[10px] font-bold",
                            selected
                              ? "bg-amber-300/20 text-amber-50"
                              : "bg-black/60 text-zinc-400",
                          )}
                        >
                          {key === "A" ? copy.variantA : copy.variantB}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {variant === "B" && (
                <section className="space-y-2">
                  <h3 className="text-xs font-bold text-zinc-300">
                    {copy.backgroundCardLabel}
                  </h3>
                  <ScrollableBoundedCarousel
                    previousLabel={copy.backgroundCardPrevious}
                    nextLabel={copy.backgroundCardNext}
                    dataTestId="cover-editor-background-cards"
                  >
                    {backgroundCandidates.map((item) => {
                      const selected = bgCardId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setBackgroundCard(item.id)}
                          className={cn(
                            "relative h-16 w-12 shrink-0 overflow-hidden rounded-md ring-1",
                            selected
                              ? "ring-amber-300/70"
                              : "ring-white/10 hover:ring-amber-300/30",
                          )}
                          title={displayNameForCoverElement({
                            kind: "card",
                            id: item.id,
                          })}
                        >
                          <Image
                            src={coverElementImageSrc({
                              kind: "card",
                              id: item.id,
                            })}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </button>
                      );
                    })}
                  </ScrollableBoundedCarousel>
                </section>
              )}

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-zinc-300">{copy.phraseLabel}</h3>
                  <span
                    className={cn(
                      "text-[10px] tabular-nums",
                      draft.phrase.length > 18 ? "text-amber-300/80" : "text-zinc-600",
                    )}
                  >
                    {draft.phrase.length}/18
                  </span>
                </div>
                <input
                  value={draft.phrase}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, phrase: e.target.value }))
                  }
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-300/40"
                  placeholder={copy.phrasePlaceholder}
                />
                <div className="flex flex-wrap gap-1.5">
                  {phraseChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, phrase: chip }))}
                      className="rounded-full border border-amber-300/15 bg-amber-100/5 px-2 py-0.5 text-[11px] text-amber-100/80 hover:border-amber-300/35"
                    >
                      {chip}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPhraseSeed((n) => n + 1)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    <RefreshCw className="h-3 w-3" aria-hidden />
                    {copy.rerollPhrases}
                  </button>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-bold text-zinc-300">{copy.elementsLabel}</h3>
                <div className="flex flex-wrap gap-2">
                  {draft.elements.map((el, index) => (
                    <div
                      key={`${el.kind}:${el.id}:${index}`}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-1.5"
                    >
                      <ElementThumb element={el} catalog={catalog} />
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          aria-label={copy.moveUp}
                          onClick={() => moveElement(index, -1)}
                          className="rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={copy.moveDown}
                          onClick={() => moveElement(index, 1)}
                          className="rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeElement(index)}
                        className="rounded px-1 text-[10px] text-red-300/80 hover:bg-red-500/10"
                      >
                        {copy.remove}
                      </button>
                    </div>
                  ))}
                  {draft.elements.length < 3 && (
                    <span className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-[11px] text-zinc-600">
                      {copy.slotEmpty}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ["all", copy.filterAll],
                      ["card", copy.filterCard],
                      ["relic", copy.filterRelic],
                      ["potion", copy.filterPotion],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setElementFilter(key)}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px]",
                        elementFilter === key
                          ? "bg-amber-300/15 text-amber-100"
                          : "text-zinc-500 hover:text-zinc-300",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-300/30"
                />
                <GameScrollArea
                  aria-label={copy.scrollbar}
                  className="h-40 rounded-lg border border-white/5 bg-black/20"
                  scrollerClassName="p-2"
                  dataTestId="cover-editor-element-candidates"
                  size="small"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {elementCandidates.map((item) => (
                      <button
                        key={`${item.kind}:${item.id}`}
                        type="button"
                        disabled={draft.elements.length >= 3}
                        onClick={() => addElement(item)}
                        title={displayNameForCoverElement(item)}
                        className="rounded-md border border-white/10 bg-zinc-900/80 p-1 transition hover:border-amber-300/30 disabled:opacity-40"
                      >
                        <ElementThumb
                          element={{
                            kind: item.kind,
                            id: item.id,
                            copies: item.copies >= 2 ? item.copies : undefined,
                          }}
                          catalog={catalog}
                          compact
                        />
                      </button>
                    ))}
                    {elementCandidates.length === 0 && (
                      <p className="w-full py-4 text-center text-[11px] text-zinc-600">
                        {copy.noCandidates}
                      </p>
                    )}
                  </div>
                </GameScrollArea>
              </section>
            </div>
            </GameScrollArea>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={applyReshuffle}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-amber-300/30 hover:text-amber-100"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              {copy.reshuffle}
            </button>
            <button
              type="button"
              onClick={resetToAuto}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-amber-300/30 hover:text-amber-100"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {copy.reset}
            </button>
            <div className="flex-1" />
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-200"
              >
                {copy.cancel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-md bg-amber-300/90 px-3 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-200 disabled:opacity-60"
            >
              {saving ? copy.saving : copy.save}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A/B picker shows background art only — no overlays that can escape z-index. */
function VariantBackgroundThumb({
  kind,
  character,
  cardId,
}: {
  kind: Variant;
  character: string;
  cardId: string | null;
}) {
  if (kind === "B" && cardId) {
    const art = coverCardArtSrc(cardId);
    return (
      <span className="relative block aspect-video w-full overflow-hidden bg-zinc-950">
        <Image
          src={art.src}
          alt=""
          fill
          className="object-cover object-center scale-110"
          sizes="200px"
        />
      </span>
    );
  }

  const selectBg = coverCharacterSelectBackgroundSrc(character);
  const charSrc = coverCharacterSelectSrc(character);
  const charStyle = coverCharacterArtStyle(character);
  return (
    <span className="relative block aspect-video w-full overflow-hidden bg-zinc-950">
      {selectBg && (
        <Image
          src={selectBg}
          alt=""
          fill
          className="object-cover object-center"
          sizes="200px"
        />
      )}
      <span className="absolute inset-0 overflow-hidden">
        <Image
          src={charSrc}
          alt=""
          fill
          className="object-cover will-change-transform"
          style={charStyle}
          sizes="200px"
        />
      </span>
    </span>
  );
}

function ElementThumb({
  element,
  catalog,
  compact,
}: {
  element: CoverElement;
  catalog: ReturnType<typeof useCoverCardCatalog>;
  compact?: boolean;
}) {
  const size = compact ? 40 : 48;
  if (element.kind === "card") {
    const card = coverCatalogCard(catalog, element.id);
    if (card?.imageUrl) {
      return (
        <Image
          src={card.imageUrl}
          alt=""
          width={size}
          height={Math.round(size * 1.4)}
          className="rounded object-cover"
        />
      );
    }
  }
  return (
    <Image
      src={coverElementImageSrc(element)}
      alt=""
      width={size}
      height={size}
      className="object-contain"
    />
  );
}
