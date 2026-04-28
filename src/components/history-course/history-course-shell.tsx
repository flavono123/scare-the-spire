"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapBackdrop,
  SeededMapView,
} from "@/components/dev/run-replay-poc";
import { CardActionIcon } from "@/components/history-course/card-action-icon";
import { DeckModal } from "@/components/history-course/deck-modal";
import {
  NodeActionStack,
  type NodeStackItem,
} from "@/components/history-course/node-action-stack";
import { TopBar } from "@/components/history-course/topbar";
import { buildTopbarState } from "@/components/history-course/topbar-state";
import type { CodexCard } from "@/lib/codex-types";
import { localize } from "@/lib/sts2-i18n";
import {
  analyzeReplayRun,
  type ReplayHistoryEntry,
  type ReplayRun,
} from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

type Analysis = ReturnType<typeof analyzeReplayRun>;
type Act = Analysis["acts"][number];

const NAV_OFFSET_PX = 49;
const STAGE_WIDTH = `min(100vw, calc((100dvh - ${NAV_OFFSET_PX}px) * 16 / 9), 1600px)` as const;
const PLAYBACK_RATES = [1, 2, 4, 8, 16] as const;
type Rate = (typeof PLAYBACK_RATES)[number];

const ACT_INTRO_FADE_IN_MS = 600;
const ACT_INTRO_HOLD_MS = 1500;
const ACT_INTRO_FADE_OUT_MS = 500;
const ACT_INTRO_TOTAL_MS = ACT_INTRO_FADE_IN_MS + ACT_INTRO_HOLD_MS + ACT_INTRO_FADE_OUT_MS;

function actIntroNumber(index: number) {
  return ["1막", "2막", "3막", "4막"][index] ?? `${index + 1}막`;
}

// Per-node hold time (seconds at 1×). Tuned shorter — task-3 motion design
// is still TBD; until proper combat/animation beats land, longer holds just
// felt like stalls.
function nodeHoldSeconds(entry: ReplayHistoryEntry): number {
  const turns = (entry.rooms ?? []).reduce(
    (sum, r) => sum + Math.max(0, r.turns_taken ?? 0),
    0,
  );
  const turnSeconds = turns * 2;
  switch (entry.map_point_type) {
    case "monster":
    case "MONSTER":
      return Math.max(1.2, turnSeconds * 0.4);
    case "elite":
    case "ELITE":
      return Math.max(1.6, turnSeconds * 0.5);
    case "boss":
    case "BOSS":
      return Math.max(2.0, turnSeconds * 0.6);
    case "rest_site":
    case "REST_SITE":
      return 0.7;
    case "treasure":
    case "TREASURE":
      return 0.5;
    case "shop":
    case "SHOP":
      return 0.9;
    case "ancient":
    case "ANCIENT":
      return 0.8;
    case "unknown":
    case "UNKNOWN":
      return Math.max(1.0, turnSeconds * 0.35);
    default:
      return 1.0;
  }
}

function relicIconSrc(id: string): string {
  const slug = id.replace(/^RELIC\./, "").toLowerCase();
  return `/images/sts2/relics/${slug}.webp`;
}

function cssEscapeAttr(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/(["\\\]\[])/g, "\\$1");
}

const VERB_BY_KIND: Record<string, string> = {
  "card-gained": "선택",
  "card-upgraded": "강화",
  "card-enchanted": "인챈트",
  "card-skipped": "넘기기",
  "relic-gained": "획득",
};

const TEXT_BY_KIND: Record<string, string | undefined> = {
  "card-gained": undefined,
  "card-upgraded": "#86efac",
  "card-enchanted": "#d8b4fe",
  "card-skipped": "#a1a1aa",
  "relic-gained": "#fef3c7",
};

function buildStackItems(
  entry: ReplayHistoryEntry,
  step: number,
  cardsById: Record<string, CodexCard>,
  onRelicLanded: (id: string) => void,
): NodeStackItem[] {
  const items: NodeStackItem[] = [];
  const gainedIds = new Set<string>();

  const cardLabel = (id: string) =>
    localize("cards", id) ?? id.split(".").pop() ?? "?";

  const placeholderIcon = (
    <span aria-hidden className="inline-block h-8 w-8 shrink-0" />
  );
  const cardIcon = (id: string) => {
    const card = cardsById[id];
    return card ? <CardActionIcon card={card} width={32} /> : placeholderIcon;
  };

  for (const c of entry.cards_gained ?? []) {
    if (!c.id) continue;
    gainedIds.add(c.id);
    items.push({
      key: `s${step}-cg-${items.length}-${c.id}`,
      kind: "card-gained",
      icon: cardIcon(c.id),
      label: cardLabel(c.id),
      verb: VERB_BY_KIND["card-gained"],
      textColor: TEXT_BY_KIND["card-gained"],
      postEffect: { kind: "fly", targetSelector: "[data-deck-target]" },
    });
  }

  for (const cardId of entry.upgraded_cards ?? []) {
    items.push({
      key: `s${step}-cu-${items.length}-${cardId}`,
      kind: "card-upgraded",
      icon: cardIcon(cardId),
      label: cardLabel(cardId) + "+",
      verb: VERB_BY_KIND["card-upgraded"],
      textColor: TEXT_BY_KIND["card-upgraded"],
      postEffect: { kind: "fade" },
    });
  }

  for (const e of entry.cards_enchanted ?? []) {
    const enchantName = localize("enchantments", e.enchantmentId) ?? e.enchantmentId;
    items.push({
      key: `s${step}-ce-${items.length}-${e.cardId}-${e.enchantmentId}`,
      kind: "card-enchanted",
      icon: cardIcon(e.cardId),
      label: `${cardLabel(e.cardId)} ${enchantName}`,
      verb: VERB_BY_KIND["card-enchanted"],
      textColor: TEXT_BY_KIND["card-enchanted"],
      postEffect: { kind: "fade" },
    });
  }

  const choices = entry.card_choices ?? [];
  if (choices.length > 0) {
    const anyPicked = choices.some((c) => c.picked);
    if (!anyPicked && gainedIds.size === 0) {
      items.push({
        key: `s${step}-skip-${items.length}`,
        kind: "card-skipped",
        icon: placeholderIcon,
        label: "",
        verb: VERB_BY_KIND["card-skipped"],
        textColor: TEXT_BY_KIND["card-skipped"],
        postEffect: { kind: "fade" },
      });
    }
  }

  for (const c of entry.relic_choices ?? []) {
    if (!c.picked || !c.id) continue;
    const id = c.id;
    items.push({
      key: `s${step}-rg-${items.length}-${id}`,
      kind: "relic-gained",
      icon: (
        <div className="relative h-8 w-8 shrink-0">
          <Image
            src={relicIconSrc(id)}
            alt=""
            fill
            sizes="32px"
            className="object-contain drop-shadow-[0_0_8px_rgba(255,200,120,0.85)]"
            unoptimized
          />
        </div>
      ),
      label: localize("relics", id) ?? id.split(".").pop() ?? "?",
      verb: VERB_BY_KIND["relic-gained"],
      textColor: TEXT_BY_KIND["relic-gained"],
      postEffect: {
        kind: "fly",
        targetSelector: `[data-relic-target="${cssEscapeAttr(id)}"]`,
      },
      onComplete: () => onRelicLanded(id),
    });
  }

  return items;
}

// Total run time the stack needs to play. Used by the playback driver to
// stretch a step's hold so a node never advances before its stack finishes.
function stackPlayMs(items: NodeStackItem[], rate: Rate): number {
  if (items.length === 0) return 0;
  const factor = 1 / Math.sqrt(rate);
  // Per-item budget — must stay loosely synced with NodeActionStack's
  // internal phase clock (appear+hold+textFade+gap+post).
  const flyMs = (280 + 1700 + 280 + 100 + 640) * factor;
  const fadeMs = (280 + 1700 + 280 + 100 + 380) * factor;
  let total = 0;
  for (const it of items) {
    total += it.postEffect.kind === "fly" ? flyMs : fadeMs;
  }
  // Slack so the next node doesn't steal focus the very tick the last
  // post-effect lands.
  return Math.round(total + 220);
}

export function HistoryCourseShell({
  run,
  cardsById,
}: {
  run: ReplayRun;
  cardsById: Record<string, CodexCard>;
}) {
  const analysis = useMemo(() => analyzeReplayRun(run), [run]);
  const [actIndex, setActIndex] = useState(0);
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState<Rate>(2);
  const [infoOpen, setInfoOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [introToken, setIntroToken] = useState(0);
  const [introActive, setIntroActive] = useState(true);
  // After the act intro fades, the map runs a one-time smooth scroll to the
  // current step; replay only begins (rewards + auto-advance) once that
  // scroll has settled. Otherwise the first relic measures off-screen
  // coordinates and the user sees a jumpy fly-out.
  const [replayReady, setReplayReady] = useState(false);
  const [prevActIndex, setPrevActIndex] = useState(actIndex);

  const act = analysis.acts[actIndex] ?? null;
  const topbarState = useMemo(
    () => buildTopbarState(analysis, actIndex, step),
    [analysis, actIndex, step],
  );

  // act swap → reset step + replay intro. Done as a render-time prop diff
  // so the synchronous setState chain stays out of an effect body.
  if (actIndex !== prevActIndex) {
    setPrevActIndex(actIndex);
    setStep(1);
    setIntroToken((t) => t + 1);
    setIntroActive(true);
    setReplayReady(false);
  }

  // The intro auto-finishes after the total fade window. Effect just owns
  // the timer; the trigger lives in the conditional setState above.
  useEffect(() => {
    if (!introActive) return;
    const t = window.setTimeout(() => setIntroActive(false), ACT_INTRO_TOTAL_MS);
    return () => window.clearTimeout(t);
  }, [introActive, introToken]);

  // Once the intro is gone, allow ~850ms for the map to smooth-scroll into
  // place before replay (rewards + auto-advance) actually starts. The Stage
  // gates its scrollToStep on `replayPhase` so the user *sees* the scroll
  // happen here instead of behind the intro.
  useEffect(() => {
    if (introActive || replayReady) return;
    const t = window.setTimeout(() => setReplayReady(true), 850);
    return () => window.clearTimeout(t);
  }, [introActive, replayReady]);

  // Relics that have been emitted by the current step's stack but haven't
  // yet completed their fly to the topbar slot. We keep this *outside* the
  // memoized item list so the per-item onComplete callback can mutate it
  // without invalidating the items reference (which would reset the slot
  // machine to index 0).
  const [pendingRelicIds, setPendingRelicIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const releaseRelicId = useCallback((id: string) => {
    setPendingRelicIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const stepStackItems = useMemo<NodeStackItem[]>(() => {
    if (!act || !replayReady) return [];
    const entry = act.history[step - 1];
    if (!entry) return [];
    return buildStackItems(entry, step, cardsById, releaseRelicId);
  }, [act, step, replayReady, cardsById, releaseRelicId]);

  // Pre-load pendingRelicIds whenever the step's stack changes — every relic
  // in the new batch starts pending, gets released by its own onComplete.
  const stackKeyRef = useRef<string>("");
  const stackKey = `${actIndex}-${step}`;
  if (stackKeyRef.current !== stackKey) {
    stackKeyRef.current = stackKey;
    const ids = new Set<string>();
    for (const item of stepStackItems) {
      if (item.kind === "relic-gained") {
        const idMatch = item.key.match(/-rg-\d+-(.+)$/);
        if (idMatch) ids.add(idMatch[1]);
      }
    }
    setPendingRelicIds(ids);
  }

  // playback driver: hold each step by node weight, plus extra for rewards
  useEffect(() => {
    if (!playing || !act || !replayReady) return;
    const entry = act.history[step - 1];
    if (!entry) return;
    const next = act.history[step];
    if (!next) {
      if (actIndex + 1 < analysis.acts.length) {
        const t = window.setTimeout(() => setActIndex((i) => i + 1), 700);
        return () => window.clearTimeout(t);
      }
      return;
    }
    let holdMs = Math.max(220, Math.round((nodeHoldSeconds(entry) * 1000) / rate));
    const extra = stackPlayMs(stepStackItems, rate);
    if (extra > 0) holdMs = Math.max(holdMs, extra);
    const timer = window.setTimeout(() => {
      setStep((s) => Math.min(s + 1, act.history.length));
    }, holdMs);
    return () => window.clearTimeout(timer);
  }, [playing, step, rate, act, actIndex, analysis.acts.length, replayReady, stepStackItems]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((v) => !v);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPlaying(false);
        setStep((s) => (act ? Math.min(s + 1, act.history.length) : s));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        setStep((s) => Math.max(1, s - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act]);

  const onSelectAct = useCallback((idx: number) => {
    setActIndex(idx);
    setPlaying(true);
  }, []);

  const onRestart = useCallback(() => {
    setStep(1);
    setIntroToken((t) => t + 1);
    setIntroActive(true);
    setPlaying(true);
    window.setTimeout(() => setIntroActive(false), ACT_INTRO_TOTAL_MS);
  }, []);

  if (!act) {
    return (
      <div className="flex h-[calc(100dvh-49px)] items-center justify-center bg-black text-sm text-zinc-400">
        분석 가능한 막이 없습니다.
      </div>
    );
  }

  return (
    <div className="relative isolate overflow-hidden bg-black">
      <SceneBackdrop actId={act.actId} />

      <div className="relative z-10 flex h-[calc(100dvh-49px)] w-full items-center justify-center">
        <Stage
          run={run}
          act={act}
          actIndex={actIndex}
          step={step}
          totalActs={analysis.acts.length}
          introToken={introToken}
          introActive={introActive}
          playing={playing}
          rate={rate}
          stackItems={stepStackItems}
          hidingRelicIds={pendingRelicIds}
          topbarState={topbarState}
          onTogglePlay={() => setPlaying((v) => !v)}
          onRestart={onRestart}
          onChangeRate={setRate}
          onScrub={(value) => {
            setPlaying(false);
            setStep(value);
          }}
          onOpenStats={() => setStatsOpen(true)}
          onOpenDeck={() => setDeckOpen(true)}
          onOpenInfo={() => setInfoOpen((v) => !v)}
        />
      </div>

      <SideToggle open={infoOpen} onToggle={() => setInfoOpen((v) => !v)} />
      <InfoDrawer
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        analysis={analysis}
        actIndex={actIndex}
        onSelectAct={onSelectAct}
        run={run}
      />

      <StatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        analysis={analysis}
        run={run}
      />

      <DeckModal
        open={deckOpen}
        onClose={() => setDeckOpen(false)}
        deck={topbarState.deck}
        cardsById={cardsById}
        currentFloor={topbarState.currentFloor}
      />
    </div>
  );
}

function SceneBackdrop({ actId }: { actId: string }) {
  return (
    <div className="absolute inset-0 -z-0">
      <div className="absolute inset-0 scale-110 opacity-50 blur-2xl">
        <MapBackdrop actId={actId} />
      </div>
      <div className="absolute inset-0 bg-black/70" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.85) 100%)",
        }}
      />
    </div>
  );
}

function Stage({
  run,
  act,
  actIndex,
  step,
  totalActs,
  introToken,
  introActive,
  playing,
  rate,
  stackItems,
  hidingRelicIds,
  topbarState,
  onTogglePlay,
  onRestart,
  onChangeRate,
  onScrub,
  onOpenStats,
  onOpenDeck,
  onOpenInfo,
}: {
  run: ReplayRun;
  act: Act;
  actIndex: number;
  step: number;
  totalActs: number;
  introToken: number;
  introActive: boolean;
  playing: boolean;
  rate: Rate;
  stackItems: NodeStackItem[];
  hidingRelicIds: ReadonlySet<string>;
  topbarState: ReturnType<typeof buildTopbarState>;
  onTogglePlay: () => void;
  onRestart: () => void;
  onChangeRate: (rate: Rate) => void;
  onScrub: (step: number) => void;
  onOpenStats: () => void;
  onOpenDeck: () => void;
  onOpenInfo: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mapBoxRef = useRef<HTMLDivElement>(null);
  const userScrollGuardRef = useRef<number | null>(null);
  // Sentinel — first effect run scrolls to current step (otherwise the
  // initial step=1 view leaves the map at scrollTop=0, hiding the ancient
  // node behind subsequent rows).
  const lastStepRef = useRef<number | null>(null);

  const scrollToStep = useCallback(() => {
    const node = mapBoxRef.current;
    if (!node) return;
    const inner = node.firstElementChild as HTMLElement | null;
    if (!inner) return;
    const total = inner.scrollHeight - node.clientHeight;
    if (total <= 0) {
      node.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const progress = act.history.length > 1 ? (step - 1) / (act.history.length - 1) : 1;
    const target = Math.round((1 - progress) * total);
    node.scrollTo({ top: target, behavior: "smooth" });
  }, [act, step]);

  useEffect(() => {
    // Hold the scroll until the act intro fades — we want the user to *see*
    // the map slide into the first node, not for it to happen behind the
    // black overlay. Once intro is done, this fires (lastStepRef==null on
    // first pass guarantees the scroll happens at least once per act).
    if (introActive) return;
    if (lastStepRef.current === step) return;
    lastStepRef.current = step;
    // mark this as a programmatic scroll so the user-scroll guard ignores it
    if (userScrollGuardRef.current) window.clearTimeout(userScrollGuardRef.current);
    userScrollGuardRef.current = window.setTimeout(() => {
      userScrollGuardRef.current = null;
    }, 700);
    scrollToStep();
  }, [step, scrollToStep, introActive]);

  // act change → reset the scroll-tracking sentinel so the next intro/scroll
  // cycle treats the new act fresh (otherwise the same step number across
  // acts would skip the scroll).
  useEffect(() => {
    lastStepRef.current = null;
  }, [actIndex]);

  return (
    <div
      ref={stageRef}
      className="relative overflow-hidden ring-1 ring-white/10 shadow-[0_30px_120px_-30px_rgba(0,0,0,0.9)]"
      style={{ width: STAGE_WIDTH, aspectRatio: "16 / 9" }}
    >
      <TopBar
        run={run}
        act={act}
        state={topbarState}
        hidingRelicIds={hidingRelicIds}
        onOpenStats={onOpenStats}
        onOpenDeck={onOpenDeck}
        onOpenInfo={onOpenInfo}
      />

      <div
        ref={mapBoxRef}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden pt-[96px]"
        style={{
          willChange: "scroll-position",
          contain: "paint",
          // While a node action stack is playing, dim + soft-blur the map so
          // the stack reads as the focus. Container has no visible boundary
          // (each item carries its own radial halo).
          filter:
            stackItems.length > 0
              ? "blur(2.5px) brightness(0.62) saturate(0.85)"
              : undefined,
          transition: "filter 280ms ease-out",
        }}
      >
        <div className="flex min-h-full justify-center">
          <SeededMapView act={act} step={step} onSeekToStep={onScrub} />
        </div>
      </div>

      <NodePulse step={step} />

      <ActIntro key={introToken} actIndex={actIndex} act={act} totalActs={totalActs} />

      <NodeActionStack
        stageRef={stageRef}
        items={stackItems}
        rate={rate}
      />

      <PlaybackBar
        step={step}
        stepCount={act.history.length}
        playing={playing}
        rate={rate}
        onTogglePlay={onTogglePlay}
        onRestart={onRestart}
        onChangeRate={onChangeRate}
        onScrub={onScrub}
      />
    </div>
  );
}

function NodePulse({ step }: { step: number }) {
  // brief glow flash whenever step changes — gives the discrete jump some life
  return (
    <div
      key={step}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10"
      style={{
        background:
          "radial-gradient(ellipse at center 75%, rgba(255,200,120,0.22) 0%, transparent 55%)",
        animation: "hc-node-pulse 700ms ease-out",
      }}
    />
  );
}

function ActIntro({
  actIndex,
  act,
  totalActs,
}: {
  actIndex: number;
  act: Act;
  totalActs: number;
}) {
  // Phase starts at "in" via the initial state, so the effect only owns
  // the timer cascade — no synchronous setState in the effect body.
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "done">("in");

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("hold"), ACT_INTRO_FADE_IN_MS);
    const t2 = window.setTimeout(
      () => setPhase("out"),
      ACT_INTRO_FADE_IN_MS + ACT_INTRO_HOLD_MS,
    );
    const t3 = window.setTimeout(
      () => setPhase("done"),
      ACT_INTRO_TOTAL_MS,
    );
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  if (phase === "done") return null;

  const textOpacity = phase === "in" ? 0 : phase === "hold" ? 1 : 0;
  const overlayOpacity = phase === "out" ? 0 : 1;
  const textTransition =
    phase === "in"
      ? `opacity ${ACT_INTRO_FADE_IN_MS}ms ease-out`
      : phase === "out"
        ? `opacity ${ACT_INTRO_FADE_OUT_MS}ms ease-in`
        : "opacity 0ms";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black"
      style={{
        opacity: overlayOpacity,
        transition: `opacity ${ACT_INTRO_FADE_OUT_MS}ms ease-in`,
      }}
    >
      <div className="text-center text-white" style={{ opacity: textOpacity, transition: textTransition }}>
        <div className="text-xs uppercase tracking-[0.4em] text-zinc-300">
          {actIntroNumber(actIndex)} / {totalActs}막
        </div>
        <div className="mt-3 text-5xl font-black tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
          {act.actLabel}
        </div>
      </div>
    </div>
  );
}

function PlaybackBar({
  step,
  stepCount,
  playing,
  rate,
  onTogglePlay,
  onRestart,
  onChangeRate,
  onScrub,
}: {
  step: number;
  stepCount: number;
  playing: boolean;
  rate: Rate;
  onTogglePlay: () => void;
  onRestart: () => void;
  onChangeRate: (rate: Rate) => void;
  onScrub: (step: number) => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/85 to-black/0 px-4 pb-3 pt-8 text-zinc-100">
      <input
        type="range"
        min={1}
        max={stepCount}
        value={step}
        onChange={(event) => onScrub(Number(event.target.value))}
        className="w-full accent-amber-300"
      />
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex h-7 w-12 items-center justify-center rounded-md border border-white/20 bg-black/40 transition hover:bg-white/10"
            aria-label={playing ? "일시정지" : "재생"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-xs transition hover:bg-white/10"
          >
            처음부터
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">{step}/{stepCount}</span>
          <div className="ml-2 inline-flex overflow-hidden rounded-md border border-white/15 bg-black/30">
            {PLAYBACK_RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChangeRate(r)}
                className={cn(
                  "px-2 py-1 transition",
                  rate === r
                    ? "bg-amber-500/30 text-amber-100"
                    : "text-zinc-300 hover:bg-white/10",
                )}
                aria-pressed={rate === r}
              >
                {r}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 1.5 L12 7 L3 12.5 Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2.5" y="1.5" width="3.2" height="11" />
      <rect x="8.3" y="1.5" width="3.2" height="11" />
    </svg>
  );
}

function SideToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="런 정보 패널"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-md border border-r-0 border-white/15 bg-zinc-950/85 px-2 py-3 text-zinc-300 backdrop-blur-sm transition hover:bg-zinc-900",
        open && "translate-x-[-340px] bg-zinc-900",
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M3 3.5 H13 M3 8 H13 M3 12.5 H10" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function InfoDrawer({
  open,
  onClose,
  analysis,
  actIndex,
  onSelectAct,
  run,
}: {
  open: boolean;
  onClose: () => void;
  analysis: Analysis;
  actIndex: number;
  onSelectAct: (idx: number) => void;
  run: ReplayRun;
}) {
  const character = run.players[0]?.character?.split(".").pop() ?? "?";
  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "fixed right-0 top-[49px] z-30 h-[calc(100dvh-49px)] w-[340px] overflow-y-auto border-l border-white/10 bg-zinc-950/95 p-4 backdrop-blur-md transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-zinc-100">런 정보</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/10"
        >
          닫기
        </button>
      </div>

      <dl className="mt-4 space-y-2 text-xs text-zinc-300">
        <Row label="시드" value={run.seed} />
        <Row label="승천" value={`A${run.ascension}`} />
        <Row label="빌드" value={run.build_id} />
        <Row label="캐릭터" value={character} />
        <Row label="결과" value={run.win ? "승리" : "패배"} />
      </dl>

      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">막</p>
        <ul className="mt-2 space-y-1.5">
          {analysis.acts.map((act, idx) => (
            <li key={`${act.actId}-${act.actIndex}`}>
              <button
                type="button"
                onClick={() => onSelectAct(idx)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition",
                  idx === actIndex
                    ? "border-amber-300/60 bg-amber-500/10 text-amber-100"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-600",
                )}
                aria-current={idx === actIndex ? "true" : undefined}
              >
                <span className="truncate">{act.actLabel}</span>
                <span className="text-zinc-500">{act.history.length}층</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </dt>
      <dd className="truncate text-zinc-200">{value}</dd>
    </div>
  );
}

function StatsModal({
  open,
  onClose,
  analysis,
  run,
}: {
  open: boolean;
  onClose: () => void;
  analysis: Analysis;
  run: ReplayRun;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const character = run.players[0]?.character?.split(".").pop() ?? "?";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/65 backdrop-blur-[2px]"
      />
      <div className="relative z-10 w-full max-w-3xl rounded-xl border border-white/15 bg-zinc-950/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-zinc-50">
            도전 이력
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/10"
          >
            닫기
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          시드 {run.seed} · A{run.ascension} · {character} · {run.win ? "승리" : "패배"}
        </p>
        <ul className="mt-5 grid gap-1.5 text-xs">
          {analysis.acts.map((act) => (
            <li
              key={`${act.actId}-${act.actIndex}`}
              className="flex justify-between border-b border-white/5 pb-1.5 text-zinc-300"
            >
              <span>{act.actLabel}</span>
              <span className="text-zinc-500">{act.history.length}층</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
