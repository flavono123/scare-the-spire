import type { JSONContent } from "@tiptap/core";

const MARKDOWN_LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
const LIST_LINE_RE = /^([ \t]*)(?:([-+*])|(\d+)[.)])[ \t]+(.*)$/;

export type MarkdownLinkMatch = {
  fromOffset: number;
  label: string;
  href: string;
};

const LINK_MARK = {
  type: "link",
  attrs: {
    target: "_blank",
    rel: "noopener noreferrer",
  },
} as const;

export function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export function markdownLinkBeforeCursor(
  textBefore: string,
  inserted: string,
): MarkdownLinkMatch | null {
  const match = `${textBefore}${inserted}`.match(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/);
  if (!match) return null;
  return {
    fromOffset: match[0].length - inserted.length,
    label: match[1],
    href: match[2],
  };
}

function inlineContent(text: string): JSONContent[] {
  const parts: JSONContent[] = [];
  const pattern = new RegExp(MARKDOWN_LINK_RE.source, "g");
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push({ type: "text", text: text.slice(cursor, index) });
    }
    parts.push({
      type: "text",
      text: match[1],
      marks: [{ ...LINK_MARK, attrs: { ...LINK_MARK.attrs, href: match[2] } }],
    });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) parts.push({ type: "text", text: text.slice(cursor) });
  return parts;
}

const OPENING_FENCE_RE = /^```([A-Za-z0-9_+-]*)?[ \t]*$/;

export function openingCodeFence(text: string): { language: string } | null {
  const match = text.match(OPENING_FENCE_RE);
  if (!match) return null;
  return { language: match[1] ?? "" };
}

function codeBlockNode(language: string, text: string): JSONContent {
  const node: JSONContent = {
    type: "codeBlock",
    attrs: { language: language || null },
  };
  if (text.length > 0) node.content = [{ type: "text", text }];
  return node;
}

function paragraphFromLine(line: string): JSONContent {
  const content = inlineContent(line);
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

type ListLine = {
  depth: number;
  ordered: boolean;
  text: string;
  start?: number;
};

function listLines(raw: string): ListLine[] | null {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const items: ListLine[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(LIST_LINE_RE);
    if (!match) return null;
    const indent = match[1].replace(/\t/g, "  ").length;
    items.push({
      depth: Math.floor(indent / 2),
      ordered: Boolean(match[3]),
      text: match[4],
      start: match[3] ? Number(match[3]) : undefined,
    });
  }
  return items.length > 0 ? items : null;
}

function listShell(ordered: boolean, start?: number): JSONContent {
  return ordered
    ? { type: "orderedList", attrs: { start: start && start > 1 ? start : 1 }, content: [] }
    : { type: "bulletList", content: [] };
}

function listItem(text: string): JSONContent {
  return {
    type: "listItem",
    content: [paragraphFromLine(text)],
  };
}

export function parseIndentedList(raw: string): JSONContent | null {
  const items = listLines(raw.trim());
  if (!items) return null;
  const root = listShell(items[0].ordered, items[0].start);
  const stack: Array<{ list: JSONContent; depth: number }> = [{ list: root, depth: 0 }];
  let lastDepth = 0;
  for (const item of items) {
    const depth = Math.min(Math.max(0, item.depth), lastDepth + 1);
    while (stack.length > 1 && stack[stack.length - 1].depth > depth) stack.pop();
    let frame = stack[stack.length - 1];
    if (frame.depth < depth) {
      const parentItems = frame.list.content ?? [];
      const parentItem = parentItems[parentItems.length - 1];
      if (!parentItem) continue;
      const nested = listShell(item.ordered, item.start);
      parentItem.content = [...(parentItem.content ?? []), nested];
      stack.push({ list: nested, depth });
      frame = stack[stack.length - 1];
    }
    frame.list.content = [...(frame.list.content ?? []), listItem(item.text)];
    lastDepth = depth;
  }
  return root;
}

/** Markdown ``` fences become code blocks. Surrounding lines stay paragraphs. */
export function parseFencedCodeBlocks(raw: string): JSONContent[] | null {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  if (!lines.some((line) => OPENING_FENCE_RE.test(line.trim()))) return null;
  const blocks: JSONContent[] = [];
  const prose: string[] = [];
  let fence: { language: string } | null = null;
  const code: string[] = [];

  const flushProse = () => {
    const text = prose.join("\n").trim();
    prose.length = 0;
    if (!text) return;
    for (const line of text.split("\n")) {
      if (line.trim()) blocks.push(paragraphFromLine(line));
    }
  };
  const flushCode = () => {
    const text = code.join("\n").replace(/\n$/, "");
    code.length = 0;
    blocks.push(codeBlockNode(fence?.language ?? "", text));
    fence = null;
  };

  for (const line of lines) {
    if (!fence) {
      const opening = openingCodeFence(line.trim());
      if (opening) {
        flushProse();
        fence = opening;
        continue;
      }
      prose.push(line);
      continue;
    }
    if (line.trim() === "```") {
      flushCode();
      continue;
    }
    code.push(line);
  }
  if (fence) flushCode();
  else flushProse();
  return blocks.length > 0 ? blocks : null;
}

export function pagestormPasteContent(raw: string): JSONContent[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fenced = parseFencedCodeBlocks(trimmed);
  if (fenced) return fenced;
  const list = parseIndentedList(trimmed);
  if (list) return [list];
  if (!/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/.test(trimmed)) return null;
  return trimmed
    .split(/\n/)
    .filter((line) => line.trim().length > 0)
    .map(paragraphFromLine);
}

function linkParagraph(attrs: JSONContent["attrs"]): JSONContent {
  const href = String(attrs?.url ?? "");
  const label = String(attrs?.title ?? "").trim() || href;
  const align = attrs?.align === "center" || attrs?.align === "right" ? attrs.align : "left";
  return {
    type: "paragraph",
    attrs: { textAlign: align },
    content: label
      ? [{
        type: "text",
        text: label,
        marks: [{ ...LINK_MARK, attrs: { ...LINK_MARK.attrs, href } }],
      }]
      : [],
  };
}

function migrateNode(node: JSONContent): JSONContent[] {
  if (node.type === "ogBookmark") return [linkParagraph(node.attrs)];
  if (node.type === "paragraph" || node.type === "heading" || node.type === "detailsSummary") {
    return [node];
  }
  if (node.type === "assetRow") {
    const embeds: JSONContent[] = [];
    const links: JSONContent[] = [];
    for (const child of node.content ?? []) {
      if (child.type === "ogBookmark") links.push(linkParagraph(child.attrs));
      else embeds.push(child);
    }
    const out: JSONContent[] = [];
    if (embeds.length === 1) out.push(embeds[0]);
    else if (embeds.length > 1) out.push({ ...node, content: embeds });
    out.push(...links);
    return out;
  }
  if (!node.content) return [node];
  return [{ ...node, content: node.content.flatMap(migrateNode) }];
}

export function migratePagestormDoc(doc: JSONContent): JSONContent {
  const content = (doc.content ?? []).flatMap(migrateNode);
  return {
    ...doc,
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}
