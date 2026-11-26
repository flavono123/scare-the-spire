"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CardTile } from "@/components/codex/card-tile";
import type { CodexCard } from "@/lib/codex-types";
import {
  HINTS,
  HINT_KEYS,
  LIVES,
  SCORE,
  cardText,
  conflicts,
  hintValue,
  matchProposal,
  normalizeProposal,
  roundScore,
  type CardText,
  type ConflictReason,
  type HintKey,
} from "@/lib/blank-card";

// Near-black grayscale: darker than any game frame (curse frames sit at v=0.55), so a ghost never reads as a real value.
const GHOST_FILTER = "grayscale(1) brightness(0.3)";
const GHOST_TEXT = "#5b5b5b";
const GHOST_STROKE = "#151515";
const ROTATE_MS = 700;
const CARD_WIDTH = 300;
const HIDDEN_RUN = { color: "transparent", textShadow: "none" } as const;

const HINT_LABEL: Record<HintKey, string> = { cost: "비용", color: "캐릭터", rarity: "희귀도", type: "유형" };
const REASON_LABEL: Record<ConflictReason, string> = { ...HINT_LABEL, text: "문구", guessed: "지목함" };
const VALUE_ORDER: Record<HintKey, string[]> = {
  cost: ["0", "1", "2", "3", "4", "5", "6", "9", "12", "X", ""],
  color: ["ironclad", "silent", "defect", "necrobinder", "regent", "fool", "colorless", "curse", "token"],
  rarity: ["기본", "일반", "고급", "희귀", "토큰", "상태이상", "저주"],
  type: ["공격", "스킬", "파워", "상태이상", "저주"],
};
const ROTATE_OFFSET: Record<HintKey, number> = { cost: 0, color: 3, rarity: 5, type: 1 };

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

export default function BlankCardGame({
  cards,
  keywordNames,
  colorLabels,
  initialCardId,
}: {
  cards: CodexCard[];
  keywordNames: string[];
  colorLabels: Record<string, string>;
  initialCardId?: string;
}) {
  const texts = useMemo(() => new Map(cards.map((card) => [card.id, cardText(card)])), [cards]);
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
  const suggestions = useMemo(
    () => keywordNames.filter((name) => cards.some((card) => matchProposal(texts.get(card.id)!, name).length > 0)),
    [cards, keywordNames, texts],
  );

  const [answer, setAnswer] = useState<CodexCard>(() => pickAnswer(cards, initialCardId));
  const [hints, setHints] = useState<Partial<Record<HintKey, string>>>({});
  const [lives, setLives] = useState(LIVES);
  const [actions, setActions] = useState(0);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [landed, setLanded] = useState<Set<number>>(() => new Set());
  const [flight, setFlight] = useState<Flight | null>(null);
  const [status, setStatus] = useState<Status>("playing");
  const [tick, setTick] = useState(0);
  const [word, setWord] = useState("");
  const [shake, setShake] = useState(false);
  const [guessQuery, setGuessQuery] = useState("");

  const cardRef = useRef<HTMLDivElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const flightCounter = useRef(0);
  const clones = useRef<HTMLElement[]>([]);

  const text = texts.get(answer.id)!;
  const slotStarts = useMemo(() => new Map(text.slots.map((slot) => [slot.slot, slot.start])), [text]);
  const hintsUsed = Object.keys(hints).length;
  const livesLost = LIVES - lives;

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [status]);

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
    if (!from || nodes.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
    if (lives - 1 <= 0) setStatus("lost");
  };

  const flash = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 420);
  };

  const submitWord = (event: FormEvent) => {
    event.preventDefault();
    const proposal = normalizeProposal(word);
    if (status !== "playing" || flight || !proposal) return;
    if (proposals.some((p) => p.text === proposal)) {
      flash();
      return;
    }
    setActions((value) => value + 1);
    const hits = matchProposal(text, proposal);
    setProposals((current) => [...current, { text: proposal, hit: hits.length > 0 }]);
    setWord("");
    if (hits.length === 0) {
      flash();
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

  const guess = (card: CodexCard) => {
    if (status !== "playing" || wrongGuesses.includes(card.id)) return;
    setActions((value) => value + 1);
    setGuessQuery("");
    if (card.id === answer.id) {
      setStatus("won");
      return;
    }
    setWrongGuesses((current) => [...current, card.id]);
    loseLife();
  };

  const takeHint = (key: HintKey) => {
    if (status !== "playing" || hints[key] !== undefined || hintsUsed >= HINTS) return;
    setHints((current) => ({ ...current, [key]: hintValue(answer, key) }));
  };

  const newRound = () => {
    clearClones();
    setAnswer(pickAnswer(cards));
    setHints({});
    setLives(LIVES);
    setActions(0);
    setProposals([]);
    setWrongGuesses([]);
    setRevealed(new Set());
    setLanded(new Set());
    setFlight(null);
    setStatus("playing");
    setWord("");
    setGuessQuery("");
  };

  const valueOf = (key: HintKey) =>
    hints[key] ?? rotation[key][(tick + ROTATE_OFFSET[key]) % rotation[key].length];
  const valueLabel = (key: HintKey, value: string) => {
    if (key === "color") return colorLabels[value] ?? value;
    if (key === "rarity") return labels.rarityLabels.get(value) ?? value;
    if (key === "type") return labels.typeLabels.get(value) ?? value;
    return value === "" ? "없음" : value;
  };

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

  const query = normalizeProposal(guessQuery).toLowerCase();
  const candidates = query
    ? cards
      .filter((card) => card.name.toLowerCase().includes(query) || card.nameEn.toLowerCase().includes(query))
      .map((card) => ({ card, reasons: conflicts(card, texts.get(card.id) as CardText, known) }))
      .sort((left, right) => Number(left.reasons.length > 0) - Number(right.reasons.length > 0))
      .slice(0, 8)
    : [];

  const finalScore = roundScore({ solved: status === "won", hints: hintsUsed, actions, livesLost });

  return (
    <main className="min-h-screen bg-[#0c0d11] px-4 py-6 text-zinc-100">
      <style>{`
        @keyframes blank-card-land { 0% { text-shadow: 0 0 14px #ffe08a, 0 0 4px #fff; } 100% { text-shadow: inherit; } }
        .blank-card-landed { animation: blank-card-land 900ms ease-out; }
        @keyframes blank-card-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-6px); } 40%,80% { transform: translateX(6px); } }
        .blank-card-shake { animation: blank-card-shake 420ms ease-in-out; }
      `}</style>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 md:flex-row md:items-start md:justify-center">
        <section className="flex flex-col items-center gap-3">
          <div className="flex w-full items-center justify-between text-sm">
            <span aria-label={`라이프 ${lives}`} className="text-lg tracking-widest text-red-500">
              {"♥".repeat(Math.max(0, lives))}
              <span className="text-zinc-700">{"♥".repeat(livesLost)}</span>
            </span>
            <span className="text-zinc-400">행동 {actions}</span>
          </div>
          {/* A lighter table keeps the near-black ghost readable. */}
          <div
            ref={cardRef}
            className="rounded-2xl px-8 py-6"
            style={{ background: "radial-gradient(circle at 50% 40%, #4a4f5c 0%, #262a33 75%)" }}
          >
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
        </section>

        <section className="flex w-full max-w-sm flex-col gap-5">
          <h1 className="text-lg font-bold">빈 카드 <span className="text-xs font-normal text-zinc-500">DEV</span></h1>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm text-zinc-400">
              <span>힌트</span>
              <span>{HINTS - hintsUsed} / {HINTS} · 개당 −{SCORE.hint}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {HINT_KEYS.map((key) => {
                const used = hints[key] !== undefined;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => takeHint(key)}
                    disabled={status !== "playing" || used || hintsUsed >= HINTS}
                    className={`rounded border px-3 py-2 text-sm ${
                      used
                        ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                        : "border-zinc-700 bg-zinc-900 hover:border-zinc-500 disabled:opacity-40"
                    }`}
                  >
                    {HINT_LABEL[key]}{used ? ` · ${valueLabel(key, hints[key]!)}` : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={submitWord} className="flex flex-col gap-2">
            <label htmlFor="blank-card-word" className="text-sm text-zinc-400">문구</label>
            <div className={`flex gap-2 ${shake ? "blank-card-shake" : ""}`}>
              <input
                id="blank-card-word"
                ref={wordInputRef}
                value={word}
                onChange={(event) => setWord(event.target.value)}
                list="blank-card-keywords"
                autoComplete="off"
                disabled={status !== "playing"}
                className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={status !== "playing" || Boolean(flight)}
                className="rounded border border-zinc-600 bg-zinc-800 px-4 text-sm hover:border-zinc-400 disabled:opacity-40"
              >
                제안
              </button>
            </div>
            <datalist id="blank-card-keywords">
              {suggestions.map((name) => <option key={name} value={name} />)}
            </datalist>
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
            <label htmlFor="blank-card-guess" className="text-sm text-zinc-400">카드 지목</label>
            <input
              id="blank-card-guess"
              value={guessQuery}
              onChange={(event) => setGuessQuery(event.target.value)}
              autoComplete="off"
              disabled={status !== "playing"}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base outline-none focus:border-amber-400"
            />
            {candidates.length > 0 && (
              <ul className="flex flex-col overflow-hidden rounded border border-zinc-800">
                {candidates.map(({ card, reasons }) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      onClick={() => guess(card)}
                      disabled={reasons.includes("guessed")}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                        reasons.length > 0 ? "bg-red-950/40 text-red-200/70 hover:bg-red-950/70" : "bg-zinc-900 hover:bg-zinc-800"
                      }`}
                    >
                      <span>{card.name}</span>
                      {reasons.length > 0 && (
                        <span className="flex gap-1">
                          {reasons.map((reason) => (
                            <span key={reason} className="rounded bg-red-900/60 px-1.5 text-[11px] text-red-200">
                              {REASON_LABEL[reason]}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
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

          {status !== "playing" && (
            <div className="rounded border border-zinc-700 bg-zinc-900 p-4 text-sm">
              <p className="text-base font-bold">
                {status === "won" ? (actions === 1 && hintsUsed === 0 ? "홀인원" : "정답") : "실패"} · {answer.name}
              </p>
              <p className="mt-1 text-2xl font-black text-amber-300">{finalScore}</p>
              <p className="mt-1 text-zinc-400">
                행동 {actions} · 힌트 {hintsUsed} · 잃은 라이프 {livesLost}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={newRound}
              className="rounded border border-zinc-600 bg-zinc-800 px-4 py-2 hover:border-zinc-400"
            >
              새 판
            </button>
            <details className="text-zinc-500">
              <summary className="cursor-pointer">정답</summary>
              <span>{answer.name} ({answer.id})</span>
            </details>
          </div>
        </section>
      </div>
    </main>
  );
}
