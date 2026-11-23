/** FontHelper smart text split into words: colors, wave/shake effects, energy orbs, breaks. */

/** FontHelper colors: #r #g #b #y #p. */
export const STS1_TEXT_COLORS: Record<string, string> = {
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

export type Sts1Word = { text: string; color?: string; effect?: "wave" | "shake" };
export type Sts1Piece =
  | { kind: "br" | "space" | "tab" }
  | { kind: "energy"; orb: string; tail: string }
  | { kind: "word"; word: Sts1Word };

// Korean particles a name can carry in game text ("긍지를", "광신자들에게").
const PARTICLE = /(?:으로|에게|에서|이나|들에게|들|을|를|이|가|은|는|의|에|로|와|과|도|만)$/;
// "+" marks an upgraded card ("#y단도+").
const TRAILING = /[.,!?…:;'"()\]\[+]+$/;

function parseWord(token: string): Sts1Word {
  const word: Sts1Word = { text: token };
  const color = /^#([rgbyp])/.exec(word.text);
  if (color) {
    word.color = STS1_TEXT_COLORS[color[1]];
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

export function parseSts1Pieces(text: string): Sts1Piece[] {
  // NL is its own word ("NL NL" is two breaks); "ONLINE" or "UNLOCK" keep theirs.
  const tokens = text.replace(/(?<=^|\s)NL(?=\s|$)/g, "\n").split(/( +|\n)/);
  const pieces: Sts1Piece[] = [];
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
export function matchSts1Name<T>(
  pieces: readonly Sts1Piece[],
  start: number,
  lookup: (name: string) => T | undefined,
  { coloredOnly = false }: { coloredOnly?: boolean } = {},
): { end: number; ref: T } | null {
  const first = pieces[start];
  if (first.kind !== "word" || first.word.effect || (coloredOnly && !first.word.color)) return null;
  const words: { text: string; at: number }[] = [];
  for (let at = start; at < pieces.length && words.length < 4; at++) {
    const piece = pieces[at];
    if (piece.kind === "space") continue;
    if (piece.kind !== "word" || piece.word.color !== first.word.color || piece.word.effect) break;
    words.push({ text: piece.word.text, at });
  }
  for (let count = words.length; count > 0; count--) {
    const joined = words.slice(0, count).map((word) => word.text).join(" ").replace(TRAILING, "");
    const ref = lookup(joined) ?? lookup(joined.replace(PARTICLE, ""));
    if (ref) return { end: words[count - 1].at, ref };
  }
  return null;
}

