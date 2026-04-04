"use client";

import { useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  parseBBCode,
  COLOR_CLASSES,
  EFFECT_CLASSES,
} from "@/components/rich-text";
import type { CodexCard } from "@/lib/codex-types";
import { CardTile } from "@/components/codex/card-tile";

// Entity types that can appear in patch notes
export type EntityType = "card" | "relic" | "potion";

export interface EntityInfo {
  id: string;
  nameEn: string;
  nameKo: string;
  imageUrl: string | null;
  color: string; // card color or pool
  type: EntityType;
  cardData?: CodexCard; // Full card data for rich preview
}

// Keep backward compat alias
export type CardInfo = EntityInfo;

// --- Entity Preview (hover card image) ---

function EntityPreview({
  entity,
  children,
}: {
  entity: EntityInfo;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<"above" | "below">("above");
  const ref = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      // Card tile preview is taller (~340px), need more space
      const threshold = entity.cardData ? 380 : 260;
      setPosition(rect.top < threshold ? "below" : "above");
    }
    setShow(true);
  }, [entity.cardData]);

  const href =
    entity.type === "card"
      ? `/codex/cards/${entity.id.toLowerCase()}`
      : entity.type === "relic"
        ? `/codex/relics#${entity.id}`
        : `/codex/potions#${entity.id}`;

  return (
    <span
      ref={ref}
      className="relative inline"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
    >
      <Link
        href={href}
        className="font-semibold spire-gold hover:text-yellow-300 underline decoration-yellow-500/30 underline-offset-2 transition-colors cursor-pointer"
      >
        {children}
      </Link>
      {show && entity.type === "card" && entity.cardData && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none ${
            position === "above" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <span className="block w-48 drop-shadow-2xl">
            <CardTile card={entity.cardData} showUpgrade={false} showBeta={false} />
          </span>
        </span>
      )}
      {show && (entity.type !== "card" || !entity.cardData) && entity.imageUrl && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none ${
            position === "above" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <span className="block rounded-lg overflow-hidden shadow-2xl border border-yellow-500/20 bg-[#0a0a1a]">
            <Image
              src={entity.imageUrl}
              alt={entity.nameKo}
              width={200}
              height={200}
              className="block"
              unoptimized
            />
            <span className="block px-2 py-1 text-center">
              <span className="text-xs font-bold text-yellow-400">
                {entity.nameKo}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">
                {entity.nameEn}
              </span>
            </span>
          </span>
        </span>
      )}
    </span>
  );
}

// --- Entity Lookup ---

interface EntityLookup {
  byKo: Map<string, EntityInfo>;
  byEn: Map<string, EntityInfo>;
}

function buildEntityLookup(entities: EntityInfo[]): EntityLookup {
  const byKo = new Map<string, EntityInfo>();
  const byEn = new Map<string, EntityInfo>();
  for (const e of entities) {
    byKo.set(e.nameKo.toLowerCase(), e);
    byEn.set(e.nameEn.toLowerCase(), e);
  }
  return { byKo, byEn };
}

function findEntity(text: string, lookup: EntityLookup): EntityInfo | null {
  const lower = text.toLowerCase();
  return lookup.byKo.get(lower) ?? lookup.byEn.get(lower) ?? null;
}

// --- BBCode node types from rich-text.tsx ---

interface TextNode {
  type: "text" | "newline" | "tag";
  text?: string;
  tag?: string;
  children?: TextNode[];
}

// Extract plain text from BBCode node tree
function extractPlainText(nodes: TextNode[]): string {
  let result = "";
  for (const node of nodes) {
    if (node.type === "text" && node.text) result += node.text;
    if (node.type === "tag" && node.children)
      result += extractPlainText(node.children);
  }
  return result;
}

// --- Render BBCode nodes with entity matching ---

function renderBBNodes(
  nodes: TextNode[],
  lookup: EntityLookup,
  prefix: string,
): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${prefix}-${i}`;

    if (node.type === "newline") return <br key={key} />;

    if (node.type === "text" && node.text) {
      // Within plain text, handle **bold** markdown patterns
      return renderMarkdownBold(node.text, lookup, key);
    }

    if (node.type === "tag" && node.tag && node.children) {
      // [gold] tag: check if content matches an entity
      if (node.tag === "gold") {
        const plainText = extractPlainText(node.children);
        const entity = findEntity(plainText, lookup);

        if (entity) {
          return (
            <EntityPreview key={key} entity={entity}>
              {plainText}
            </EntityPreview>
          );
        }

        // Not an entity, just gold styling
        return (
          <span key={key} className="spire-gold font-semibold">
            {renderBBNodes(node.children, lookup, key)}
          </span>
        );
      }

      // Other tags: apply CSS classes (colors + effects)
      const colorClass = COLOR_CLASSES[node.tag] ?? "";
      const effectClass = EFFECT_CLASSES[node.tag] ?? "";
      const className = [colorClass, effectClass].filter(Boolean).join(" ");

      return (
        <span key={key} className={className || undefined}>
          {renderBBNodes(node.children, lookup, key)}
        </span>
      );
    }

    return null;
  });
}

// Handle **bold** patterns in plain text segments
function renderMarkdownBold(
  text: string,
  lookup: EntityLookup,
  keyPrefix: string,
): ReactNode {
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const parts: ReactNode[] = [];
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const boldText = match[1];
    // Handle "X -> Y" renames and "X & Y" pairs
    const names = boldText.split(/\s*(?:->|→|&)\s*/);
    const enriched: ReactNode[] = [];

    for (let j = 0; j < names.length; j++) {
      const name = names[j].trim();
      if (j > 0) {
        const sep =
          boldText.includes("->") || boldText.includes("→") ? " → " : " & ";
        enriched.push(sep);
      }

      const entity = findEntity(name, lookup);
      if (entity) {
        enriched.push(
          <EntityPreview key={`${keyPrefix}-b${idx}-${j}`} entity={entity}>
            {name}
          </EntityPreview>,
        );
      } else {
        enriched.push(
          <strong
            key={`${keyPrefix}-b${idx}-${j}`}
            className="font-semibold text-foreground"
          >
            {name}
          </strong>,
        );
      }
    }

    parts.push(
      <span key={`${keyPrefix}-bold-${idx}`}>{enriched}</span>,
    );
    idx++;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex === 0) return text; // No bold patterns
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <span key={keyPrefix}>{parts}</span>;
}

// --- Enrich a line of text (BBCode + markdown bold) ---

function enrichLine(
  text: string,
  lookup: EntityLookup,
  key: string,
): ReactNode[] {
  const nodes = parseBBCode(text);
  return renderBBNodes(nodes, lookup, key);
}

// --- Markdown line rendering ---

function renderLine(
  line: string,
  lookup: EntityLookup,
  key: string,
): ReactNode {
  const trimmed = line.trimStart();

  // Skip HTML comments (<!-- TODO: ... -->)
  if (trimmed.startsWith("<!--")) return null;

  // Heading levels (check longer prefixes first)
  if (trimmed.startsWith("#### ")) {
    return (
      <h4 key={key} className="text-sm font-semibold mt-4 mb-1 text-yellow-600">
        {enrichLine(trimmed.slice(5), lookup, key)}
      </h4>
    );
  }
  if (trimmed.startsWith("### ")) {
    return (
      <h3 key={key} className="text-base font-semibold mt-6 mb-2 text-yellow-500">
        {enrichLine(trimmed.slice(4), lookup, key)}
      </h3>
    );
  }
  if (trimmed.startsWith("## ")) {
    return (
      <h2
        key={key}
        className="text-lg font-bold mt-8 mb-3 text-yellow-400 border-b border-border pb-1"
      >
        {enrichLine(trimmed.slice(3), lookup, key)}
      </h2>
    );
  }
  if (trimmed.startsWith("# ")) {
    // Skip top-level heading (shown in page header)
    return null;
  }

  // Bullet points
  if (trimmed.startsWith("- ")) {
    return (
      <li
        key={key}
        className="text-sm text-muted-foreground ml-4 mb-1 list-disc list-outside"
      >
        {enrichLine(trimmed.slice(2), lookup, key)}
      </li>
    );
  }

  // Empty line
  if (trimmed === "") {
    return <div key={key} className="h-2" />;
  }

  // Regular paragraph
  return (
    <p key={key} className="text-sm text-muted-foreground mb-1">
      {enrichLine(trimmed, lookup, key)}
    </p>
  );
}

// --- Main Component ---

export function PatchNoteRenderer({
  markdown,
  entities,
  // Backward compat: accept cards prop
  cards,
}: {
  markdown: string;
  entities?: EntityInfo[];
  cards?: EntityInfo[];
}) {
  const allEntities = entities ?? cards ?? [];
  const lookup = useMemo(() => buildEntityLookup(allEntities), [allEntities]);
  const lines = markdown.split("\n");

  // Group consecutive list items into <ul> containers
  const elements: ReactNode[] = [];
  let listBuffer: ReactNode[] = [];
  let listKey = 0;

  function flushList() {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`ul-${listKey}`} className="mb-2">
          {listBuffer}
        </ul>,
      );
      listBuffer = [];
      listKey++;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith("- ")) {
      listBuffer.push(renderLine(lines[i], lookup, `line-${i}`));
    } else {
      flushList();
      const el = renderLine(lines[i], lookup, `line-${i}`);
      if (el) elements.push(el);
    }
  }
  flushList();

  return <div className="patch-note-content">{elements}</div>;
}
