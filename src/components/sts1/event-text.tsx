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

/**
 * GenericEventDialog / FontHelper.renderSmartText: words split on spaces, `NL`
 * breaks, `#x` colors the word, `~word~` waves and `@word@` shakes, `[E]` orbs.
 * Gold words that name a card, relic, power or monster on this page link to it.
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
  const nodes: ReactNode[] = [];
  let sine = 0;
  // NL is its own word; "ONLINE" or "UNLOCK" keep theirs.
  const tokens = text.replace(/(?:^|\s+)NL(?=\s|$)\s*/g, " \n ").split(/( +)/);
  tokens.forEach((token, index) => {
    if (token === "\n") {
      nodes.push(<br key={index} />);
      return;
    }
    if (!token) return;
    if (/^ +$/.test(token)) {
      nodes.push(" ");
      return;
    }
    if (token === "TAB") {
      nodes.push(<span key={index} className="inline-block w-6" />);
      return;
    }
    const energy = /^\[([RGBWE])\]([.,!?]*)$/.exec(token);
    if (energy) {
      nodes.push(
        <Image
          key={index}
          src={sts1CardUiUrl(ENERGY[energy[1]])}
          alt=""
          width={24}
          height={24}
          className="mx-px inline-block h-[1.1em] w-[1.1em] align-[-0.2em] object-contain"
        />,
        energy[2],
      );
      return;
    }
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
    let content: ReactNode = word.text;
    if (word.effect === "wave") {
      content = Array.from(word.text).map((char, charIndex) => (
        <span key={charIndex} className="rich-sine-letter" style={{ "--rich-sine-index": sine++ } as CSSProperties}>
          {char}
        </span>
      ));
    } else if (word.effect === "shake") {
      content = <span className="rich-jitter">{word.text}</span>;
    }
    const bare = word.text.replace(/[.,!?…:;'"()]+$/, "");
    const linked = word.color === COLORS.y ? names.get(bare) : undefined;
    if (linked) {
      nodes.push(
        <Sts1MentionHover
          key={index}
          entityId={`sts1:${RESOURCE[linked.type]}:${linked.slug}`}
          text={linked.name}
          className="relative inline cursor-help"
          linkClassName="no-underline hover:brightness-125"
        >
          <span style={{ color: word.color }}>{content}</span>
        </Sts1MentionHover>,
      );
      return;
    }
    nodes.push(
      <span key={index} style={word.color ? { color: word.color } : undefined}>
        {content}
      </span>,
    );
  });
  return (
    <span className={className} style={style} {...rest}>
      {nodes}
    </span>
  );
}
