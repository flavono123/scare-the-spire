"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import {
  parseBBCode,
  COLOR_CLASSES,
  EFFECT_CLASSES,
} from "@/components/rich-text";
import {
  EntityPreview,
  buildEntityLookup,
  findEntity,
  type EntityInfo,
  type EntityLookup,
} from "@/components/patch-note-renderer";
import { GOLD_TERM_DESC, TermTooltip } from "./codex-description";

/**
 * Description renderer that recognises in-line entity names inside BBCode
 * color tags and turns them into hover-preview / clickable links — same
 * behaviour as the patch-note renderer, but for prose descriptions on
 * detail pages (relic, enchantment, power, …).
 *
 * - `[purple]숙련[/purple]` on the 목패 relic resolves to the 숙련 enchantment.
 * - Plain `[gold]방어도[/gold]` keywords keep their static keyword tooltip
 *   when no entity matches.
 */

interface BBNode {
  type: "text" | "newline" | "tag";
  text?: string;
  tag?: string;
  param?: string;
  children?: BBNode[];
}

function extractPlainText(nodes: BBNode[]): string {
  let out = "";
  for (const n of nodes) {
    if (n.type === "text" && n.text) out += n.text;
    if (n.type === "tag" && n.children) out += extractPlainText(n.children);
  }
  return out;
}

const COLOR_TAGS = new Set([
  "gold",
  "purple",
  "blue",
  "red",
  "green",
  "orange",
  "pink",
  "aqua",
]);

interface RenderCtx {
  lookup: EntityLookup | null;
  termDescriptions: Record<string, string>;
  hoveredTerm: string | null;
  setHoveredTerm: (t: string | null) => void;
  energyIcon: string;
  // Don't replace these terms with entity links even when they would match —
  // useful for ambiguous keywords like 약화/취약 where the inline keyword
  // tooltip is more useful than a power-page link.
  excludeEntityTerms?: ReadonlySet<string>;
}

function renderNodes(nodes: BBNode[], ctx: RenderCtx, prefix: string): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${prefix}-${i}`;

    if (node.type === "newline") return <br key={key} />;
    if (node.type === "text" && node.text != null) return <span key={key}>{node.text}</span>;

    if (node.type === "tag" && node.tag && node.children) {
      const tag = node.tag;
      const colorClass = COLOR_CLASSES[tag] ?? "";
      const effectClass = EFFECT_CLASSES[tag] ?? "";
      const className = [colorClass, effectClass].filter(Boolean).join(" ");

      const inner = extractPlainText(node.children).trim();
      const isColorTag = COLOR_TAGS.has(tag);

      // 1) Entity match — only at simple color-tag leaves with non-empty text
      if (
        isColorTag &&
        inner &&
        !ctx.excludeEntityTerms?.has(inner) &&
        ctx.lookup
      ) {
        const entity = findEntity(inner, ctx.lookup);
        // For the gold tag, the patch-note renderer also accepts a `param`
        // type-hint (e.g. [gold:relic]); honour it to disambiguate.
        const hinted =
          tag === "gold" && node.param
            ? findEntity(inner, ctx.lookup, node.param)
            : null;
        const matched = hinted ?? entity;
        if (matched) {
          // Don't link a relic to itself / enchantment to itself
          // (caller is responsible for filtering self via `excludeEntityTerms`)
          return (
            <span key={key} className={className || undefined}>
              <EntityPreview
                entity={matched}
                linkClassName={[
                  className,
                  "underline decoration-current/30 underline-offset-2 hover:decoration-current/80 transition-colors cursor-pointer",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {inner}
              </EntityPreview>
            </span>
          );
        }
      }

      // 2) Static keyword tooltip — only for [gold] with a known term
      if (
        tag === "gold" &&
        inner &&
        ctx.termDescriptions[inner]
      ) {
        return (
          <span
            key={key}
            className={`${className} relative cursor-help`}
            onMouseEnter={() => ctx.setHoveredTerm(inner)}
            onMouseLeave={() => ctx.setHoveredTerm(null)}
          >
            {inner}
            {ctx.hoveredTerm === inner && (
              <TermTooltip name={inner} desc={ctx.termDescriptions[inner]} />
            )}
          </span>
        );
      }

      // 3) Energy icon (renders as repeated lightning images)
      if (tag === "energy" && node.param) {
        const count = parseInt(node.param, 10) || 1;
        return (
          <span key={key} className="inline-flex items-baseline gap-0">
            {Array.from({ length: count }, (_, j) => (
              <Image
                key={j}
                src={ctx.energyIcon}
                alt="energy"
                width={14}
                height={14}
                className="inline-block align-text-bottom mx-0.5"
              />
            ))}
          </span>
        );
      }

      if (tag === "star" && node.param) {
        const count = parseInt(node.param, 10) || 1;
        return (
          <span key={key} className="inline-flex items-baseline gap-0">
            {Array.from({ length: count }, (_, j) => (
              <Image
                key={j}
                src="/images/game-assets/card-misc/star_icon.png"
                alt="star"
                width={14}
                height={14}
                className="inline-block align-text-bottom mx-0.5"
              />
            ))}
          </span>
        );
      }

      // 4) Generic color/effect span (also covers nested/multi-child cases)
      return (
        <span key={key} className={className || undefined}>
          {renderNodes(node.children, ctx, key)}
        </span>
      );
    }

    return null;
  });
}

export interface RichDescriptionProps {
  description: string;
  /** Entities used to resolve inline names to hover-cards + links. */
  entities?: EntityInfo[];
  /** Pre-built lookup. If provided, takes precedence over `entities`. */
  lookup?: EntityLookup;
  /** Static keyword tooltip overrides — merged on top of GOLD_TERM_DESC. */
  termDescriptions?: Record<string, string>;
  /** Don't turn these matched names into entity links (still rendered colored). */
  excludeEntityTerms?: ReadonlySet<string>;
  energyIcon?: string;
  className?: string;
}

export function RichDescription({
  description,
  entities,
  lookup,
  termDescriptions,
  excludeEntityTerms,
  energyIcon = "/images/game-assets/card-misc/energy_colorless.png",
  className,
}: RichDescriptionProps) {
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  const resolvedLookup = useMemo(() => {
    if (lookup) return lookup;
    if (entities && entities.length > 0) return buildEntityLookup(entities);
    return null;
  }, [lookup, entities]);

  const allTerms = useMemo(
    () => ({ ...GOLD_TERM_DESC, ...termDescriptions }),
    [termDescriptions],
  );

  const nodes = useMemo(() => parseBBCode(description) as BBNode[], [description]);

  const ctx: RenderCtx = {
    lookup: resolvedLookup,
    termDescriptions: allTerms,
    hoveredTerm,
    setHoveredTerm,
    energyIcon,
    excludeEntityTerms,
  };

  return <span className={className}>{renderNodes(nodes, ctx, "rd")}</span>;
}
