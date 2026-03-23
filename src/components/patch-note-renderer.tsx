"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export interface CardInfo {
  id: string;
  nameEn: string;
  nameKo: string;
  imageUrl: string | null;
  color: string;
}

interface CardPreviewProps {
  card: CardInfo;
  children: ReactNode;
}

function CardPreview({ card, children }: CardPreviewProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<"above" | "below">("above");
  const ref = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPosition(rect.top < 260 ? "below" : "above");
    }
    setShow(true);
  }, []);

  return (
    <span
      ref={ref}
      className="relative inline"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
    >
      <Link
        href={`/codex/cards#${card.id}`}
        className="font-semibold text-yellow-400 hover:text-yellow-300 underline decoration-yellow-500/30 underline-offset-2 transition-colors cursor-pointer"
      >
        {children}
      </Link>
      {show && card.imageUrl && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none ${
            position === "above" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <span className="block rounded-lg overflow-hidden shadow-2xl border border-yellow-500/20 bg-[#0a0a1a]">
            <Image
              src={card.imageUrl}
              alt={card.nameKo}
              width={200}
              height={280}
              className="block"
              unoptimized
            />
            <span className="block px-2 py-1 text-center">
              <span className="text-xs font-bold text-yellow-400">{card.nameKo}</span>
              <span className="text-[10px] text-muted-foreground ml-1">{card.nameEn}</span>
            </span>
          </span>
        </span>
      )}
    </span>
  );
}

// Build a lookup from English card names to CardInfo
function buildCardLookup(cards: CardInfo[]): Map<string, CardInfo> {
  const map = new Map<string, CardInfo>();
  for (const card of cards) {
    // Index by English name (case-insensitive)
    map.set(card.nameEn.toLowerCase(), card);
  }
  return map;
}

// Parse markdown bold **Name** patterns and link them to cards
function enrichLine(
  text: string,
  cardLookup: Map<string, CardInfo>,
): ReactNode[] {
  const parts: ReactNode[] = [];
  // Match **bold text** patterns (card names in patch notes)
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const boldText = match[1];
    // Check if this bold text matches a card name
    // Handle "X -> Y" renames and "X & Y" pairs
    const names = boldText.split(/\s*(?:->|→|&)\s*/);
    const enrichedNames: ReactNode[] = [];

    for (let i = 0; i < names.length; i++) {
      const name = names[i].trim();
      const card = cardLookup.get(name.toLowerCase());

      if (i > 0) {
        // Determine separator
        const sep = boldText.includes("->") || boldText.includes("→") ? " → " : " & ";
        enrichedNames.push(sep);
      }

      if (card) {
        enrichedNames.push(
          <CardPreview key={`${keyIdx}-${i}`} card={card}>
            {name}
          </CardPreview>
        );
      } else {
        // Bold but not a known card
        enrichedNames.push(
          <strong key={`${keyIdx}-${i}`} className="font-semibold text-foreground">
            {name}
          </strong>
        );
      }
    }

    parts.push(<span key={`bold-${keyIdx}`}>{enrichedNames}</span>);
    keyIdx++;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function renderMarkdownLine(
  line: string,
  cardLookup: Map<string, CardInfo>,
  key: string,
): ReactNode {
  const trimmed = line.trimStart();

  // Heading levels
  if (trimmed.startsWith("### ")) {
    return (
      <h3 key={key} className="text-base font-semibold mt-6 mb-2 text-yellow-500">
        {enrichLine(trimmed.slice(4), cardLookup)}
      </h3>
    );
  }
  if (trimmed.startsWith("## ")) {
    return (
      <h2 key={key} className="text-lg font-bold mt-8 mb-3 text-yellow-400 border-b border-border pb-1">
        {enrichLine(trimmed.slice(3), cardLookup)}
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
      <li key={key} className="text-sm text-muted-foreground ml-4 mb-1 list-disc list-outside">
        {enrichLine(trimmed.slice(2), cardLookup)}
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
      {enrichLine(trimmed, cardLookup)}
    </p>
  );
}

export function PatchNoteRenderer({
  markdown,
  cards,
}: {
  markdown: string;
  cards: CardInfo[];
}) {
  const cardLookup = buildCardLookup(cards);
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
        </ul>
      );
      listBuffer = [];
      listKey++;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith("- ")) {
      listBuffer.push(renderMarkdownLine(lines[i], cardLookup, `line-${i}`));
    } else {
      flushList();
      const el = renderMarkdownLine(lines[i], cardLookup, `line-${i}`);
      if (el) elements.push(el);
    }
  }
  flushList();

  return <div className="patch-note-content">{elements}</div>;
}
