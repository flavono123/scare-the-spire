"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "@/components/ui/static-image";
import { Sts1MentionHover } from "./mention-hover";
import { sts1CardUiUrl } from "@/lib/sts1/paths";
import type { Sts1EntityRefs, Sts1RefType, Sts1TextTemplate, Sts1VarTier, Sts1VarValue } from "@/lib/sts1/types";

/** FontHelper colors: #r #g #b #y #p. */
const COLORS: Record<string, string> = {
  r: "#ff6563",
  g: "#7fff00",
  b: "#87ceeb",
  y: "#efc851",
  p: "#ee82ee",
};

const ENERGY: Record<string, string> = {
  R: "card_red_orb",
  G: "card_green_orb",
  B: "card_blue_orb",
  W: "card_purple_orb",
  E: "card_colorless_orb",
};

const RESOURCE: Record<Sts1RefType, string> = {
  card: "cards",
  relic: "relics",
  potion: "potions",
  monster: "monsters",
  power: "powers",
  blight: "blights",
  keyword: "keywords",
  modifier: "modifiers",
};

export function formatSts1Var(value: Sts1VarValue): string {
  if (typeof value === "number") return String(value);
  if ("list" in value) return value.list.join("/");
  if ("min" in value) return value.min === value.max ? String(value.min) : `${value.min}~${value.max}`;
  if (value.frac) return `${value.frac[0]}/${value.frac[1]}`;
  return `${value.pct ?? 0}%`;
}

export function sts1VarAt(tiers: readonly Sts1VarTier[] | undefined, ascension: number): Sts1VarValue | null {
  if (!tiers?.length) return null;
  let current = tiers[0];
  for (const tier of tiers) if (tier.ascension <= ascension) current = tier;
  return current.value;
}

/** Joins a template's parts with each var formatted for this ascension. */
export function fillSts1Template(
  template: Sts1TextTemplate,
  vars: Record<string, Sts1VarTier[]>,
  ascension: number,
): string {
  return template.map((part) => {
    if (typeof part === "string") return part;
    const value = sts1VarAt(vars[part.v], ascension);
    return value == null ? "?" : formatSts1Var(value);
  }).join("");
}

function nameIndex(refs: Sts1EntityRefs | undefined): Map<string, { type: Sts1RefType; slug: string; name: string }> {
  const index = new Map<string, { type: Sts1RefType; slug: string; name: string }>();
  if (!refs) return index;
  for (const type of Object.keys(RESOURCE) as Sts1RefType[]) {
    for (const ref of Object.values(refs[type] ?? {})) index.set(ref.name, { type, slug: ref.slug, name: ref.name });
  }
  return index;
}

type Word = { text: string; color?: string; effect?: "wave" | "shake" };
type Piece =
  | { kind: "br" | "space" | "tab" }
  | { kind: "energy"; orb: string; tail: string }
  | { kind: "word"; word: Word };

// Korean particles a name can carry in game text ("긍지를", "광신자들에게").
const PARTICLE = /(?:으로|에게|에서|이나|들에게|들|을|를|이|가|은|는|의|에|로|와|과|도|만)$/;
const TRAILING = /[.,!?…:;'"()\]\[]+$/;

function parseWord(token: string): Word {
  const word: Word = { text: token };
  const color = /^#([rgbyp])/.exec(word.text);
  if (color) {
    word.color = COLORS[color[1]];
    word.text = word.text.slice(2);
  }
  const wave = /^~(.*)~([.,!?…]*)$/.exec(word.text);
  const shake = /^@(.*)@([.,!?…]*)$/.exec(word.text);
  if (wave) {
    word.effect = "wave";
    word.text = wave[1] + wave[2];
  } else if (shake) {
    word.effect = "shake";
    word.text = shake[1] + shake[2];
  }
  return word;
}

function parsePieces(text: string): Piece[] {
  // NL is its own word ("NL NL" is two breaks); "ONLINE" or "UNLOCK" keep theirs.
  const tokens = text.replace(/(?<=^|\s)NL(?=\s|$)/g, "\n").split(/( +|\n)/);
  const pieces: Piece[] = [];
  for (const token of tokens) {
    if (!token) continue;
    if (token === "\n") pieces.push({ kind: "br" });
    else if (/^ +$/.test(token)) pieces.push({ kind: "space" });
    else if (token === "TAB") pieces.push({ kind: "tab" });
    else {
      const energy = /^\[([RGBWE])\]([.,!?]*)$/.exec(token);
      pieces.push(energy ? { kind: "energy", orb: ENERGY[energy[1]], tail: energy[2] } : { kind: "word", word: parseWord(token) });
    }
  }
  return pieces;
}

/** A name over 1-4 same-colored words starting at `start`, allowing a trailing particle. */
function matchName(
  pieces: readonly Piece[],
  start: number,
  names: Map<string, { type: Sts1RefType; slug: string; name: string }>,
): { end: number; ref: { type: Sts1RefType; slug: string; name: string } } | null {
  const first = pieces[start];
  if (first.kind !== "word" || first.word.effect) return null;
  const words: { text: string; at: number }[] = [];
  for (let at = start; at < pieces.length && words.length < 4; at++) {
    const piece = pieces[at];
    if (piece.kind === "space") continue;
    if (piece.kind !== "word" || piece.word.color !== first.word.color || piece.word.effect) break;
    words.push({ text: piece.word.text, at });
  }
  for (let count = words.length; count > 0; count--) {
    const joined = words.slice(0, count).map((word) => word.text).join(" ").replace(TRAILING, "");
    const ref = names.get(joined) ?? names.get(joined.replace(PARTICLE, ""));
    if (ref) return { end: words[count - 1].at, ref };
  }
  return null;
}

function renderWord(word: Word, key: number, sine: { next: number }): ReactNode {
  let content: ReactNode = word.text;
  if (word.effect === "wave") {
    content = Array.from(word.text).map((char, charIndex) => (
      <span key={charIndex} className="rich-sine-letter" style={{ "--rich-sine-index": sine.next++ } as CSSProperties}>
        {char}
      </span>
    ));
  } else if (word.effect === "shake") {
    content = <span className="rich-jitter">{word.text}</span>;
  }
  return <span key={key} style={word.color ? { color: word.color } : undefined}>{content}</span>;
}

function renderPiece(piece: Piece, key: number, sine: { next: number }): ReactNode {
  if (piece.kind === "br") return <br key={key} />;
  if (piece.kind === "space") return " ";
  if (piece.kind === "tab") return <span key={key} className="inline-block w-6" />;
  if (piece.kind === "energy") {
    return (
      <span key={key}>
        <Image
          src={sts1CardUiUrl(piece.orb)}
          alt=""
          width={24}
          height={24}
          className="mx-px inline-block h-[1.1em] w-[1.1em] align-[-0.2em] object-contain"
        />
        {piece.tail}
      </span>
    );
  }
  return piece.kind === "word" ? renderWord(piece.word, key, sine) : null;
}

/**
 * GenericEventDialog / FontHelper.renderSmartText: words split on spaces, `NL`
 * breaks, `#x` colors the word, `~word~` waves and `@word@` shakes, `[E]` orbs.
 * Words that name something in `refs` link to it, colored or not, even with a particle.
 */
export function Sts1EventText({
  text,
  refs,
  className,
  style,
  ...rest
}: {
  text: string;
  refs?: Sts1EntityRefs;
  className?: string;
  style?: CSSProperties;
  "data-sts1-event-body"?: string;
}) {
  const names = nameIndex(refs);
  const pieces = parsePieces(text);
  const nodes: ReactNode[] = [];
  const sine = { next: 0 };
  for (let index = 0; index < pieces.length; index++) {
    const match = names.size ? matchName(pieces, index, names) : null;
    if (!match) {
      nodes.push(renderPiece(pieces[index], index, sine));
      continue;
    }
    nodes.push(
      <Sts1MentionHover
        key={index}
        entityId={`sts1:${RESOURCE[match.ref.type]}:${match.ref.slug}`}
        text={match.ref.name}
        className="relative inline cursor-help"
        linkClassName="no-underline hover:brightness-125"
      >
        <span className={(pieces[index] as { word: Word }).word.color ? undefined : "text-[#efc851]"}>
          {pieces.slice(index, match.end + 1).map((piece, offset) => renderPiece(piece, index + offset, sine))}
        </span>
      </Sts1MentionHover>,
    );
    index = match.end;
  }
  return (
    <span className={className} style={style} {...rest}>
      {nodes}
    </span>
  );
}
