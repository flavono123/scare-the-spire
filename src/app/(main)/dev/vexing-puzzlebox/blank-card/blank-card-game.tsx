"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CardTile } from "@/components/codex/card-tile";
import {
  CARD_TYPE_FILTER_ICONS,
  COLORLESS_FILTER_ICON,
  TOKEN_FILTER_ICON,
} from "@/components/codex/codex-filter-assets";
import { GameHoverTip } from "@/components/codex/hover-tip";
import StaticImage from "@/components/ui/static-image";
import { useMerchantSay } from "@/components/vexing-puzzlebox/merchant-feedback";
import type { CodexCard, CodexKeyword } from "@/lib/codex-types";
import {
  HINTS,
  HINT_KEYS,
  LIVES,
  cardText,
  conflicts,
  hintPoints,
  hintValue,
  isRefusedProposal,
  matchProposal,
  normalizeProposal,
  scoreLines,
  totalScore,
  type HintKey,
  type ScoreLine,
} from "@/lib/blank-card";
import { playPurchaseFailedWiggle } from "@/lib/merchant-feedback";
import { gameStroke } from "@/lib/sts2-card-style";
import { HintRoulette, type HintOption } from "./hint-roulette";
import { BlankCardScoreBoard } from "./score-board";

// Near-black grayscale: darker than any game frame (curse frames sit at v=0.55), so a ghost never reads as a real value.
const GHOST_FILTER = "grayscale(1) brightness(0.3)";
const GHOST_TEXT = "#5b5b5b";
const GHOST_STROKE = "#151515";
const ROTATE_MS = 700;
const SPEEDS = [1, 2, 4, 8, 16] as const;
const DEFAULT_SPEED = 4;
const CARD_WIDTH = 300;
const CANDIDATE_WIDTH = 116;
const HIDDEN_RUN = { color: "transparent", textShadow: "none" } as const;
/** combat-sim: a card that cannot be played shows its cost in STS red with a dark red outline. */
const UNPLAYABLE_COST = "#FF5555";
const UNPLAYABLE_COST_OUTLINE = "#501717";
/** combat-sim playable highlight. */
const PLAYABLE_GLOW = "0 0 10px 7px rgba(0, 244, 252, 0.98)";
const HEART_SRC = "/images/sts2/ui/topbar/top_bar_heart.png";

const HINT_LABEL: Record<HintKey, string> = { cost: "비용", color: "캐릭터", rarity: "희귀도", type: "유형" };
const VALUE_ORDER: Record<HintKey, string[]> = {
  cost: ["0", "1", "2", "3", "4", "5", "6", "9", "12", "X", ""],
  color: ["ironclad", "silent", "defect", "necrobinder", "regent", "fool", "colorless", "curse", "token"],
  rarity: ["기본", "일반", "고급", "희귀", "토큰", "상태이상", "저주"],
  type: ["공격", "스킬", "파워", "상태이상", "저주"],
};
const ROTATE_OFFSET: Record<HintKey, number> = { cost: 0, color: 3, rarity: 5, type: 1 };
const CURSE_ICON = "/images/game-assets/card-library/filter_curse.webp";
const STATUS_ICON = "/images/game-assets/card-library/filter_status.webp";
const REWARD_ICON = "/images/sts2/ui/reward-screen";
const HINT_ICON: Record<HintKey, Record<string, string>> = {
  cost: {},
  color: {
    ironclad: "/images/sts2/relics/yummy_cookie_ironclad.webp",
    silent: "/images/sts2/relics/yummy_cookie_silent.webp",
    defect: "/images/sts2/relics/yummy_cookie_defect.webp",
    necrobinder: "/images/sts2/relics/yummy_cookie_necro.webp",
    regent: "/images/sts2/relics/yummy_cookie_regent.webp",
    fool: "/images/sts2/relics/yummy_cookie_fool.webp",
    colorless: COLORLESS_FILTER_ICON,
    curse: CURSE_ICON,
    token: TOKEN_FILTER_ICON,
  },
  // The reward row icons of a guaranteed-rarity card reward; rarities without one borrow the compendium filters.
  rarity: {
    기본: `${REWARD_ICON}/reward_icon_card.webp`,
    일반: `${REWARD_ICON}/reward_icon_card.webp`,
    고급: `${REWARD_ICON}/reward_icon_uncommon.webp`,
    희귀: `${REWARD_ICON}/reward_icon_rare.webp`,
    토큰: TOKEN_FILTER_ICON,
    상태이상: STATUS_ICON,
    저주: CURSE_ICON,
  },
  type: { ...CARD_TYPE_FILTER_ICONS, 상태이상: STATUS_ICON, 저주: CURSE_ICON },
};

interface Proposal {
  text: string;
  hit: boolean;
}

interface Flight {
  id: number;
  indices: Set<number>;
}

type Status = "playing" | "won" | "lost";

function pickAnswer(cards: CodexCard[], id?: string): CodexCard {
  return cards.find((card) => card.id === id) ?? cards[Math.floor(Math.random() * cards.length)];
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** CardTile layers (data-card-layer) each hint paints. */
const HINT_LAYERS: Record<HintKey, string[]> = {
  cost: ["cost", "star-cost"],
  color: ["frame", "cost"],
  rarity: ["banner", "portrait-border", "type-plaque"],
  type: ["frame", "portrait-border", "type-plaque"],
};

/** Card transform / evolution beat: the part goes white, then its real look shows through. */
function playWhiteFlash(elements: HTMLElement[]): void {
  if (reducedMotion()) return;
  for (const element of elements) {
    // Keep the layer's own tint under the flash so it ends on its real look.
    const base = element.style.filter;
    element.animate(
      [
        { filter: `${base} brightness(0) invert(1)` },
        { filter: `${base} brightness(0) invert(1)`, offset: 0.25 },
        { filter: `${base} brightness(1) invert(0)` },
      ],
      { duration: 650, easing: "ease-out" },
    );
  }
}

export default function BlankCardGame({
  cards,
  keywords,
  colorLabels,
  version,
  initialCardId,
}: {
  cards: CodexCard[];
  keywords: CodexKeyword[];
  colorLabels: Record<string, string>;
  version: string;
  initialCardId?: string;
}) {
  const say = useMerchantSay();
  const texts = useMemo(() => new Map(cards.map((card) => [card.id, cardText(card)])), [cards]);
  const poolTexts = useMemo(() => [...texts.values()], [texts]);
  const points = useMemo(() => hintPoints(cards), [cards]);
  const rotation = useMemo(() => {
    const present = (key: HintKey) => new Set(cards.map((card) => hintValue(card, key)));
    return Object.fromEntries(
      HINT_KEYS.map((key) => [key, VALUE_ORDER[key].filter((value) => present(key).has(value))]),
    ) as Record<HintKey, string[]>;
  }, [cards]);
  const labels = useMemo(() => {
    const typeLabels = new Map(cards.map((card) => [card.type as string, card.typeLabel]));
    const rarityLabels = new Map(cards.map((card) => [card.rarity as string, card.rarityLabel]));
    return { typeLabels, rarityLabels };
  }, [cards]);
  const valueLabel = useCallback((key: HintKey, value: string) => {
    if (key === "color") return colorLabels[value] ?? value;
    if (key === "rarity") return labels.rarityLabels.get(value) ?? value;
    if (key === "type") return labels.typeLabels.get(value) ?? value;
    return value === "" ? "없음" : value;
  }, [colorLabels, labels]);
  const hintOptions = useMemo(() => Object.fromEntries(HINT_KEYS.map((key) => [
    key,
    rotation[key].map((value): HintOption => (key === "cost"
      ? value === ""
        ? { value, label: valueLabel(key, value), icon: "/images/game-assets/card-misc/card_unplayable_icon.png" }
        : { value, label: valueLabel(key, value), icon: "/images/game-assets/card-misc/energy_colorless.png", overlay: value }
      : {
        value,
        label: valueLabel(key, value),
        icon: HINT_ICON[key][value] ?? CURSE_ICON,
        // Basic and Common share one game look; dim Basic so the roulette tells them apart.
        filter: key === "rarity" && value === "기본" ? "brightness(0.7)" : undefined,
      })),
  ])) as Record<HintKey, HintOption[]>, [rotation, valueLabel]);
  const keywordNames = useMemo(
    () => keywords.map((keyword) => keyword.name).filter((name) => poolTexts.some((text) => matchProposal(text, name).length > 0)),
    [keywords, poolTexts],
  );

  const [answer, setAnswer] = useState<CodexCard>(() => pickAnswer(cards, initialCardId));
  const [hints, setHints] = useState<Partial<Record<HintKey, string>>>({});
  const [lives, setLives] = useState(LIVES);
  const [hurt, setHurt] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [submissions, setSubmissions] = useState(0);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [landed, setLanded] = useState<Set<number>>(() => new Set());
  const [flight, setFlight] = useState<Flight | null>(null);
  const [status, setStatus] = useState<Status>("playing");
  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  const [word, setWord] = useState("");
  const [wordFocus, setWordFocus] = useState(false);
  const [guessQuery, setGuessQuery] = useState("");
  const [pickQuery, setPickQuery] = useState("");
  const [salt] = useState(() => Math.floor(Math.random() * 1000));
  const [flash, setFlash] = useState<{ key: HintKey; n: number } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const flightCounter = useRef(0);
  const clones = useRef<HTMLElement[]>([]);

  const text = texts.get(answer.id)!;
  const slotStarts = useMemo(() => new Map(text.slots.map((slot) => [slot.slot, slot.start])), [text]);
  const hintsUsed = HINT_KEYS.filter((key) => hints[key] !== undefined);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), ROTATE_MS / speed);
    return () => window.clearInterval(timer);
  }, [status, speed]);

  const clearClones = useCallback(() => {
    clones.current.forEach((clone) => clone.remove());
    clones.current = [];
  }, []);
  useEffect(() => clearClones, [clearClones]);

  const land = useCallback((landing: Flight) => {
    setRevealed((current) => new Set([...current, ...landing.indices]));
    setLanded(new Set(landing.indices));
    setFlight((current) => (current?.id === landing.id ? null : current));
  }, []);

  // Each newly matched run flies from the word box to the exact spot the card's own layout gives it.
  useLayoutEffect(() => {
    if (!flight) return;
    const nodes = [...(cardRef.current?.querySelectorAll<HTMLElement>(`[data-flight="${flight.id}"]`) ?? [])];
    const from = wordInputRef.current?.getBoundingClientRect();
    if (!from || nodes.length === 0 || reducedMotion()) {
      land(flight);
      return;
    }
    let remaining = nodes.length;
    const animations: Animation[] = [];
    nodes.forEach((node, i) => {
      const target = node.getBoundingClientRect();
      const own = getComputedStyle(node);
      const parent = getComputedStyle(node.parentElement ?? node);
      const clone = document.createElement("span");
      clone.textContent = node.textContent;
      Object.assign(clone.style, {
        position: "fixed",
        left: `${target.left}px`,
        top: `${target.top}px`,
        fontFamily: own.fontFamily,
        fontSize: own.fontSize,
        fontWeight: own.fontWeight,
        lineHeight: own.lineHeight,
        letterSpacing: own.letterSpacing,
        color: parent.color,
        textShadow: "0 0 8px rgba(0,0,0,0.9)",
        whiteSpace: "pre",
        pointerEvents: "none",
        zIndex: "80",
      });
      document.body.appendChild(clone);
      clones.current.push(clone);
      const dx = from.left + from.width / 2 - (target.left + target.width / 2);
      const dy = from.top + from.height / 2 - (target.top + target.height / 2);
      const animation = clone.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(1.9)`, opacity: 0 },
          { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 48}px) scale(1.5)`, opacity: 1, offset: 0.5 },
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
        ],
        { duration: 720, delay: i * 90, easing: "cubic-bezier(0.25, 0.8, 0.3, 1)", fill: "backwards" },
      );
      animation.onfinish = () => {
        clone.remove();
        clones.current = clones.current.filter((item) => item !== clone);
        remaining -= 1;
        if (remaining === 0) land(flight);
      };
      animations.push(animation);
    });
    // A new round removes the clones; cancelling keeps their landing off the next card.
    return () => animations.forEach((animation) => {
      if (animation.playState !== "finished") animation.cancel();
    });
  }, [flight, land]);

  const runState = useCallback(
    (offset: number) => {
      if (revealed.has(offset)) return landed.has(offset) ? "landed" : "shown";
      return flight?.indices.has(offset) ? "flight" : "hidden";
    },
    [revealed, landed, flight],
  );

  const descriptionMask = useMemo(() => ({
    text: (slot: string, value: string) => {
      const start = slotStarts.get(slot);
      if (start === undefined || value.length === 0) return value;
      const runs: ReactNode[] = [];
      let from = 0;
      let state = runState(start);
      for (let i = 1; i <= value.length; i += 1) {
        const next = i < value.length ? runState(start + i) : null;
        if (next === state) continue;
        const piece = value.slice(from, i);
        const key = `${slot}-${from}`;
        if (state === "hidden") runs.push(<span key={key} style={HIDDEN_RUN}>{piece}</span>);
        else if (state === "flight") runs.push(<span key={key} style={HIDDEN_RUN} data-flight={flight?.id}>{piece}</span>);
        else if (state === "landed") runs.push(<span key={key} className="blank-card-landed">{piece}</span>);
        else runs.push(<span key={key}>{piece}</span>);
        from = i;
        if (next) state = next;
      }
      return runs;
    },
    iconHidden: (slot: string) => {
      const start = slotStarts.get(slot);
      return start !== undefined && !revealed.has(start);
    },
  }), [slotStarts, runState, flight, revealed]);

  const known = useMemo(() => ({
    hints,
    present: proposals.filter((p) => p.hit).map((p) => p.text),
    absent: proposals.filter((p) => !p.hit).map((p) => p.text),
    wrongGuesses,
  }), [hints, proposals, wrongGuesses]);

  const loseLife = () => {
    setLives(lives - 1);
    setHurt((value) => value + 1);
    if (lives - 1 <= 0) setStatus("lost");
  };

  const submitWord = (raw: string) => {
    const proposal = normalizeProposal(raw);
    const form = formRef.current;
    if (status !== "playing" || flight || !proposal || !form) return;
    if (isRefusedProposal(proposal, poolTexts)) {
      playPurchaseFailedWiggle(form);
      say("forbidden", form);
      return;
    }
    if (proposals.some((p) => p.text === proposal)) {
      playPurchaseFailedWiggle(form);
      return;
    }
    setAttempts((value) => value + 1);
    const hits = matchProposal(text, proposal);
    setProposals((current) => [...current, { text: proposal, hit: hits.length > 0 }]);
    setWord("");
    if (hits.length === 0) {
      playPurchaseFailedWiggle(form);
      loseLife();
      return;
    }
    const fresh = hits.filter((offset) => !revealed.has(offset));
    if (fresh.length > 0) {
      flightCounter.current += 1;
      setLanded(new Set());
      setFlight({ id: flightCounter.current, indices: new Set(fresh) });
    }
  };

  const onWordSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitWord(word);
  };

  const submitAnswer = (card: CodexCard) => {
    if (status !== "playing" || wrongGuesses.includes(card.id)) return;
    setSubmissions((value) => value + 1);
    setGuessQuery("");
    if (card.id === answer.id) {
      setStatus("won");
      return;
    }
    // A wrong card, fitting or not, is the shop's "not enough gold" wiggle on the blank card.
    if (tileRef.current) playPurchaseFailedWiggle(tileRef.current);
    setWrongGuesses((current) => [...current, card.id]);
    loseLife();
  };

  const revealHint = (key: HintKey) => {
    if (status !== "playing") return;
    setHints((current) => ({ ...current, [key]: hintValue(answer, key) }));
    setFlash((current) => ({ key, n: (current?.n ?? 0) + 1 }));
  };

  // After the revealed value has rendered, flash only the layers that hint paints.
  useEffect(() => {
    if (!flash || !tileRef.current) return;
    const selector = HINT_LAYERS[flash.key].map((layer) => `[data-card-layer="${layer}"]`).join(",");
    playWhiteFlash([...tileRef.current.querySelectorAll<HTMLElement>(selector)]);
  }, [flash]);

  const newRound = (next?: CodexCard) => {
    clearClones();
    const nextAnswer = next ?? pickAnswer(cards);
    setAnswer(nextAnswer);
    setHints({});
    setLives(LIVES);
    setHurt(0);
    setAttempts(0);
    setSubmissions(0);
    setProposals([]);
    setWrongGuesses([]);
    setRevealed(new Set());
    setLanded(new Set());
    setFlight(null);
    setStatus("playing");
    setWord("");
    setGuessQuery("");
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("card", next.id);
    else url.searchParams.delete("card");
    window.history.replaceState(null, "", url);
  };

  const valueOf = (key: HintKey) =>
    hints[key] ?? rotation[key][(tick + ROTATE_OFFSET[key]) % rotation[key].length];

  const color = valueOf("color") as CodexCard["color"];
  const type = valueOf("type") as CodexCard["type"];
  const rarity = valueOf("rarity") as CodexCard["rarity"];
  const cost = valueOf("cost");
  const costKnown = hints.cost !== undefined;
  const blank: CodexCard = {
    ...answer,
    // A neutral id keeps card-specific overlays (Infection) off the blank card.
    id: "BLANK_CARD",
    name: "",
    nameEn: "",
    type,
    typeLabel: labels.typeLabels.get(type) ?? type,
    color,
    visualColor: color,
    rarity,
    rarityLabel: labels.rarityLabels.get(rarity) ?? rarity,
    cost: costKnown && cost === "" ? -1 : 0,
    isXCost: false,
    starCost: costKnown ? answer.starCost : null,
    isXStarCost: costKnown ? answer.isXStarCost : false,
    imageUrl: null,
    betaImageUrl: null,
    upgrade: null,
    specialUpgrade: undefined,
    madScienceVariant: undefined,
  };
  const costContent = costKnown && cost === "" ? undefined : (
    <span
      style={costKnown
        ? (hints.color === undefined ? { WebkitTextStrokeColor: GHOST_STROKE } : undefined)
        : { color: GHOST_TEXT, WebkitTextStrokeColor: GHOST_STROKE }}
    >
      {cost}
    </span>
  );

  const wordQuery = normalizeProposal(word);
  const keywordSuggestions = wordFocus && status === "playing"
    ? keywordNames.filter((name) => !proposals.some((p) => p.text === name) && (!wordQuery || name.includes(wordQuery)))
    : [];

  const searchCards = (query: string, limit: number) => {
    const q = normalizeProposal(query).toLowerCase();
    if (!q) return [];
    return cards.filter((card) => card.name.toLowerCase().includes(q) || card.nameEn.toLowerCase().includes(q)).slice(0, limit);
  };
  const candidates = searchCards(guessQuery, 40)
    .map((card) => ({ card, fits: conflicts(card, texts.get(card.id)!, known).length === 0 }))
    .sort((left, right) => Number(right.fits) - Number(left.fits))
    .slice(0, 6);

  const lines = status === "playing"
    ? []
    : scoreLines({ solved: status === "won", hintsUsed, attempts, submissions, livesLeft: lives }, points);
  const answerOption = (key: HintKey) => hintOptions[key].find((option) => option.value === hintValue(answer, key));
  const lineIcon = (line: ScoreLine) => {
    if (line.hint) return answerOption(line.hint)?.icon ?? CURSE_ICON;
    if (line.key === "lives") return HEART_SRC;
    if (line.key === "attempts") return "/images/sts2/nav/patch_notes_icon.png";
    if (line.key === "hole-in-one") return "/images/sts2/relics/vexing_puzzlebox.webp";
    return `${REWARD_ICON}/reward_icon_card.webp`;
  };

  return (
    <main className="min-h-screen bg-[#0c0d11] px-4 py-6 text-zinc-100">
      <style>{`
        @keyframes blank-card-land { 0% { text-shadow: 0 0 14px #ffe08a, 0 0 4px #fff; } 100% { text-shadow: inherit; } }
        .blank-card-landed { animation: blank-card-land 900ms ease-out; }
        @keyframes blank-card-hint-pop { 0% { transform: scale(1); } 40% { transform: scale(1.06); } 100% { transform: scale(1); } }
        .blank-card-hint-pop { animation: blank-card-hint-pop 320ms ease-out; }
        @keyframes blank-card-score-line { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .blank-card-score-line { animation: blank-card-score-line 300ms ease-out; }
      `}</style>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 md:flex-row md:items-start md:justify-center">
        <section className="flex flex-col items-center gap-3">
          <div className="flex w-full items-center justify-between text-sm">
            <span className="flex items-center gap-1" aria-label={`라이프 ${lives}`}>
              {Array.from({ length: LIVES }, (_, i) => (
                <StaticImage
                  key={`${i}-${i === lives ? hurt : 0}`}
                  src={HEART_SRC}
                  alt=""
                  width={72}
                  height={60}
                  className={`h-[30px] w-9 object-contain ${i === lives && hurt > 0 ? "beta-quiz-life-lost" : i < lives ? "" : "opacity-35 brightness-50 grayscale"}`}
                />
              ))}
            </span>
            <span className="text-xs text-zinc-400">문구 시도 {attempts} · 정답 제출 {submissions}</span>
          </div>
          {/* A lighter table keeps the near-black ghost readable. */}
          <div
            ref={cardRef}
            className="relative rounded-2xl px-8 py-6"
            style={{ background: "radial-gradient(circle at 50% 40%, #4a4f5c 0%, #262a33 75%)" }}
          >
            {hurt > 0 && <div key={`hurt-${hurt}`} className="beta-quiz-hurt pointer-events-none absolute inset-0 z-10 rounded-2xl" aria-hidden="true" />}
            <div ref={tileRef}>
              {status === "playing" ? (
                <CardTile
                  card={blank}
                  showUpgrade={false}
                  showBeta={false}
                  width={CARD_WIDTH}
                  interactive={false}
                  titleContent=""
                  artContent={<div className="h-full w-full bg-[#09090b]" />}
                  costContent={costContent}
                  descriptionMask={descriptionMask}
                  layerFilterSuffix={{
                    character: hints.color === undefined ? GHOST_FILTER : undefined,
                    rarity: hints.rarity === undefined ? GHOST_FILTER : undefined,
                  }}
                />
              ) : (
                <CardTile card={answer} showUpgrade={false} showBeta={false} width={CARD_WIDTH} interactive={false} />
              )}
            </div>
          </div>
        </section>

        <section className="flex w-full max-w-sm flex-col gap-5">
          <h1 className="flex items-baseline gap-2 text-lg font-bold">
            빈 카드
            <span className="font-mono text-xs font-normal text-zinc-500">v{version}</span>
          </h1>

          {status !== "playing" ? (
            <BlankCardScoreBoard
              key={`${answer.id}-${status}`}
              solved={status === "won"}
              answerName={answer.name}
              lines={lines}
              total={totalScore(lines)}
              iconFor={lineIcon}
              salt={salt}
            />
          ) : (
            <>
              <HintRoulette
                options={hintOptions}
                answer={Object.fromEntries(HINT_KEYS.map((key) => [key, hintValue(answer, key)])) as Record<HintKey, string>}
                revealed={hints}
                hintsLeft={HINTS - hintsUsed.length}
                disabled={status !== "playing"}
                labels={HINT_LABEL}
                onReveal={revealHint}
              />

              <form ref={formRef} onSubmit={onWordSubmit} className="flex flex-col gap-2">
                <label htmlFor="blank-card-word" className="text-sm text-zinc-400">문구</label>
                <div className="relative flex gap-2">
                  <input
                    id="blank-card-word"
                    ref={wordInputRef}
                    value={word}
                    onChange={(event) => setWord(event.target.value)}
                    onFocus={() => setWordFocus(true)}
                    onBlur={() => setWordFocus(false)}
                    placeholder="아무 말이나 쳐 보세요"
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={Boolean(flight)}
                    className="rounded border border-zinc-600 bg-zinc-800 px-4 text-sm hover:border-zinc-400 disabled:opacity-40"
                  >
                    제안
                  </button>
                  {keywordSuggestions.length > 0 && (
                    // The compendium's keyword entries, title only: as wide as the longest name.
                    <ul className="absolute left-0 top-full z-30 mt-1 inline-flex max-h-72 flex-col items-stretch overflow-y-auto">
                      {keywordSuggestions.map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => submitWord(name)}
                            className="block w-full text-left hover:brightness-125"
                          >
                            <GameHoverTip title={name} compact style={{ paddingRight: 14 }} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {proposals.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 text-sm">
                    {proposals.map((p) => (
                      <li
                        key={p.text}
                        className={`rounded px-2 py-0.5 ${p.hit ? "bg-emerald-900/50 text-emerald-200" : "bg-red-950/60 text-red-300 line-through"}`}
                      >
                        {p.text}
                      </li>
                    ))}
                  </ul>
                )}
              </form>

              <div className="flex flex-col gap-2">
                <label htmlFor="blank-card-guess" className="text-sm text-zinc-400">정답</label>
                <input
                  id="blank-card-guess"
                  value={guessQuery}
                  onChange={(event) => setGuessQuery(event.target.value)}
                  autoComplete="off"
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base outline-none focus:border-amber-400"
                />
                {candidates.length > 0 && (
                  <ul className="flex flex-wrap gap-3 pt-1">
                    {candidates.map(({ card, fits }) => {
                      const guessed = wrongGuesses.includes(card.id);
                      const unplayableCost = !fits && (card.isXCost || card.cost >= 0)
                        ? (
                          <span style={{ color: UNPLAYABLE_COST, ...gameStroke(UNPLAYABLE_COST_OUTLINE, CANDIDATE_WIDTH, 16) }}>
                            {card.isXCost ? "X" : card.cost}
                          </span>
                        )
                        : undefined;
                      return (
                        <li key={card.id}>
                          <button
                            type="button"
                            onClick={() => submitAnswer(card)}
                            disabled={guessed}
                            aria-label={card.name}
                            className={`block rounded-[7px] transition-transform hover:-translate-y-1 ${guessed ? "opacity-30" : ""}`}
                            style={{ boxShadow: fits && !guessed ? PLAYABLE_GLOW : undefined }}
                          >
                            <CardTile
                              card={card}
                              showUpgrade={false}
                              showBeta={false}
                              width={CANDIDATE_WIDTH}
                              interactive={false}
                              costContent={unplayableCost}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {wrongGuesses.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 text-sm">
                    {wrongGuesses.map((id) => (
                      <li key={id} className="rounded bg-red-950/60 px-2 py-0.5 text-red-300 line-through">
                        {cards.find((card) => card.id === id)?.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => newRound()}
            className="self-start rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm hover:border-zinc-400"
          >
            새 판
          </button>

          <details className="rounded border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-400">
            <summary className="cursor-pointer">테스트</summary>
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span>회전</span>
                {SPEEDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSpeed(value)}
                    aria-pressed={speed === value}
                    className={`rounded px-2 py-0.5 ${speed === value ? "bg-amber-500/20 text-amber-200" : "bg-zinc-800 hover:bg-zinc-700"}`}
                  >
                    ×{value}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="blank-card-pick">정답 고르기 · 지금 {answer.name}</label>
                <input
                  id="blank-card-pick"
                  value={pickQuery}
                  onChange={(event) => setPickQuery(event.target.value)}
                  autoComplete="off"
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100 outline-none focus:border-amber-400"
                />
                <ul className="flex flex-wrap gap-1">
                  {searchCards(pickQuery, 12).map((card) => (
                    <li key={card.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPickQuery("");
                          newRound(card);
                        }}
                        className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-200 hover:bg-zinc-700"
                      >
                        {card.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
