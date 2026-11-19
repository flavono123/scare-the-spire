"use client";

import Image from "@/components/ui/static-image";
import { Sts1MentionHover } from "./mention-hover";
import type { Sts1EntityRefs, Sts1ItemRef, Sts1RefType } from "@/lib/sts1/types";

const RESOURCE: Record<Sts1RefType, string> = {
  card: "cards",
  relic: "relics",
  potion: "potions",
  monster: "monsters",
  power: "powers",
  blight: "blights",
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
        <Image src={ref.imageUrl} alt="" width={32} height={24} className={art} />
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
export function Sts1ItemRefTokens({
  item,
  refs,
  tone,
}: {
  item: Sts1ItemRef;
  refs: Sts1EntityRefs;
  tone?: "default" | "lose";
}) {
  const ids = item.id
    ? [item.id]
    : item.pool === "curse"
      ? Object.keys(refs.card).filter((id) => refs.cursePool?.includes(id))
      : Array.isArray(item.pool)
        ? item.pool
        : [];
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
