"use client";

import { type ReactNode } from "react";

// BBCode tag -> CSS class mapping
const COLOR_CLASSES: Record<string, string> = {
  gold: "spire-gold",
  blue: "spire-blue",
  red: "spire-red",
  green: "spire-green",
  purple: "spire-purple",
  orange: "spire-orange",
  pink: "spire-pink",
  aqua: "spire-aqua",
};

const EFFECT_CLASSES: Record<string, string> = {
  sine: "rich-sine",
  jitter: "rich-jitter",
  b: "font-bold",
  i: "italic",
};

// All recognized tags (color + effect)
const KNOWN_TAGS = new Set([
  ...Object.keys(COLOR_CLASSES),
  ...Object.keys(EFFECT_CLASSES),
]);

interface TextNode {
  type: "text" | "newline" | "tag";
  text?: string;
  tag?: string;
  param?: string;
  children?: TextNode[];
}

// Parse BBCode string into a tree of nodes
function parseBBCode(input: string): TextNode[] {
  const nodes: TextNode[] = [];
  // Match opening tags, closing tags, energy/star icons, newlines, and other BBCode tags
  const regex = /\[(\/?)(\w+)(?::(\w+))?\]|\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const stack: { tag: string; param?: string; children: TextNode[] }[] = [];

  function pushText(text: string) {
    const target = stack.length > 0 ? stack[stack.length - 1].children : nodes;
    if (text) target.push({ type: "text", text });
  }

  function pushNode(node: TextNode) {
    const target = stack.length > 0 ? stack[stack.length - 1].children : nodes;
    target.push(node);
  }

  while ((match = regex.exec(input)) !== null) {
    // Push any text before this match
    if (match.index > lastIndex) {
      pushText(input.slice(lastIndex, match.index));
    }
    lastIndex = match.index + match[0].length;

    if (match[0] === "\n") {
      pushNode({ type: "newline" });
      continue;
    }

    const isClosing = match[1] === "/";
    const tagName = match[2].toLowerCase();
    const tagParam = match[3]; // e.g., "1" from [energy:1]

    // Handle energy/star icons
    if (!isClosing && (tagName === "energy" || tagName === "star") && tagParam) {
      const count = parseInt(tagParam, 10) || 1;
      const icon = tagName === "energy" ? "⚡" : "★";
      pushText(icon.repeat(count));
      continue;
    }

    if (!KNOWN_TAGS.has(tagName)) {
      // Skip unknown tags silently
      continue;
    }

    if (!isClosing) {
      stack.push({ tag: tagName, param: tagParam, children: [] });
    } else {
      // Find matching opening tag
      let found = -1;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tagName) {
          found = i;
          break;
        }
      }
      if (found >= 0) {
        // Close all tags up to and including the matching one
        while (stack.length > found) {
          const item = stack.pop()!;
          const node: TextNode = {
            type: "tag",
            tag: item.tag,
            param: item.param,
            children: item.children,
          };
          pushNode(node);
        }
      }
    }
  }

  // Remaining text
  if (lastIndex < input.length) {
    pushText(input.slice(lastIndex));
  }

  // Close any unclosed tags
  while (stack.length > 0) {
    const item = stack.pop()!;
    const node: TextNode = {
      type: "tag",
      tag: item.tag,
      param: item.param,
      children: item.children,
    };
    const target = stack.length > 0 ? stack[stack.length - 1].children : nodes;
    target.push(node);
  }

  return nodes;
}

// Render parsed nodes to React elements
function renderNodes(nodes: TextNode[], key = ""): ReactNode[] {
  return nodes.map((node, i) => {
    const k = `${key}-${i}`;
    if (node.type === "newline") return <br key={k} />;
    if (node.type === "text") return <span key={k}>{node.text}</span>;
    if (node.type === "tag" && node.tag && node.children) {
      const colorClass = COLOR_CLASSES[node.tag] ?? "";
      const effectClass = EFFECT_CLASSES[node.tag] ?? "";
      const className = [colorClass, effectClass].filter(Boolean).join(" ");
      return (
        <span key={k} className={className || undefined}>
          {renderNodes(node.children, k)}
        </span>
      );
    }
    return null;
  });
}

export interface RichTextProps {
  text: string;
  className?: string;
}

// Render BBCode-formatted text with colors and effects
export function RichText({ text, className }: RichTextProps) {
  const nodes = parseBBCode(text);
  return <span className={className}>{renderNodes(nodes)}</span>;
}

// Export parser for reuse
export { parseBBCode, renderNodes, COLOR_CLASSES, EFFECT_CLASSES, KNOWN_TAGS };
