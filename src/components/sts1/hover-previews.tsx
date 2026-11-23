"use client";

import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { Sts1EntityPreview } from "./mention-hover";
import type { Sts1EntityRefs, Sts1ItemRef, Sts1RefType } from "@/lib/sts1/types";

const RESOURCE: Record<Sts1RefType, string> = {
  card: "cards",
  relic: "relics",
  potion: "potions",
  monster: "monsters",
  power: "powers",
  blight: "blights",
  keyword: "keywords",
  modifier: "modifiers",
};

/** The ids a card/relic/potion reference names: itself, or every member of the pool it rolls from. */
function itemIds(item: Sts1ItemRef, refs: Sts1EntityRefs): string[] {
  if (item.id) return [item.id];
  if (item.pool === "curse") return Object.keys(refs.card).filter((id) => refs.cursePool?.includes(id));
  return Array.isArray(item.pool) ? item.pool : [];
}

/** Mention-index ids for what these references name, once each, skipping ones without a page. */
export function sts1PreviewEntityIds(items: readonly { type: Sts1RefType; ids: string[] }[], refs: Sts1EntityRefs): string[] {
  const out = items.flatMap(({ type, ids }) => ids.flatMap((id) => {
    const slug = refs[type]?.[id]?.slug;
    return slug ? [`sts1:${RESOURCE[type]}:${slug}`] : [];
  }));
  return [...new Set(out)];
}

export function sts1ItemPreviewIds(items: readonly Sts1ItemRef[], refs: Sts1EntityRefs): string[] {
  return sts1PreviewEntityIds(items.map((item) => ({ type: item.type, ids: itemIds(item, refs) })), refs);
}

/** What a choice gives or names, shown beside it while hovered: the game element itself, not a tag. */
export function Sts1HoverPreviews({ entityIds }: { entityIds: string[] }) {
  if (entityIds.length === 0) return null;
  return (
    <PortaledHoverTipLayer pin="top-left">
      <div className="flex max-w-[38rem] flex-wrap items-start gap-2">
        {entityIds.map((id) => <Sts1EntityPreview key={id} entityId={id} />)}
      </div>
    </PortaledHoverTipLayer>
  );
}
