import type { JSONContent } from "@tiptap/core";

const EFFECT_TAGS = [
  "gold",
  "green",
  "aqua",
  "orange",
  "red",
  "blue",
  "pink",
  "purple",
  "sine",
  "jitter",
] as const;

type EffectTag = (typeof EFFECT_TAGS)[number];

const EFFECT_TAG_SET = new Set<string>(EFFECT_TAGS);
const COLOR_TAGS = new Set<string>(EFFECT_TAGS.filter((tag) => tag !== "sine" && tag !== "jitter"));

const TAG_PATTERN = /\[(\/?)(gold|green|aqua|orange|red|blue|pink|purple|sine|jitter)\]/g;

type EffectMark = NonNullable<JSONContent["marks"]>[number];

export function textHasEffectTags(text: string): boolean {
  TAG_PATTERN.lastIndex = 0;
  return TAG_PATTERN.test(text);
}

export function wrapTextEffectMarks(
  text: string,
  marks: readonly EffectMark[] | undefined,
): string {
  if (!marks?.length) return text;
  let wrapped = text;
  if (marks.some((mark) => mark.type === "jitter")) {
    wrapped = `[jitter]${wrapped}[/jitter]`;
  }
  if (marks.some((mark) => mark.type === "sine")) {
    wrapped = `[sine]${wrapped}[/sine]`;
  }
  const color = marks.find((mark) => mark.type === "pagestormColor");
  const key = typeof color?.attrs?.colorKey === "string" ? color.attrs.colorKey : "";
  const tag = key.startsWith("spire-") ? key.slice("spire-".length) : "";
  if (COLOR_TAGS.has(tag)) wrapped = `[${tag}]${wrapped}[/${tag}]`;
  return wrapped;
}

function marksFor(stack: EffectTag[]): EffectMark[] {
  const marks: EffectMark[] = [];
  const color = [...stack].reverse().find((tag) => COLOR_TAGS.has(tag));
  if (color) marks.push({ type: "pagestormColor", attrs: { colorKey: `spire-${color}` } });
  if (stack.includes("sine")) marks.push({ type: "sine" });
  if (stack.includes("jitter")) marks.push({ type: "jitter" });
  return marks;
}

export function effectTextToContent(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  const stack: EffectTag[] = [];
  TAG_PATTERN.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  const pushText = (value: string) => {
    if (!value) return;
    const marks = marksFor(stack);
    nodes.push(marks.length > 0 ? { type: "text", text: value, marks } : { type: "text", text: value });
  };

  while ((match = TAG_PATTERN.exec(text)) !== null) {
    pushText(text.slice(cursor, match.index));
    const closing = match[1] === "/";
    const tag = match[2] as EffectTag;
    if (closing) {
      const index = stack.lastIndexOf(tag);
      if (index >= 0) stack.splice(index, 1);
    } else if (EFFECT_TAG_SET.has(tag)) {
      stack.push(tag);
    }
    cursor = match.index + match[0].length;
  }
  pushText(text.slice(cursor));
  return nodes;
}
