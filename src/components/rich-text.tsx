"use client";

import { type CSSProperties, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import {
  resolveSts2EnergyIcon,
  type Sts2EnergyIconVariant,
} from "@/lib/sts2-energy-icons";

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
  rainbow: "rich-rainbow",
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

type SineOffset = { current: number };

function renderSineText(text: string, keyPrefix: string, offset: SineOffset): ReactNode[] {
  return Array.from(text).map((char, i) => {
    const index = offset.current++;
    return (
      <span
        key={`${keyPrefix}-sine-${i}`}
        className="rich-sine-letter"
        style={{ "--rich-sine-index": index } as CSSProperties}
      >
        {char}
      </span>
    );
  });
}

interface RenderOptions {
  energyIconVariant: Sts2EnergyIconVariant;
}

function renderEnergyIcons(
  count: number,
  keyPrefix: string,
  energyIconVariant: Sts2EnergyIconVariant,
): ReactNode {
  const src = resolveSts2EnergyIcon(energyIconVariant);
  return (
    <span className="inline-flex items-baseline gap-0 align-baseline">
      {Array.from({ length: count }, (_, i) => (
        <Image
          key={`${keyPrefix}-energy-${i}`}
          src={src}
          alt=""
          width={16}
          height={16}
          className="inline-block align-text-bottom"
          style={{ width: "1em", height: "1em" }}
          aria-hidden
        />
      ))}
    </span>
  );
}

function renderSineNodes(
  nodes: TextNode[],
  key = "",
  offset: SineOffset = { current: 0 },
  options: RenderOptions,
): ReactNode[] {
  return nodes.map((node, i) => {
    const k = `${key}-${i}`;
    if (node.type === "newline") return <br key={k} />;
    if (node.type === "text") return renderSineText(node.text ?? "", k, offset);
    if (node.type === "tag" && node.tag && node.children) {
      if (node.tag === "energy") {
        return (
          <span key={k}>
            {renderEnergyIcons(parseInt(node.param ?? "1", 10) || 1, k, options.energyIconVariant)}
          </span>
        );
      }
      if (node.tag === "sine") return renderSineNodes(node.children, k, offset, options);
      const colorClass = COLOR_CLASSES[node.tag] ?? "";
      const effectClass = EFFECT_CLASSES[node.tag] ?? "";
      const className = [colorClass, effectClass].filter(Boolean).join(" ");
      return (
        <span key={k} className={className || undefined}>
          {renderSineNodes(node.children, k, offset, options)}
        </span>
      );
    }
    return null;
  });
}

// Parse BBCode string into a tree of nodes
function parseBBCode(input: string): TextNode[] {
  const nodes: TextNode[] = [];
  // Match opening tags, closing tags, energy/star icons, newlines, and other BBCode tags
  const regex = /\[(\/?)(\w+)(?:[:=]([^\]\s]+))?(?:\s+[^\]]*)?\]|\n/g;
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
    if (!isClosing && tagName === "energy" && tagParam) {
      const count = parseInt(tagParam, 10) || 1;
      pushNode({ type: "tag", tag: "energy", param: String(count), children: [] });
      continue;
    }

    if (!isClosing && tagName === "star" && tagParam) {
      const count = parseInt(tagParam, 10) || 1;
      pushText("★".repeat(count));
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
function renderNodes(nodes: TextNode[], key = "", options: RenderOptions): ReactNode[] {
  return nodes.map((node, i) => {
    const k = `${key}-${i}`;
    if (node.type === "newline") return <br key={k} />;
    if (node.type === "text") return <span key={k}>{node.text}</span>;
    if (node.type === "tag" && node.tag && node.children) {
      if (node.tag === "energy") {
        return (
          <span key={k}>
            {renderEnergyIcons(parseInt(node.param ?? "1", 10) || 1, k, options.energyIconVariant)}
          </span>
        );
      }
      if (node.tag === "sine") {
        return (
          <span key={k} className="rich-sine">
            {renderSineNodes(node.children, k, { current: 0 }, options)}
          </span>
        );
      }
      const colorClass = COLOR_CLASSES[node.tag] ?? "";
      const effectClass = EFFECT_CLASSES[node.tag] ?? "";
      const className = [colorClass, effectClass].filter(Boolean).join(" ");
      return (
        <span key={k} className={className || undefined}>
          {renderNodes(node.children, k, options)}
        </span>
      );
    }
    return null;
  });
}

export interface RichTextProps {
  text: string;
  className?: string;
  energyIconVariant?: Sts2EnergyIconVariant;
}

// Render BBCode-formatted text with colors and effects
export function RichText({ text, className, energyIconVariant = "colorless" }: RichTextProps) {
  const nodes = parseBBCode(text);
  return <span className={className}>{renderNodes(nodes, "", { energyIconVariant })}</span>;
}

// Export parser for reuse
export { parseBBCode, renderNodes, COLOR_CLASSES, EFFECT_CLASSES, KNOWN_TAGS };
