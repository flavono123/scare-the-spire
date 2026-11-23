"use client";

import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import type { Sts1RelatedGroup, Sts1RelatedKind } from "@/lib/sts1/relations";
import { sts1NavItems } from "@/lib/site-nav-items";
import { Sts1MentionHover } from "./mention-hover";

const TITLES: Record<ServiceLocale, Record<Sts1RelatedKind, string>> = {
  ko: {
    cards: "관련 카드", relics: "관련 유물", potions: "관련 포션", powers: "관련 파워", keywords: "관련 키워드",
    monsters: "관련 몬스터", characters: "관련 캐릭터", events: "관련 이벤트", modifiers: "관련 모드", blights: "관련 역병",
    ascensions: "관련 승천", achievements: "관련 도전 과제", "score-bonuses": "관련 점수", neow: "관련 니오우",
  },
  en: {
    cards: "Related cards", relics: "Related relics", potions: "Related potions", powers: "Related powers",
    keywords: "Related keywords", monsters: "Related monsters", characters: "Related characters", events: "Related events",
    modifiers: "Related mods", blights: "Related blights", ascensions: "Related ascensions",
    achievements: "Related achievements", "score-bonuses": "Related score bonuses", neow: "Related Neow",
  },
};

const ICONS = new Map(sts1NavItems.map((item) => [item.type, item.icon]));

/** One rail of "관련 ○○: a, b, c" lines, as the STS2 compendium draws related resources; names preview on hover. */
export function Sts1RelatedRail({ groups, serviceLocale }: { groups: readonly Sts1RelatedGroup[]; serviceLocale: ServiceLocale }) {
  if (!groups.length) return null;
  return (
    <section className="w-full rounded-lg border border-border bg-compendium-rail p-4" data-sts1-related="">
      <div className="space-y-2.5">
        {groups.map((group) => {
          const icon = ICONS.get(group.kind);
          return (
            <div key={`${group.kind}-${group.label ?? ""}`} className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-bold text-gray-300" data-sts1-related-kind={group.kind}>
              {icon ? <Image src={icon} alt="" width={22} height={22} className="h-5 w-5 object-contain" /> : null}
              <span>{group.label ?? TITLES[serviceLocale][group.kind]}:</span>
              {group.items.map((item, index) => (
                <span key={item.slug} className="inline-flex items-center gap-1">
                  {index > 0 ? <span className="text-gray-500">,</span> : null}
                  <Sts1MentionHover
                    entityId={`sts1:${group.kind}:${item.slug}`}
                    text={item.name}
                    className="relative inline cursor-help"
                    linkClassName="font-game-title font-semibold spire-gold no-underline hover:brightness-125"
                  />
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
