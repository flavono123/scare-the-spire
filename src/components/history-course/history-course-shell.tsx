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
  type NodeStackItemKind,
} from "@/components/history-course/node-action-stack";
import { RunSummary } from "@/components/history-course/run-summary";
import { TopBar } from "@/components/history-course/topbar";
import { buildTopbarState } from "@/components/history-course/topbar-state";
import type { CodexCard } from "@/lib/codex-types";
import { localize } from "@/lib/sts2-i18n";
import {
  analyzeReplayRun,
  type ReplayHistoryEntry,
  type ReplayRun,
} from "@/lib/sts2-run-replay";
import {
  actPositionFromGlobalMs,
  buildRunTimeline,
  globalMsForStep,
  NODE_BASE_MS,
  stackStartOffsetMs,
  stepFromElapsed,
  type ActTimeline,
  type RunTimeline,
} from "@/lib/sts2-run-timeline";
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

// Each act's intro is a moment on the run timeline, just before the
// ancient (the act's first node). Natural progression sweeps through
// the buffer between acts and lands inside this window; jumping into
// an arbitrary mid-act position lands outside it. The "1회만" feel
// drops out automatically — the window only re-fires when globalMs
// leaves and re-enters.
const INTRO_WINDOW_OFFSET_MS = 200; // before actOffset
const INTRO_WINDOW_RADIUS_MS = 250;

function actIntroNumber(index: number) {
  return ["1막", "2막", "3막", "4막"][index] ?? `${index + 1}막`;
}

const KNOWN_CHARACTER_MARKERS = new Set([
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
]);

function characterMarkerSrc(character: string): string {
  // Playback bar slider thumb — game's map_marker_<character>.png sprite,
  // a stylised footstep icon designed to sit on a path.
  const slug = character.replace(/^CHARACTER\./, "").toLowerCase();
  const safe = KNOWN_CHARACTER_MARKERS.has(slug) ? slug : "ironclad";
  return `/images/sts2/map/markers/map_marker_${safe}.png`;
}

function characterIconSrc(character: string): string {
  // On-map character sprite at the current node — matches the topbar's
  // character chip (`character_icon_<x>.webp`) so the player sees the
  // same portrait in two places.
  const slug = character.replace(/^CHARACTER\./, "").toLowerCase();
  const safe = KNOWN_CHARACTER_MARKERS.has(slug) ? slug : "ironclad";
  return `/images/sts2/characters/character_icon_${safe}.webp`;
}

function characterIconOutlineSrc(character: string): string {
  // Outline silhouette companion to character_icon_<x>.webp. Layered
  // beneath the portrait on the map so the marker reads against busy
  // backgrounds without needing a separate disc/ring frame.
  const slug = character.replace(/^CHARACTER\./, "").toLowerCase();
  const safe = KNOWN_CHARACTER_MARKERS.has(slug) ? slug : "ironclad";
  return `/images/sts2/characters/character_icon_${safe}_outline.webp`;
}

function bossKeyFromEntry(entry: ReplayHistoryEntry): string | null {
  const id = entry.rooms?.[0]?.model_id;
  if (!id) return null;
  const match = id.match(/^ENCOUNTER\.(.+_BOSS)$/);
  return match ? match[1] : null;
}

// Ancients ship as character-specific run-history sprites
// (neow / tezcatara / vakuu / orobas / pael / darv / nonupeipe / tanx).
// Every act's first node is an ancient encounter — without per-character
// resolution they all collapse onto the generic yellow "?" tile.
const ANCIENT_KEYS = new Set([
  "NEOW",
  "TEZCATARA",
  "VAKUU",
  "OROBAS",
  "PAEL",
  "DARV",
  "NONUPEIPE",
  "TANX",
]);

function ancientSpriteSrc(modelId: string | null): string | null {
  if (!modelId) return null;
  const m = modelId.match(/^EVENT\.(.+)$/);
  if (!m) return null;
  if (!ANCIENT_KEYS.has(m[1])) return null;
  return `/images/sts2/run-history/${m[1].toLowerCase()}.png`;
}

function nodeSpriteSrc(entry: ReplayHistoryEntry): string {
  const modelId = entry.rooms?.[0]?.model_id ?? null;
  if (entry.map_point_type === "ancient") {
    return ancientSpriteSrc(modelId) ?? "/images/sts2/run-history/ancient.png";
  }
  if (modelId === "EVENT.NEOW") return "/images/sts2/run-history/neow.png";
  if (modelId === "ROOM.ANCIENT") return "/images/sts2/run-history/ancient.png";
  if (entry.map_point_type === "boss") {
    const bossKey = bossKeyFromEntry(entry);
    if (bossKey) return `/images/sts2/bosses/${bossKey.toLowerCase()}.webp`;
    return "/images/sts2/run-history/monster.png";
  }
  switch (entry.map_point_type) {
    case "monster":
      return "/images/sts2/run-history/monster.png";
    case "elite":
      return "/images/sts2/run-history/elite.png";
    case "rest_site":
      return "/images/sts2/run-history/rest_site.png";
    case "treasure":
      return "/images/sts2/run-history/treasure.png";
    case "shop":
      return "/images/sts2/run-history/shop.png";
    case "unknown":
      return "/images/sts2/run-history/event.png";
    default:
      return "/images/sts2/run-history/monster.png";
  }
}

function nextStepGlobalMs(timeline: RunTimeline, cur: number): number {
  // Walk every entry across acts and pick the first whose global startMs
  // exceeds cur — that's the next "node start" jump target.
  for (let i = 0; i < timeline.acts.length; i++) {
    const act = timeline.acts[i];
    const offset = timeline.actOffsets[i] ?? 0;
    for (const entry of act.entries) {
      const g = offset + entry.startMs;
      if (g > cur + 1) return Math.min(g, timeline.totalMs);
    }
  }
  return Math.min(cur, timeline.totalMs);
}

function prevStepGlobalMs(timeline: RunTimeline, cur: number): number {
  let best = 0;
  for (let i = 0; i < timeline.acts.length; i++) {
    const act = timeline.acts[i];
    const offset = timeline.actOffsets[i] ?? 0;
    for (const entry of act.entries) {
      const g = offset + entry.startMs;
      if (g < cur - 1) {
        best = g;
      } else {
        return best;
      }
    }
  }
  return best;
}

function relicIconSrc(id: string): string {
  const slug = id.replace(/^RELIC\./, "").toLowerCase();
  return `/images/sts2/relics/${slug}.webp`;
}

// Some run exports list class starter cards/relics inside the Neow node's
// cards_gained / relic_choices. Strip that pollution so the Neow stack
// reads as 1 card + 1 relic at most. Filter heuristic:
//
//  Cards: drop rarity="기본" (Basic STRIKE_*/DEFEND_*) and drop ids whose
//  occurrence count in cards_gained is *less than* their count in
//  player.deck at floor<=1 (i.e. data lists 1 of a card the player has 5
//  starter copies of — unmistakable starter).
//
//  Relics: drop the player's first-relic id (always the character starter)
//  and cap picked count at 1. The user accepts ambiguity in the data —
//  Neow grants 1 relic by design.
function sanitizeNeowEntry(
  entry: ReplayHistoryEntry,
  run: ReplayRun,
  cardsById: Record<string, CodexCard>,
): ReplayHistoryEntry {
  const isNeow = (entry.rooms ?? []).some((r) => r.model_id === "EVENT.NEOW");
  if (!isNeow) return entry;

  const player = run.players[0];

  // Drop class starter cards (rarity="기본" — STRIKE_X / DEFEND_X). Every
  // other card stays — Curse (DECAY/REGRET as Neow's Bones penalty),
  // Common (multi-card Neow options), Uncommon (Neow's "rare card"
  // option), etc. all read as legitimate stack items.
  const filteredCardsGained = (entry.cards_gained ?? []).filter((c) => {
    if (!c.id) return false;
    const card = cardsById[c.id];
    return card?.rarity !== "기본";
  });

  // Drop the character's starter relic (always player.relics[0]). Every
  // other picked relic stays — Neow's Bones, ascension bonus relics, and
  // the actual Neow gift all render as stack items in order.
  const charStarterRelicId = player?.relics[0]?.id;
  const filteredRelicChoices = (entry.relic_choices ?? []).filter((c) => {
    if (!c.picked) return true; // unpicked passes through (display ignores)
    return c.id !== charStarterRelicId;
  });

  return {
    ...entry,
    cards_gained: filteredCardsGained,
    relic_choices: filteredRelicChoices,
  };
}

function cssEscapeAttr(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/(["\\\]\[])/g, "\\$1");
}

const VERB_BY_KIND: Record<string, string> = {
  "card-gained": "선택",
  "card-bought": "구매",
  "card-upgraded": "강화",
  "card-enchanted": "인챈트",
  "card-skipped": "넘기기",
  "card-removed": "제거",
  "relic-gained": "획득",
  "hp-loss": "피해",
  "hp-heal": "회복",
  "max-hp-up": "최대 HP",
  "max-hp-down": "최대 HP 손실",
};

const TEXT_BY_KIND: Record<string, string | undefined> = {
  "card-gained": undefined,
  "card-bought": "#fbbf24",
  "card-upgraded": "#86efac",
  "card-enchanted": "#d8b4fe",
  "card-skipped": "#a1a1aa",
  "card-removed": "#fca5a5",
  "relic-gained": "#fef3c7",
  "hp-loss": "#fca5a5",
  "hp-heal": "#86efac",
  "max-hp-up": "#fcd34d",
  "max-hp-down": "#fca5a5",
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
  const heartIcon = (
    <Image
      src="/images/sts2/ui/topbar/top_bar_heart.png"
      alt=""
      width={32}
      height={32}
      className="h-8 w-8 shrink-0 object-contain"
      unoptimized
    />
  );

  // HP / max-HP changes always lead the stack — they're the immediate
  // outcome of the room (combat damage, rest heal, event swing) before
  // any reward carousel.
  if ((entry.damage_taken ?? 0) > 0) {
    items.push({
      key: `s${step}-hp-loss-${entry.damage_taken}`,
      kind: "hp-loss",
      icon: heartIcon,
      label: `-${entry.damage_taken}`,
      verb: VERB_BY_KIND["hp-loss"],
      textColor: TEXT_BY_KIND["hp-loss"],
      postEffect: { kind: "fade" },
    });
  }
  if ((entry.hp_healed ?? 0) > 0) {
    items.push({
      key: `s${step}-hp-heal-${entry.hp_healed}`,
      kind: "hp-heal",
      icon: heartIcon,
      label: `+${entry.hp_healed}`,
      verb: VERB_BY_KIND["hp-heal"],
      textColor: TEXT_BY_KIND["hp-heal"],
      postEffect: { kind: "fade" },
    });
  }
  if ((entry.max_hp_gained ?? 0) > 0) {
    items.push({
      key: `s${step}-max-up-${entry.max_hp_gained}`,
      kind: "max-hp-up",
      icon: heartIcon,
      label: `+${entry.max_hp_gained}`,
      verb: VERB_BY_KIND["max-hp-up"],
      textColor: TEXT_BY_KIND["max-hp-up"],
      postEffect: { kind: "fade" },
    });
  }
  if ((entry.max_hp_lost ?? 0) > 0) {
    items.push({
      key: `s${step}-max-down-${entry.max_hp_lost}`,
      kind: "max-hp-down",
      icon: heartIcon,
      label: `-${entry.max_hp_lost}`,
      verb: VERB_BY_KIND["max-hp-down"],
      textColor: TEXT_BY_KIND["max-hp-down"],
      postEffect: { kind: "fade" },
    });
  }

  // Same input list either way; only the verb / colour change between
  // a battle reward and a shop purchase. Both still fly into the deck.
  const isShop = entry.map_point_type === "shop";
  const cardKind: NodeStackItemKind = isShop ? "card-bought" : "card-gained";
  for (const c of entry.cards_gained ?? []) {
    if (!c.id) continue;
    gainedIds.add(c.id);
    items.push({
      key: `s${step}-cg-${items.length}-${c.id}`,
      kind: cardKind,
      icon: cardIcon(c.id),
      label: cardLabel(c.id),
      verb: VERB_BY_KIND[cardKind],
      textColor: TEXT_BY_KIND[cardKind],
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

  // Shop / curse-cleansing — cards_removed flows through the same fade
  // post-effect (no fly target — the deck is losing this slot).
  for (const c of entry.cards_removed ?? []) {
    if (!c.id) continue;
    items.push({
      key: `s${step}-cr-${items.length}-${c.id}`,
      kind: "card-removed",
      icon: cardIcon(c.id),
      label: cardLabel(c.id),
      verb: VERB_BY_KIND["card-removed"],
      textColor: TEXT_BY_KIND["card-removed"],
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

export function HistoryCourseShell({
  run,
  cardsById,
}: {
  run: ReplayRun;
  cardsById: Record<string, CodexCard>;
}) {
  const analysis = useMemo(() => analyzeReplayRun(run), [run]);
  // Strip Neow starter pollution from each act's history so both the stack
  // and the timeline see the same trimmed entry. Other UI (deck modal,
  // topbar) keeps using raw data — that path already handles starter
  // attribution via gainedRemaining.
  const sanitizedActs = useMemo(
    () =>
      analysis.acts.map((act) => ({
        ...act,
        history: act.history.map((entry) =>
          sanitizeNeowEntry(entry, run, cardsById),
        ),
      })),
    [analysis.acts, run, cardsById],
  );
  const runTimeline = useMemo(
    () => buildRunTimeline(sanitizedActs),
    [sanitizedActs],
  );
  // Continuous time model — Phase 2: single run-global axis. actIndex /
  // actLocalMs / step are derived from globalMs.
  const [globalMs, setGlobalMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState<Rate>(2);
  const [infoOpen, setInfoOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [introToken, setIntroToken] = useState(0);
  const [introActive, setIntroActive] = useState(false);
  const [replayReady, setReplayReady] = useState(false);
  // Per-act window-entry tracker. wasInIntroWindowRef[i] = true while
  // globalMs is inside act i's intro window; we only fire on the
  // false→true edge. Jumping inside the window fires; jumping outside
  // it (forward or backward) does not.
  const wasInIntroWindowRef = useRef<boolean[]>([]);

  const { actIndex, actLocalMs } = useMemo(
    () => actPositionFromGlobalMs(runTimeline, globalMs),
    [runTimeline, globalMs],
  );
  const introActIndex = useMemo(() => {
    for (let i = 0; i < runTimeline.acts.length; i++) {
      const center =
        (runTimeline.actOffsets[i] ?? 0) - INTRO_WINDOW_OFFSET_MS;
      if (Math.abs(globalMs - center) < INTRO_WINDOW_RADIUS_MS) return i;
    }
    return null;
  }, [globalMs, runTimeline]);
  const introAct =
    introActIndex !== null
      ? sanitizedActs[introActIndex] ?? null
      : null;

  const act = sanitizedActs[actIndex] ?? null;
  const actTimeline: ActTimeline | null =
    runTimeline.acts[actIndex] ?? null;
  const step = useMemo(
    () => (actTimeline ? stepFromElapsed(actTimeline, actLocalMs) : 1),
    [actTimeline, actLocalMs],
  );
  const topbarState = useMemo(
    () => buildTopbarState(analysis, actIndex, step),
    [analysis, actIndex, step],
  );

  // Fire intros on window entry (false→true edge per act). Natural
  // progression sweeps through; large jumps land inside or outside the
  // window with the same rule. No per-session de-dup — leaving and
  // re-entering refires.
  useEffect(() => {
    const acts = runTimeline.acts;
    if (wasInIntroWindowRef.current.length !== acts.length) {
      wasInIntroWindowRef.current = acts.map(() => false);
    }
    for (let i = 0; i < acts.length; i++) {
      const center =
        (runTimeline.actOffsets[i] ?? 0) - INTRO_WINDOW_OFFSET_MS;
      const isIn = Math.abs(globalMs - center) < INTRO_WINDOW_RADIUS_MS;
      const wasIn = wasInIntroWindowRef.current[i] ?? false;
      if (isIn && !wasIn) {
        setIntroToken((t) => t + 1);
        setIntroActive(true);
        setReplayReady(false);
        // Snap to the act's offset so:
        //   1. the ancient stack starts at nodeLocalMs=0 once intro
        //      ends (no wasted buffer-bleed time), and
        //   2. actIndex flips to the new act *now*, letting the map
        //      view swap + scroll behind the fade-in instead of
        //      jumping after fade-out.
        setGlobalMs(runTimeline.actOffsets[i] ?? 0);
      }
      wasInIntroWindowRef.current[i] = isIn;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalMs, runTimeline]);

  // Auto-close the intro after its fade cycle.
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

  // The relic ids that the *current step's* stack will fly into the topbar.
  // Derived from the sanitized history entry directly (NOT stepStackItems,
  // which is gated on replayReady and reads as empty during the act-intro
  // fade-out → scroll → ready window — that gap is the bug where the
  // topbar briefly shows every floor-1 relic stacked together). Page load
  // / restart / map-node-click all hit the same code path now.
  const stepRelicIdsKey = useMemo(() => {
    if (!act) return "";
    const entry = act.history[step - 1];
    if (!entry) return "";
    return (entry.relic_choices ?? [])
      .filter((c) => c.picked && c.id)
      .map((c) => c.id)
      .join("|");
  }, [act, step]);
  useEffect(() => {
    setPendingRelicIds(
      stepRelicIdsKey ? new Set(stepRelicIdsKey.split("|")) : new Set(),
    );
  }, [stepRelicIdsKey]);

  // rAF ticker. Every animation frame nudges globalMs by `dt × rate` while
  // playing. Step + stack + topbar all derive from globalMs, so a paused
  // tick simply stops the time axis — no more setTimeout-per-node dance.
  // Auto-advance across acts is implicit: globalMs crossing into the next
  // actOffset flips actIndex via the derive in the render body.
  useEffect(() => {
    if (!playing || !replayReady) return;
    if (runTimeline.totalMs <= 0) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = (now - last) * rate;
      last = now;
      setGlobalMs((prev) => Math.min(prev + dt, runTimeline.totalMs));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [playing, rate, replayReady, runTimeline.totalMs]);

  // Keyboard scrub — global-ms anchored: ArrowRight jumps to next entry's
  // startMs (across acts at the seam), ArrowLeft to the previous entry.
  useEffect(() => {
    if (runTimeline.totalMs <= 0) return;
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
        setGlobalMs((cur) => nextStepGlobalMs(runTimeline, cur));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        setGlobalMs((cur) => prevStepGlobalMs(runTimeline, cur));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runTimeline]);

  const onSelectAct = useCallback(
    (idx: number) => {
      setGlobalMs(globalMsForStep(runTimeline, idx, 1));
      setPlaying(true);
    },
    [runTimeline],
  );

  const onJumpToStep = useCallback(
    (targetActIndex: number, targetStep: number) => {
      setGlobalMs(globalMsForStep(runTimeline, targetActIndex, targetStep));
      setPlaying(false);
    },
    [runTimeline],
  );


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
          actLocalMs={actLocalMs}
          actTimeline={actTimeline}
          runTimeline={runTimeline}
          sanitizedActs={sanitizedActs}
          globalMs={globalMs}
          totalActs={analysis.acts.length}
          introToken={introToken}
          introActive={introActive}
          introActIndex={introActIndex}
          introAct={introAct}
          playing={playing}
          rate={rate}
          stackItems={stepStackItems}
          hidingRelicIds={pendingRelicIds}
          topbarState={topbarState}
          cardsById={cardsById}
          runEnded={
            runTimeline.totalMs > 0 && globalMs >= runTimeline.totalMs - 1
          }
          onTogglePlay={() => setPlaying((v) => !v)}
          onChangeRate={setRate}
          onScrubGlobalMs={(value) => {
            setPlaying(false);
            setGlobalMs(Math.max(0, Math.min(value, runTimeline.totalMs)));
          }}
          onJumpToStep={onJumpToStep}
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
  actLocalMs,
  actTimeline,
  runTimeline,
  sanitizedActs,
  globalMs,
  totalActs,
  introToken,
  introActive,
  introActIndex,
  introAct,
  playing,
  rate,
  stackItems,
  hidingRelicIds,
  topbarState,
  cardsById,
  runEnded,
  onTogglePlay,
  onChangeRate,
  onScrubGlobalMs,
  onJumpToStep,
  onOpenStats,
  onOpenDeck,
  onOpenInfo,
}: {
  run: ReplayRun;
  act: Act;
  actIndex: number;
  step: number;
  actLocalMs: number;
  actTimeline: ActTimeline | null;
  runTimeline: RunTimeline;
  sanitizedActs: Act[];
  globalMs: number;
  totalActs: number;
  introToken: number;
  introActive: boolean;
  introActIndex: number | null;
  introAct: Act | null;
  playing: boolean;
  rate: Rate;
  stackItems: NodeStackItem[];
  hidingRelicIds: ReadonlySet<string>;
  topbarState: ReturnType<typeof buildTopbarState>;
  cardsById: Record<string, CodexCard>;
  runEnded: boolean;
  onTogglePlay: () => void;
  onChangeRate: (rate: Rate) => void;
  onScrubGlobalMs: (ms: number) => void;
  onJumpToStep: (actIndex: number, step: number) => void;
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

  // Phase 4 transit — leading NODE_BASE_MS of every node is the path-trail
  // paint window. The shell snaps globalMs to actOffset on intro fire, so
  // step 1 also sees a fresh transit (Neow drops in via row-0 → ancient
  // edges).
  const nodeLocalMsRaw = Math.max(
    0,
    actLocalMs - (actTimeline?.entries[step - 1]?.startMs ?? 0),
  );
  const transitProgress = Math.max(
    0,
    Math.min(1, nodeLocalMsRaw / NODE_BASE_MS),
  );
  const transitEdgeIds = useMemo(
    () => new Set(act.candidateEdgeIdsByStep[step - 1] ?? []),
    [act, step],
  );
  const mapCharacterMarkerSrc = characterIconSrc(
    run.players[0]?.character ?? "CHARACTER.IRONCLAD",
  );
  const mapCharacterMarkerOutlineSrc = characterIconOutlineSrc(
    run.players[0]?.character ?? "CHARACTER.IRONCLAD",
  );

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
    // Scroll runs even while the intro overlay is visible — the new
    // act's map is already mounted (we snapped globalMs to actOffset
    // when the window fired), and the user should *see* it scrolling
    // through the fade-in/hold instead of jumping after fade-out.
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
        cumulativeElapsedMs={globalMs}
        totalRunMs={runTimeline.totalMs}
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
        }}
      >
        <div className="flex min-h-full justify-center">
          <SeededMapView
            act={act}
            step={step}
            onSeekToStep={(s) => onJumpToStep(actIndex, s)}
            transitProgress={transitProgress}
            transitEdgeIds={transitEdgeIds}
            characterMarkerSrc={mapCharacterMarkerSrc}
            characterMarkerOutlineSrc={mapCharacterMarkerOutlineSrc}
          />
        </div>
      </div>

      <NodePulse step={step} />

      {introActive && introActIndex !== null && introAct && (
        <ActIntro
          key={introToken}
          actIndex={introActIndex}
          act={introAct}
        />
      )}

      <NodeActionStack
        stageRef={stageRef}
        items={stackItems}
        nodeLocalMs={Math.max(
          0,
          actLocalMs - (actTimeline?.entries[step - 1]?.startMs ?? 0) - stackStartOffsetMs(),
        )}
        hidden={transitProgress < 1}
      />

      <PlaybackBar
        run={run}
        runTimeline={runTimeline}
        sanitizedActs={sanitizedActs}
        actIndex={actIndex}
        step={step}
        globalMs={globalMs}
        playing={playing}
        rate={rate}
        onTogglePlay={onTogglePlay}
        onChangeRate={onChangeRate}
        onScrubGlobalMs={onScrubGlobalMs}
        onJumpToStep={onJumpToStep}
      />

      <RunSummary
        run={run}
        acts={sanitizedActs}
        topbarState={topbarState}
        cardsById={cardsById}
        visible={runEnded}
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
}: {
  actIndex: number;
  act: Act;
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

  const overlayOpacity = phase === "in" ? 1 : phase === "hold" ? 1 : 0;
  const transitionMs =
    phase === "in" ? ACT_INTRO_FADE_IN_MS : ACT_INTRO_FADE_OUT_MS;
  const transition = `opacity ${transitionMs}ms ${phase === "in" ? "ease-out" : "ease-in"}`;

  // Game-style intro: a thin translucent grey band hugging the title's
  // vertical extent, leaving the map visible above and below. Top line
  // is the small cyan act number ("1막"), bottom line is the larger
  // gold act label. The whole band fades in/out in unison.
  return (
    <div
      aria-hidden
      data-testid="act-intro"
      className="pointer-events-none absolute inset-x-0 top-1/2 z-30 -translate-y-1/2"
      style={{ opacity: overlayOpacity, transition }}
    >
      <div className="flex flex-col items-center justify-center bg-zinc-200/15 py-5 backdrop-blur-[1px]">
        <div
          className="text-center"
          style={{
            color: "#22d3ee",
            fontSize: "1.05rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textShadow: "0 1px 6px rgba(0,0,0,0.85)",
          }}
        >
          {actIntroNumber(actIndex)}
        </div>
        <div
          className="text-center"
          style={{
            color: "#fbbf24",
            fontSize: "3.6rem",
            fontWeight: 900,
            letterSpacing: "-0.01em",
            lineHeight: 1.05,
            marginTop: "0.45rem",
            textShadow:
              "0 2px 4px rgba(0,0,0,0.85), 0 4px 18px rgba(0,0,0,0.7)",
          }}
        >
          {act.actLabel}
        </div>
      </div>
    </div>
  );
}

function PlaybackBar({
  run,
  runTimeline,
  sanitizedActs,
  actIndex,
  step,
  globalMs,
  playing,
  rate,
  onTogglePlay,
  onChangeRate,
  onScrubGlobalMs,
  onJumpToStep,
}: {
  run: ReplayRun;
  runTimeline: RunTimeline;
  sanitizedActs: Act[];
  actIndex: number;
  step: number;
  globalMs: number;
  playing: boolean;
  rate: Rate;
  onTogglePlay: () => void;
  onChangeRate: (rate: Rate) => void;
  onScrubGlobalMs: (ms: number) => void;
  onJumpToStep: (actIndex: number, step: number) => void;
}) {
  const safeMax = Math.max(1, runTimeline.totalMs);
  const character = run.players[0]?.character ?? "CHARACTER.IRONCLAD";
  const markerSrc = characterMarkerSrc(character);
  const progressPct = (Math.min(globalMs, safeMax) / safeMax) * 100;
  const totalStepCount = sanitizedActs.reduce(
    (acc, a) => acc + a.history.length,
    0,
  );
  const completedStepCount = sanitizedActs
    .slice(0, actIndex)
    .reduce((acc, a) => acc + a.history.length, 0) + step;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/85 to-black/0 px-4 pb-3 pt-10 text-zinc-100">
      <Track
        runTimeline={runTimeline}
        sanitizedActs={sanitizedActs}
        currentActIndex={actIndex}
        currentStep={step}
        globalMs={globalMs}
        progressPct={progressPct}
        markerSrc={markerSrc}
        onScrubGlobalMs={onScrubGlobalMs}
        onJumpToStep={onJumpToStep}
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
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">{completedStepCount}/{totalStepCount}</span>
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

// Track baseline sits this far above the container's bottom — leaves
// room below for node sprite tails and visual breathing room.
const TRACK_BASELINE_PX = 16;
const NODE_SPRITE_PX = 24;
// Min gap between node centers before we start sparsifying through the
// modular stride (every Nth node + always-shown landmarks).
const NODE_DENSITY_PX = 22;

/** Time-mapped track. Each node is positioned at `entry.startMs / totalMs`
 *  so the character marker (acting as the slider thumb) lines up with the
 *  current node's stack-start. Drag scrubbing and keyboard nav still flow
 *  through a transparent `<input type="range">` underneath. */
function Track({
  runTimeline,
  sanitizedActs,
  currentActIndex,
  currentStep,
  globalMs,
  progressPct,
  markerSrc,
  onScrubGlobalMs,
  onJumpToStep,
}: {
  runTimeline: RunTimeline;
  sanitizedActs: Act[];
  currentActIndex: number;
  currentStep: number;
  globalMs: number;
  progressPct: number;
  markerSrc: string;
  onScrubGlobalMs: (ms: number) => void;
  onJumpToStep: (actIndex: number, step: number) => void;
}) {
  const safeMax = Math.max(1, runTimeline.totalMs);
  const containerRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setTrackWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => {
      setTrackWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totalNodes = sanitizedActs.reduce(
    (acc, a) => acc + a.history.length,
    0,
  );
  // Modular stride for sparse rendering. When the track is wide enough
  // every node fits at NODE_DENSITY_PX spacing → stride 1 (show all).
  // Otherwise stride = ceil(needed / available); landmarks (act first /
  // last, ancients, bosses, the active node) ignore the stride.
  const stride = Math.max(
    1,
    trackWidth > 0
      ? Math.ceil((totalNodes * NODE_DENSITY_PX) / trackWidth)
      : 1,
  );

  return (
    <div
      ref={containerRef}
      className="relative h-14 select-none"
    >
      {/* Track baseline */}
      <div
        className="pointer-events-none absolute inset-x-0 h-[2px] rounded-full bg-white/15"
        style={{ bottom: `${TRACK_BASELINE_PX}px` }}
      />
      {/* Progress fill up to the character */}
      <div
        className="pointer-events-none absolute left-0 h-[2px] rounded-full bg-amber-300/70"
        style={{
          bottom: `${TRACK_BASELINE_PX}px`,
          width: `${progressPct}%`,
        }}
      />

      {/* Hidden range input — handles drag scrub + keyboard. Sits below
       *  the node buttons so node clicks still win, but covers the empty
       *  track gaps for seek-by-drag. */}
      <input
        type="range"
        min={0}
        max={safeMax}
        step={50}
        value={Math.min(globalMs, safeMax)}
        onChange={(event) => onScrubGlobalMs(Number(event.target.value))}
        aria-label="재생 위치"
        className="absolute inset-0 z-0 h-full w-full cursor-pointer opacity-0"
      />

      {/* Nodes — absolute-positioned at startMs%. Node visual centre lines
       *  up with the global ms axis. Sparse mode hides intermediate
       *  monster/event nodes via stride; landmarks always render. */}
      {sanitizedActs.map((rowAct, rowIdx) => {
        const offset = runTimeline.actOffsets[rowIdx] ?? 0;
        const actEntries = runTimeline.acts[rowIdx]?.entries ?? [];
        const lastIdx = rowAct.history.length - 1;
        return rowAct.history.map((entry, idx) => {
          const stepNum = idx + 1;
          const startMs = offset + (actEntries[idx]?.startMs ?? 0);
          const leftPct = (startMs / safeMax) * 100;
          const isCurrent =
            rowIdx === currentActIndex && stepNum === currentStep;
          const isPast =
            rowIdx < currentActIndex ||
            (rowIdx === currentActIndex && stepNum < currentStep);
          const isLandmark =
            isCurrent ||
            idx === 0 ||
            idx === lastIdx ||
            entry.map_point_type === "ancient" ||
            entry.map_point_type === "boss";
          if (!isLandmark && stride > 1 && idx % stride !== 0) {
            return null;
          }
          return (
            <button
              key={`${rowIdx}-${stepNum}`}
              type="button"
              onClick={() => onJumpToStep(rowIdx, stepNum)}
              className={cn(
                "group absolute z-10 flex -translate-x-1/2 items-center justify-center transition",
                isPast
                  ? "opacity-95"
                  : isCurrent
                    ? "opacity-100"
                    : "opacity-70 hover:opacity-100",
              )}
              style={{
                left: `${leftPct}%`,
                bottom: `${TRACK_BASELINE_PX - NODE_SPRITE_PX / 2}px`,
                width: `${NODE_SPRITE_PX}px`,
                height: `${NODE_SPRITE_PX}px`,
              }}
              aria-label={`${rowIdx + 1}막 ${stepNum}층`}
              aria-current={isCurrent ? "true" : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={nodeSpriteSrc(entry)}
                alt=""
                draggable={false}
                className="h-full w-full select-none object-contain transition-transform duration-150 group-hover:scale-[1.6]"
              />
            </button>
          );
        });
      })}

      {/* Character marker = slider thumb. Bottom tip pinned to the track
       *  baseline so the marker stands on the line; clicks still pass
       *  through to the input range underneath via pointer-events-none. */}
      <span
        aria-hidden
        className="pointer-events-none absolute z-20 -translate-x-1/2"
        style={{
          left: `${progressPct}%`,
          bottom: `${TRACK_BASELINE_PX}px`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={markerSrc}
          alt=""
          draggable={false}
          className="h-10 w-10 select-none object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
        />
      </span>
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
