/**
 * Vakuu's backseat remarks, after the Workshop mod "Chatty Vakuu's Earring" (snoe1024):
 * detectors propose utterances, and one speaker decides whether to say them.
 * The etiquette and timing numbers are that mod's VakuuSpeaker and SpeechDuration;
 * the lines are the game's own Vakuu lines plus this site's.
 */

export type VakuuUtterance = {
  /** Lines to pick from; Vakuu avoids ones he said recently. */
  lines: string[];
  /** Topics; a remark on the same topic waits SAME_TAG_WINDOW_MS. */
  tags: string[];
  /** Chance to speak once the etiquette passes. */
  probability: number;
  /** Skips the etiquette, for results the player waits on. */
  force?: boolean;
  vars?: Record<string, number>;
};

/** Shortest gap between remarks that are not forced. */
const MIN_INTERVAL_MS = 2500;
/** A remark sharing a tag with the last one waits this long. */
const SAME_TAG_WINDOW_MS = 6000;
/** Lines remembered to avoid repeating. */
const REPEAT_MEMORY = 6;
/** TalkCmd: 0.12 s per character; CJK text reads 1.5 times slower per character. */
const SECONDS_PER_CHAR = 0.12;
const CJK_MULTIPLIER = 1.5;
const MIN_SECONDS = 1.5;
const CJK_PATTERN = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-鿿가-힯]/;

type SpokenRecord = { line: string; tags: string[]; at: number };

export class VakuuSpeaker {
  private recent: SpokenRecord[] = [];

  /** The line to say now, or null to stay quiet. */
  pick(utterance: VakuuUtterance, now: number): string | null {
    const fresh = utterance.lines.filter((line) => line && !this.recent.some((record) => record.line === line));
    const pool = fresh.length > 0 ? fresh : utterance.lines.filter(Boolean);
    if (pool.length === 0) return null;
    if (!utterance.force && !this.passesEtiquette(utterance, fresh.length > 0, now)) return null;
    const line = pool[Math.floor(Math.random() * pool.length)];
    this.recent.push({ line, tags: utterance.tags, at: now });
    if (this.recent.length > REPEAT_MEMORY) this.recent.shift();
    return formatVakuuLine(line, utterance.vars ?? {});
  }

  private passesEtiquette(utterance: VakuuUtterance, hasFreshLine: boolean, now: number): boolean {
    const last = this.recent.at(-1);
    if (last) {
      const sinceLast = now - last.at;
      if (sinceLast < MIN_INTERVAL_MS) return false;
      if (sinceLast < SAME_TAG_WINDOW_MS && utterance.tags.some((tag) => last.tags.includes(tag))) return false;
      if (!hasFreshLine) return false;
    }
    return Math.random() < utterance.probability;
  }
}

/** SmartFormat as the game localizes Vakuu: {Visits} and {Visits:plural:time|times}. */
export function formatVakuuLine(line: string, vars: Record<string, number>): string {
  return line
    .replace(/\{(\w+):plural:([^|}]*)\|([^}]*)\}/g, (match, name: string, one: string, other: string) => (
      name in vars ? (vars[name] === 1 ? one : other) : match
    ))
    .replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Vakuu speaks through the earring in shaking red unless the line already says how. */
export function styleVakuuLine(line: string): string {
  return /\[(red|shake)\]/.test(line) ? line : `[red][shake]${line}[/shake][/red]`;
}

export function vakuuSpeechMs(line: string): number {
  const text = line.replace(/\[\/?[^\]]+\]/g, "").replace(/\s/g, "");
  const perChar = SECONDS_PER_CHAR * (CJK_PATTERN.test(text) ? CJK_MULTIPLIER : 1);
  return Math.max(MIN_SECONDS, text.length * perChar) * 1000;
}
