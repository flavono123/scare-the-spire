"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "@/components/ui/static-image";
import { Sts1MentionHover } from "./mention-hover";
import { sts1CardUiUrl } from "@/lib/sts1/paths";
import { matchSts1Name, parseSts1Pieces, type Sts1Piece, type Sts1Word } from "@/lib/sts1/smart-words";
import type { Sts1EntityRefs, Sts1RefType, Sts1TextTemplate, Sts1VarTier, Sts1VarValue } from "@/lib/sts1/types";

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

function renderWord(word: Sts1Word, key: number, sine: { next: number }): ReactNode {
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

function renderPiece(piece: Sts1Piece, key: number, sine: { next: number }): ReactNode {
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
  const pieces = parseSts1Pieces(text);
  const nodes: ReactNode[] = [];
  const sine = { next: 0 };
  for (let index = 0; index < pieces.length; index++) {
    const match = names.size ? matchSts1Name(pieces, index, (name) => names.get(name)) : null;
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
        <span className={(pieces[index] as { word: Sts1Word }).word.color ? undefined : "text-[#efc851]"}>
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
