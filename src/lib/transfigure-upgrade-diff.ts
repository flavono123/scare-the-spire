/**
 * Mark insert-only upgrade diffs with [green]…[/green] for transfigure previews.
 * Deletes are omitted from the upgraded string (game-like plus-only highlight).
 *
 * Uses difflib-style longest contiguous matching blocks so repeated punctuation
 * (e.g. periods) does not cross-align and swallow the first sentence terminator.
 */

const ATOMIC_TAG_RE =
  /^\[gold(?:\s+[^\]]*)?\][\s\S]*?\[\/gold\]|^\[energy:\d+\]|^\[star:\d+\]/i;

function isAtomicBbToken(token: string): boolean {
  return ATOMIC_TAG_RE.test(token);
}

/** Tokenize BBCode so gold/energy/star stay atomic; numbers/words/punct split. */
export function tokenizeTransfigureDescription(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    const slice = input.slice(i);
    const atomic = slice.match(ATOMIC_TAG_RE);
    if (atomic) {
      tokens.push(atomic[0]);
      i += atomic[0].length;
      continue;
    }

    const digits = slice.match(/^\d+/);
    if (digits) {
      tokens.push(digits[0]);
      i += digits[0].length;
      continue;
    }

    const whitespace = slice.match(/^\s+/);
    if (whitespace) {
      tokens.push(whitespace[0]);
      i += whitespace[0].length;
      continue;
    }

    const letters = slice.match(/^[\p{L}\p{M}]+/u);
    if (letters) {
      tokens.push(letters[0]);
      i += letters[0].length;
      continue;
    }

    tokens.push(slice[0]!);
    i += 1;
  }

  return tokens;
}

function findLongestMatch(
  a: string[],
  aLo: number,
  aHi: number,
  b: string[],
  bLo: number,
  bHi: number,
): { aIndex: number; bIndex: number; size: number } {
  let bestI = aLo;
  let bestJ = bLo;
  let bestSize = 0;

  const bIndexes = new Map<string, number[]>();
  for (let j = bLo; j < bHi; j++) {
    const token = b[j]!;
    const list = bIndexes.get(token);
    if (list) list.push(j);
    else bIndexes.set(token, [j]);
  }

  let jMatches = new Map<number, number>();
  for (let i = aLo; i < aHi; i++) {
    const nextJMatches = new Map<number, number>();
    for (const j of bIndexes.get(a[i]!) ?? []) {
      if (j < bLo || j >= bHi) continue;
      const size = (jMatches.get(j - 1) ?? 0) + 1;
      nextJMatches.set(j, size);
      if (size > bestSize) {
        bestI = i - size + 1;
        bestJ = j - size + 1;
        bestSize = size;
      }
    }
    jMatches = nextJMatches;
  }

  return { aIndex: bestI, bIndex: bestJ, size: bestSize };
}

function getMatchingBlocks(
  a: string[],
  b: string[],
): Array<{ a: number; b: number; size: number }> {
  const queue: Array<[number, number, number, number]> = [
    [0, a.length, 0, b.length],
  ];
  const matches: Array<{ a: number; b: number; size: number }> = [];

  while (queue.length > 0) {
    const [aLo, aHi, bLo, bHi] = queue.pop()!;
    const match = findLongestMatch(a, aLo, aHi, b, bLo, bHi);
    if (match.size === 0) continue;
    matches.push({
      a: match.aIndex,
      b: match.bIndex,
      size: match.size,
    });
    if (aLo < match.aIndex && bLo < match.bIndex) {
      queue.push([aLo, match.aIndex, bLo, match.bIndex]);
    }
    const aEnd = match.aIndex + match.size;
    const bEnd = match.bIndex + match.size;
    if (aEnd < aHi && bEnd < bHi) {
      queue.push([aEnd, aHi, bEnd, bHi]);
    }
  }

  matches.sort((left, right) => left.a - right.a || left.b - right.b);
  matches.push({ a: a.length, b: b.length, size: 0 });
  return matches;
}

/**
 * Compare base vs upgraded BBCode descriptions and wrap insert-only spans in
 * `[green]…[/green]`. Atomic gold/energy/star tokens are never wrapped so
 * CardTile can still parse icons and gold keywords.
 */
export function markUpgradePlusGreen(base: string, upgraded: string): string {
  if (upgraded === base) return upgraded;

  const a = tokenizeTransfigureDescription(base);
  const b = tokenizeTransfigureDescription(upgraded);
  const blocks = getMatchingBlocks(a, b);

  let out = "";
  let greenBuf = "";
  let bPos = 0;

  const flushGreen = () => {
    if (!greenBuf) return;
    // Whitespace-only inserts are not meaningful upgrade highlights.
    out += /^\s*$/.test(greenBuf) ? greenBuf : `[green]${greenBuf}[/green]`;
    greenBuf = "";
  };

  for (const block of blocks) {
    while (bPos < block.b) {
      const token = b[bPos]!;
      bPos += 1;
      if (isAtomicBbToken(token)) {
        flushGreen();
        out += token;
      } else {
        greenBuf += token;
      }
    }
    flushGreen();
    for (let k = 0; k < block.size; k++) {
      out += b[bPos]!;
      bPos += 1;
    }
  }

  flushGreen();
  return out;
}
