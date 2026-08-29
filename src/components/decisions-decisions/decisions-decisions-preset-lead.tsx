"use client";

import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  CHARACTER_TOKEN_ICONS,
  COLORLESS_FILTER_ICON,
} from "@/components/codex/codex-filter-assets";
import Image from "@/components/ui/static-image";
import { CHARACTER_COLORS } from "@/lib/codex-types";
import {
  findPresetDef,
  type DecisionsDecisionsPresetDef,
} from "@/lib/decisions-decisions";
import { decisionsKeyFromBuiltinPresetKey } from "@/lib/favorite-tournament";

/** Same Ancient blue as 티어 만들기 named/all-ancient preset chips. */
export const DECISIONS_PRESET_ANCIENT_ACCENT = "#60a5fa";

const CARD_COLLECTION_ICON = "/images/sts2/nav/stats_cards.png";
const RELIC_COLLECTION_ICON = "/images/sts2/relics/bing_bong.webp";
const POTION_COLLECTION_ICON = "/images/sts2/potions/potion_shaped_rock.webp";
const ANCIENT_TOKEN_ICON = "/images/sts2/ancients/neow.webp";
const MONSTER_TYPE_ICON = "/images/sts2/nav/happy_cultist.png";
const MAP_ELITE_ICON = "/images/sts2/map/icons/map_elite.png";
const OVERGROWTH_ELITE_ICON = "/images/sts2/map/icons-by-act/overgrowth/map_elite.png";
const UNDERDOCKS_ELITE_ICON = "/images/sts2/map/icons-by-act/underdocks/map_elite.png";
const PRESET_FAN_COUNT = 3;

export function DecisionsPresetComboStack({
  lead,
  trail,
}: {
  lead: string;
  trail: string;
}) {
  return (
    <span className="relative block h-8 w-10 shrink-0" aria-hidden>
      <Image
        src={lead}
        alt=""
        width={32}
        height={32}
        className="absolute left-0 top-0 z-10 h-8 w-8 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.75)]"
      />
      <Image
        src={trail}
        alt=""
        width={32}
        height={32}
        className="absolute left-2.5 top-0 z-20 h-8 w-8 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.75)]"
      />
    </span>
  );
}

export function DecisionsPresetTypeFan({
  typeSrc,
  overlaySrcs,
}: {
  typeSrc: string;
  overlaySrcs: string[];
}) {
  const overlays = overlaySrcs.slice(0, PRESET_FAN_COUNT);
  return (
    <span
      className="relative block h-8 shrink-0"
      style={{ width: `${28 + Math.max(overlays.length, 1) * 10}px` }}
      aria-hidden
    >
      <Image
        src={typeSrc}
        alt=""
        width={28}
        height={28}
        className="absolute left-0 top-1 z-0 h-7 w-7 object-contain opacity-90 drop-shadow-[0_3px_5px_rgba(0,0,0,0.75)]"
      />
      {overlays.map((src, index) => (
        <Image
          key={`${src}-${index}`}
          src={src}
          alt=""
          width={32}
          height={32}
          className="absolute top-0 h-8 w-8 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.75)]"
          style={{ left: `${8 + index * 10}px`, zIndex: 10 + index }}
        />
      ))}
    </span>
  );
}

function DecisionsPresetIcon({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={32}
      height={32}
      className="h-8 w-8 shrink-0 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.75)]"
    />
  );
}

function firstMatchingUrls(
  entityMap: Map<string, EntityInfo>,
  pick: (entity: EntityInfo) => string | null | undefined,
  count: number,
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const entity of entityMap.values()) {
    const url = pick(entity);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= count) break;
  }
  return urls;
}

function leadForDef(
  def: DecisionsDecisionsPresetDef,
  entityMap: Map<string, EntityInfo>,
) {
  if (def.kind === "cards") {
    const trail = def.color === "colorless"
      ? COLORLESS_FILTER_ICON
      : CHARACTER_TOKEN_ICONS[def.color];
    return (
      <DecisionsPresetComboStack
        lead={CARD_COLLECTION_ICON}
        trail={trail ?? COLORLESS_FILTER_ICON}
      />
    );
  }
  if (def.kind === "relics") {
    return <DecisionsPresetIcon src={RELIC_COLLECTION_ICON} />;
  }
  if (def.kind === "ancient-relics") {
    return (
      <DecisionsPresetTypeFan
        typeSrc={RELIC_COLLECTION_ICON}
        overlaySrcs={firstMatchingUrls(
          entityMap,
          (entity) => (
            entity.type === "ancient"
              ? entity.ancientData?.imageUrl ?? entity.imageUrl
              : null
          ),
          PRESET_FAN_COUNT,
        )}
      />
    );
  }
  if (def.kind === "ancient-relics-named") {
    return (
      <DecisionsPresetComboStack
        lead={RELIC_COLLECTION_ICON}
        trail={entityMap.get(`ancient:${def.ancientId}`)?.imageUrl ?? ANCIENT_TOKEN_ICON}
      />
    );
  }
  if (def.kind === "monsters") {
    const overlaySrcs = def.key === "monsters-boss"
      ? firstMatchingUrls(
        entityMap,
        (entity) => (entity.type === "monster" ? entity.monsterData?.bossImageUrl : null),
        PRESET_FAN_COUNT,
      )
      : def.key === "monsters-elite-act1"
        ? [OVERGROWTH_ELITE_ICON, UNDERDOCKS_ELITE_ICON]
        : [MAP_ELITE_ICON];
    return (
      <DecisionsPresetTypeFan
        typeSrc={MONSTER_TYPE_ICON}
        overlaySrcs={overlaySrcs}
      />
    );
  }
  if (def.kind === "potions") {
    return <DecisionsPresetIcon src={POTION_COLLECTION_ICON} />;
  }
  return null;
}

export function decisionsPresetDef(presetKey: string): DecisionsDecisionsPresetDef {
  const decisionsKey = decisionsKeyFromBuiltinPresetKey(presetKey) ?? presetKey;
  return findPresetDef(decisionsKey);
}

/**
 * Leading accent on 티어 만들기 preset chips. Character card presets use
 * the character color; Ancient relic presets use Ancient blue. Catalog and
 * monster chips have no rail — keep that mapping here so index cards match.
 */
export function decisionsPresetAccent(presetKey: string): string | undefined {
  const def = decisionsPresetDef(presetKey);
  if (def.kind === "cards") return CHARACTER_COLORS[def.color];
  if (def.kind === "ancient-relics" || def.kind === "ancient-relics-named") {
    return DECISIONS_PRESET_ANCIENT_ACCENT;
  }
  return undefined;
}

/** Token shown in front of a Decisions preset chip — reused on tournament index cards. */
export function DecisionsPresetLead({
  presetKey,
  entityMap,
}: {
  presetKey: string;
  entityMap: Map<string, EntityInfo>;
}) {
  const def = decisionsPresetDef(presetKey);
  if (def.kind === "custom") return null;
  return leadForDef(def, entityMap);
}
