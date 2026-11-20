"use client";

import Image from "@/components/ui/static-image";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { Sts1EntityPreview, Sts1MentionHover } from "./mention-hover";
import type { ServiceLocale } from "@/lib/i18n";
import type { Sts1EntityRefs, Sts1ItemRef, Sts1Mention, Sts1RefType } from "@/lib/sts1/types";

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

/** One card, relic, potion, monster, power or blight: art + name, hover preview, link to its page. */
export function Sts1EntityToken({
  type,
  id,
  refs,
  count,
  upgraded = false,
  tone = "default",
}: {
  type: Sts1RefType;
  id: string;
  refs: Sts1EntityRefs;
  count?: number;
  upgraded?: boolean;
  tone?: "default" | "lose";
}) {
  const ref = refs[type]?.[id];
  if (!ref) return <span className="font-game-text text-xs text-gray-500">{id}</span>;
  const art = type === "card" ? "h-6 w-8 rounded-sm object-cover" : "h-6 w-6 object-contain";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${
        tone === "lose" ? "border-[#ff6563]/40 bg-[#ff6563]/[0.08]" : "border-white/10 bg-black/30"
      }`}
    >
      <Sts1MentionHover
        entityId={`sts1:${RESOURCE[type]}:${ref.slug}`}
        text={ref.name}
        className="relative inline-flex cursor-help items-center gap-1"
        linkClassName="inline-flex items-center gap-1 font-game-text text-xs font-semibold text-[#efc851] no-underline hover:brightness-125"
      >
        {ref.imageUrl ? <Image src={ref.imageUrl} alt="" width={32} height={24} className={art} /> : null}
        <span className={tone === "lose" ? "line-through decoration-[#ff6563]/70" : undefined}>
          {ref.name}
          {upgraded ? "+" : ""}
        </span>
      </Sts1MentionHover>
      {count && count > 1 ? <span className="font-game-text text-xs font-bold text-gray-200">×{count}</span> : null}
    </span>
  );
}

/** Tokens for an item ref: the item, every item of its pool, or nothing for a generic draw. */
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

export function Sts1ItemRefTokens({
  item,
  refs,
  tone,
}: {
  item: Sts1ItemRef;
  refs: Sts1EntityRefs;
  tone?: "default" | "lose";
}) {
  const ids = itemIds(item, refs);
  if (ids.length === 0) return null;
  return (
    <>
      {ids.map((id) => (
        <Sts1EntityToken
          key={`${item.type}-${id}`}
          type={item.type}
          id={id}
          refs={refs}
          count={item.count}
          upgraded={item.upgraded}
          tone={tone}
        />
      ))}
    </>
  );
}

const MENTION_TITLES: Record<ServiceLocale, Record<Sts1RefType, string>> = {
  ko: {
    card: "관련 카드", relic: "관련 유물", potion: "관련 포션", monster: "관련 몬스터",
    power: "관련 파워", blight: "관련 역병", keyword: "관련 키워드", modifier: "관련 모드",
  },
  en: {
    card: "Related cards", relic: "Related relics", potion: "Related potions", monster: "Related monsters",
    power: "Related powers", blight: "Related blights", keyword: "Related keywords", modifier: "Related mods",
  },
};

/** A detail page's related rails: what the text names, one row per type. */
export function Sts1MentionRail({
  mentions,
  refs,
  serviceLocale,
}: {
  mentions: readonly Sts1Mention[];
  refs: Sts1EntityRefs;
  serviceLocale: ServiceLocale;
}) {
  const types = [...new Set(mentions.map((mention) => mention.type))];
  if (!types.length) return null;
  return (
    <>
      {types.map((type) => (
        <section key={type} className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">{MENTION_TITLES[serviceLocale][type]}</div>
          <div className="flex flex-wrap gap-1.5">
            {mentions.filter((mention) => mention.type === type).map((mention) => (
              <Sts1EntityToken key={mention.id} type={type} id={mention.id} refs={refs} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
