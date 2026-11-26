"use client";

import { useMemo, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import {
  parseBBCode,
  COLOR_CLASSES,
  EFFECT_CLASSES,
} from "@/components/rich-text";
import { EntityPreview, type EntityInfo } from "@/components/patch-note-renderer";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";

/**
 * Game text with its gold words decided by data, not by name: a gold word shows the tip its
 * element's game tip list pairs it with (`goldTips`, scripts/generate-game-tips.py) or stays a
 * plain gold highlight. Other colors are plain colored text.
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

interface RenderCtx {
  entitiesByRef: ReadonlyMap<string, EntityInfo>;
  goldTips?: Readonly<Record<string, string | null>>;
  self?: string;
  gameUi?: CodexGameUiLabels;
  energyIcon: string;
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
      const ref = tag === "gold" && inner ? ctx.goldTips?.[inner] : null;
      const entity = ref && ref !== ctx.self ? ctx.entitiesByRef.get(ref) : undefined;
      if (entity) {
        return (
          <span key={key} className={className || undefined}>
            <EntityPreview
              entity={entity}
              gameUi={ctx.gameUi}
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
  /** Game labels for the hover previews. Korean fallbacks show without it. */
  gameUi?: CodexGameUiLabels;
  description: string;
  /** Entities a paired gold word can show (found by "type:id"). */
  entities?: EntityInfo[];
  /** The element's gold words and the tip each names, or null: its `goldTips` from the data layer. */
  goldTips?: Readonly<Record<string, string | null>>;
  /** The element itself ("relic:BYRDPIP"): a word naming it is not linked to its own page. */
  self?: string;
  energyIcon?: string;
  className?: string;
}

export function RichDescription({
  description,
  entities,
  goldTips,
  self,
  gameUi,
  energyIcon = "/images/game-assets/card-misc/energy_colorless.png",
  className,
}: RichDescriptionProps) {
  const entitiesByRef = useMemo(
    () => new Map((entities ?? []).map((entity) => [`${entity.type}:${entity.id}`, entity])),
    [entities],
  );

  const nodes = useMemo(() => parseBBCode(description) as BBNode[], [description]);

  const ctx: RenderCtx = { entitiesByRef, goldTips, self, gameUi, energyIcon };

  return <span className={className}>{renderNodes(nodes, ctx, "rd")}</span>;
}
