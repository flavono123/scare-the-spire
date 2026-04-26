"use client";

import { useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import {
  parseBBCode,
  COLOR_CLASSES,
  EFFECT_CLASSES,
} from "@/components/rich-text";
import type { CodexCard, CodexRelic, CodexPotion, CodexPower, CodexEnchantment, CodexEvent, CodexMonster, CodexEncounter } from "@/lib/codex-types";
import { RELIC_RARITY_LABELS, RELIC_RARITY_COLORS, POOL_LABELS, POTION_RARITY_CONFIG, POWER_TYPE_CONFIG, ENCHANTMENT_CARD_TYPE_CONFIG, MONSTER_TYPE_CONFIG, ENCOUNTER_ROOM_TYPE_CONFIG, EVENT_ACT_CONFIG, EVENT_ACT_UNKNOWN, getCharacterColor, characterOutlineFilter, type RelicFilterPool, type EnchantmentCardTypeFilter } from "@/lib/codex-types";
import { CardTile } from "@/components/codex/card-tile";
import { DescriptionText } from "@/components/codex/codex-description";

// Entity types that can appear in patch notes
export type EntityType = "card" | "relic" | "potion" | "power" | "enchantment" | "event" | "monster" | "encounter";

export interface EntityInfo {
  id: string;
  nameEn: string;
  nameKo: string;
  imageUrl: string | null;
  color: string; // card color or pool
  type: EntityType;
  cardData?: CodexCard; // Full card data for rich preview
  relicData?: CodexRelic; // Full relic data for rich preview
  potionData?: CodexPotion; // Full potion data for rich preview
  powerData?: CodexPower; // Full power data for rich preview
  enchantmentData?: CodexEnchantment; // Full enchantment data for rich preview
  eventData?: CodexEvent; // Full event data for rich preview
  eventOptionDesc?: string; // BBCode description for event option tooltips
  monsterData?: CodexMonster; // Full monster data for rich preview
  encounterData?: CodexEncounter; // Full encounter data for rich preview
}

// Keep backward compat alias
export type CardInfo = EntityInfo;

// --- Entity Preview (hover card image) ---

const DEFAULT_ENTITY_LINK_CLASS =
  "font-semibold spire-gold hover:text-yellow-300 underline decoration-yellow-500/30 underline-offset-2 transition-colors cursor-pointer";

export function EntityPreview({
  entity,
  children,
  forceShow,
  forcePosition,
  linkClassName,
}: {
  entity: EntityInfo;
  children: ReactNode;
  forceShow?: boolean;
  forcePosition?: "above" | "below";
  /** Override the link's CSS classes — used when embedded inside an already-colored span (e.g. [purple]…[/purple] in a description). */
  linkClassName?: string;
}) {
  const [show, setShow] = useState(false);
  const visible = show || forceShow;
  const [position, setPosition] = useState<"above" | "below">(forcePosition ?? "above");
  const ref = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      // Card tile preview is taller (~340px), other rich tooltips ~200px
      const hasRichData = entity.relicData || entity.potionData || entity.powerData || entity.enchantmentData;
      const threshold = entity.cardData ? 380 : entity.eventOptionDesc ? 120 : entity.eventData ? 160 : entity.encounterData ? 260 : hasRichData ? 260 : 260;
      setPosition(rect.top < threshold ? "below" : "above");
    }
    setShow(true);
  }, [entity.cardData, entity.relicData, entity.potionData, entity.powerData, entity.enchantmentData, entity.eventData, entity.eventOptionDesc, entity.encounterData]);

  const hrefMap: Record<EntityType, string> = {
    card: `/codex/cards?card=${entity.id.toLowerCase()}`,
    relic: `/codex/relics?relic=${entity.id.toLowerCase()}`,
    potion: `/codex/potions?potion=${entity.id.toLowerCase()}`,
    power: `/codex/powers?power=${entity.id.toLowerCase()}`,
    enchantment: `/codex/enchantments?enchantment=${entity.id.toLowerCase()}`,
    event: `/codex/events/${entity.id.toLowerCase()}`,
    monster: `/codex/monsters?monster=${entity.id.toLowerCase()}`,
    encounter: `/codex/encounters?encounter=${entity.id.toLowerCase()}`,
  };
  const href = hrefMap[entity.type];

  const tooltipPos = forceShow
    ? "relative z-50 mt-1"
    : `absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none ${position === "above" ? "bottom-full mb-2" : "top-full mt-2"}`;

  return (
    <span
      ref={ref}
      className={forceShow ? "inline-block" : "relative inline"}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
    >
      {!forceShow && (
        <Link
          href={href}
          className={linkClassName ?? DEFAULT_ENTITY_LINK_CLASS}
        >
          {children}
        </Link>
      )}
      {visible && entity.type === "card" && entity.cardData && (
        <span
          className={tooltipPos}
        >
          <span className="block w-36 drop-shadow-2xl">
            <CardTile card={entity.cardData} showUpgrade={false} showBeta={false} />
          </span>
        </span>
      )}
      {visible && entity.type === "relic" && entity.relicData && (
        <span
          className={tooltipPos}
        >
          <span className="block w-64 rounded-lg overflow-hidden shadow-2xl border border-white/15 bg-[#0c0c20]/95 p-3">
            <span className="flex items-center gap-2 mb-1">
              {entity.relicData.imageUrl && (
                <Image
                  src={entity.relicData.imageUrl}
                  alt={entity.nameKo}
                  width={32}
                  height={32}
                  className="w-8 h-8 object-contain"
                  style={{
                    filter: characterOutlineFilter(entity.relicData.pool) ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                  }}
                />
              )}
              <span className="block">
                <span className="block font-bold text-sm text-yellow-400">{entity.nameKo}</span>
                <span className="block text-[10px] text-gray-500">{entity.nameEn}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5 mb-2">
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${RELIC_RARITY_COLORS[entity.relicData.rarity]}20`,
                  color: RELIC_RARITY_COLORS[entity.relicData.rarity],
                }}
              >
                {RELIC_RARITY_LABELS[entity.relicData.rarity]}
              </span>
              {entity.relicData.pool !== "shared" && (
                <span
                  className="text-[10px] font-medium"
                  style={{ color: getCharacterColor(entity.relicData.pool) }}
                >
                  {POOL_LABELS[entity.relicData.pool as RelicFilterPool]}
                </span>
              )}
            </span>
            <span className="block text-xs text-gray-200 leading-relaxed">
              <DescriptionText description={entity.relicData.description} />
            </span>
          </span>
        </span>
      )}
      {visible && entity.type === "potion" && entity.potionData && (
        <span
          className={tooltipPos}
        >
          <span className="block w-64 rounded-lg overflow-hidden shadow-2xl border border-white/15 bg-[#0c0c20]/95 p-3">
            <span className="flex items-center gap-2 mb-1">
              <Image
                src={entity.potionData.imageUrl}
                alt={entity.nameKo}
                width={32}
                height={32}
                className="w-8 h-8 object-contain"
                style={{
                  filter: characterOutlineFilter(entity.potionData.pool) ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                }}
              />
              <span className="block">
                <span className="block font-bold text-sm text-yellow-400">{entity.nameKo}</span>
                <span className="block text-[10px] text-gray-500">{entity.nameEn}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5 mb-2">
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${POTION_RARITY_CONFIG[entity.potionData.rarity].color}20`,
                  color: POTION_RARITY_CONFIG[entity.potionData.rarity].color,
                }}
              >
                {POTION_RARITY_CONFIG[entity.potionData.rarity].label}
              </span>
              {entity.potionData.pool !== "shared" && (
                <span
                  className="text-[10px] font-medium"
                  style={{ color: getCharacterColor(entity.potionData.pool) }}
                >
                  {entity.potionData.pool === "event" ? "이벤트" : POOL_LABELS[entity.potionData.pool as RelicFilterPool]}
                </span>
              )}
            </span>
            <span className="block text-xs text-gray-200 leading-relaxed">
              <DescriptionText description={entity.potionData.description} />
            </span>
          </span>
        </span>
      )}
      {visible && entity.type === "power" && entity.powerData && (
        <span
          className={tooltipPos}
        >
          <span className="block w-64 rounded-lg overflow-hidden shadow-2xl border border-white/15 bg-[#0c0c20]/95 p-3">
            <span className="flex items-center gap-2 mb-1">
              {entity.powerData.imageUrl && (
                <Image
                  src={entity.powerData.imageUrl}
                  alt={entity.nameKo}
                  width={32}
                  height={32}
                  className="w-8 h-8 object-contain drop-shadow-md"
                />
              )}
              <span className="block">
                <span className="block font-bold text-sm" style={{ color: POWER_TYPE_CONFIG[entity.powerData.type].color }}>
                  {entity.nameKo}
                </span>
                <span className="block text-[10px] text-gray-500">{entity.nameEn}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5 mb-2">
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${POWER_TYPE_CONFIG[entity.powerData.type].color}20`,
                  color: POWER_TYPE_CONFIG[entity.powerData.type].color,
                }}
              >
                {POWER_TYPE_CONFIG[entity.powerData.type].label}
              </span>
            </span>
            <span className="block text-xs text-gray-200 leading-relaxed">
              <DescriptionText description={entity.powerData.description} />
            </span>
          </span>
        </span>
      )}
      {visible && entity.type === "enchantment" && entity.enchantmentData && (
        <span
          className={tooltipPos}
        >
          <span className="block w-64 rounded-lg overflow-hidden shadow-2xl border border-white/15 bg-[#0c0c20]/95 p-3">
            <span className="flex items-center gap-2 mb-1">
              {entity.enchantmentData.imageUrl && (
                <Image
                  src={entity.enchantmentData.imageUrl}
                  alt={entity.nameKo}
                  width={32}
                  height={32}
                  className="w-8 h-8 object-contain drop-shadow-md"
                />
              )}
              <span className="block">
                <span className="block font-bold text-sm text-purple-400">{entity.nameKo}</span>
                <span className="block text-[10px] text-gray-500">{entity.nameEn}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5 mb-2">
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${ENCHANTMENT_CARD_TYPE_CONFIG[(entity.enchantmentData.cardType ?? "Any") as EnchantmentCardTypeFilter].color}20`,
                  color: ENCHANTMENT_CARD_TYPE_CONFIG[(entity.enchantmentData.cardType ?? "Any") as EnchantmentCardTypeFilter].color,
                }}
              >
                {ENCHANTMENT_CARD_TYPE_CONFIG[(entity.enchantmentData.cardType ?? "Any") as EnchantmentCardTypeFilter].label}
              </span>
              {entity.enchantmentData.isStackable && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                  중첩
                </span>
              )}
            </span>
            <span className="block text-xs text-gray-200 leading-relaxed">
              <DescriptionText description={entity.enchantmentData.description} />
            </span>
          </span>
        </span>
      )}
      {visible && entity.type === "event" && entity.eventData && !entity.eventOptionDesc && (
        <span
          className={tooltipPos}
        >
          <span className="block w-56 rounded-lg overflow-hidden shadow-2xl border border-white/15 bg-[#0c0c20]/95">
            {entity.eventData.imageUrl && (
              <span className="block relative w-full h-28">
                <Image
                  src={entity.eventData.imageUrl}
                  alt={entity.nameKo}
                  fill
                  sizes="224px"
                  className="object-cover"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-[#0c0c20] to-transparent" />
                <span className="absolute bottom-2 left-3 right-3">
                  <span className="block font-bold text-sm text-yellow-400 drop-shadow-lg">{entity.nameKo}</span>
                  {entity.nameEn && <span className="block text-[10px] text-gray-400 drop-shadow-lg">{entity.nameEn}</span>}
                </span>
              </span>
            )}
            {!entity.eventData.imageUrl && (
              <span className="block p-2">
                <span className="block font-bold text-sm text-yellow-400">{entity.nameKo}</span>
              </span>
            )}
          </span>
        </span>
      )}
      {visible && entity.eventOptionDesc && (
        <span
          className={tooltipPos}
        >
          <span className="block w-64 rounded-lg overflow-hidden shadow-2xl border border-amber-500/20 bg-[#0c0c20]/95 p-3">
            <span className="block font-bold text-sm text-amber-400 mb-1">{entity.nameKo}</span>
            <span className="block text-xs text-gray-200 leading-relaxed">
              <DescriptionText description={entity.eventOptionDesc} />
            </span>
          </span>
        </span>
      )}
      {visible && entity.type === "monster" && entity.monsterData && (
        <span
          className={tooltipPos}
        >
          <span className={`block ${forceShow ? "w-fit" : "w-64"} rounded-lg overflow-hidden shadow-2xl border border-white/15 bg-[#0c0c20]/95 p-3`}>
            <span className="flex items-center gap-2 mb-1">
              {(entity.monsterData.bossImageUrl || entity.monsterData.imageUrl) && (
                <Image
                  src={entity.monsterData.bossImageUrl ?? entity.monsterData.imageUrl!}
                  alt={entity.nameKo}
                  width={32}
                  height={32}
                  className="w-8 h-8 object-cover rounded"
                />
              )}
              <span className="block">
                <span className="block font-bold text-sm text-yellow-400">{entity.nameKo}</span>
                <span className="block text-[10px] text-gray-500">{entity.nameEn}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5 mb-2">
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${MONSTER_TYPE_CONFIG[entity.monsterData.type].color}20`,
                  color: MONSTER_TYPE_CONFIG[entity.monsterData.type].color,
                }}
              >
                {MONSTER_TYPE_CONFIG[entity.monsterData.type].label}
              </span>
              {entity.monsterData.minHp != null && entity.monsterData.minHp !== 9999 && (
                <span className="text-[10px] text-gray-400">
                  HP {entity.monsterData.maxHp && entity.monsterData.maxHp !== entity.monsterData.minHp
                    ? `${entity.monsterData.minHp}-${entity.monsterData.maxHp}`
                    : entity.monsterData.minHp}
                </span>
              )}
            </span>
            {entity.monsterData.moves.filter((m) => !["NOTHING", "SPAWNED", "DEAD"].includes(m.id)).length > 0 && (
              <span className="block text-xs text-gray-300 leading-relaxed">
                {entity.monsterData.moves.filter((m) => !["NOTHING", "SPAWNED", "DEAD"].includes(m.id)).slice(0, 4).map((m) => m.name).join(", ")}
              </span>
            )}
          </span>
        </span>
      )}
      {visible && entity.type === "encounter" && entity.encounterData && (
        <span
          className={tooltipPos}
        >
          <span className="block w-64 rounded-lg overflow-hidden shadow-2xl border border-white/15 bg-[#0c0c20]/95 p-3">
            <span className="block">
              <span className="block font-bold text-sm text-yellow-400">{entity.nameKo}</span>
              <span className="block text-[10px] text-gray-500">{entity.nameEn}</span>
            </span>
            <span className="flex items-center gap-1.5 mt-1 mb-2">
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${ENCOUNTER_ROOM_TYPE_CONFIG[entity.encounterData.roomType].color}20`,
                  color: ENCOUNTER_ROOM_TYPE_CONFIG[entity.encounterData.roomType].color,
                }}
              >
                {ENCOUNTER_ROOM_TYPE_CONFIG[entity.encounterData.roomType].label}
              </span>
              {entity.encounterData.act && (
                <span className={`text-[10px] ${(EVENT_ACT_CONFIG[entity.encounterData.act] ?? EVENT_ACT_UNKNOWN).color}`}>
                  {(EVENT_ACT_CONFIG[entity.encounterData.act] ?? EVENT_ACT_UNKNOWN).labelKo}
                </span>
              )}
              {entity.encounterData.isWeak && (
                <span className="text-[10px] text-green-400">쉬운 전투</span>
              )}
            </span>
            <span className="block text-xs text-gray-300 leading-relaxed">
              {Array.from(new Map(entity.encounterData.monsters.map((m) => [m.id, m])).values()).map((m) => m.name).join(", ")}
            </span>
          </span>
        </span>
      )}
      {visible && !entity.cardData && !entity.relicData && !entity.potionData && !entity.powerData && !entity.enchantmentData && !entity.eventData && !entity.eventOptionDesc && !entity.monsterData && !entity.encounterData && entity.imageUrl && (
        <span
          className={tooltipPos}
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

export interface EntityLookup {
  byKo: Map<string, EntityInfo>;
  byEn: Map<string, EntityInfo>;
  allByKo?: Map<string, EntityInfo[]>;
  allByEn?: Map<string, EntityInfo[]>;
}

export function buildEntityLookup(entities: EntityInfo[]): EntityLookup {
  const byKo = new Map<string, EntityInfo>();
  const byEn = new Map<string, EntityInfo>();
  const allByKo = new Map<string, EntityInfo[]>();
  const allByEn = new Map<string, EntityInfo[]>();
  for (const e of entities) {
    byKo.set(e.nameKo.toLowerCase(), e);
    byEn.set(e.nameEn.toLowerCase(), e);
    const koKey = e.nameKo.toLowerCase();
    const enKey = e.nameEn.toLowerCase();
    if (!allByKo.has(koKey)) allByKo.set(koKey, []);
    allByKo.get(koKey)!.push(e);
    if (!allByEn.has(enKey)) allByEn.set(enKey, []);
    allByEn.get(enKey)!.push(e);
  }
  return { byKo, byEn, allByKo, allByEn };
}

export function findEntity(text: string, lookup: EntityLookup, typeHint?: string): EntityInfo | null {
  const lower = text.toLowerCase();
  if (typeHint) {
    // [gold:card], [gold:relic], etc. — filter by entity type
    const koMatch = lookup.byKo.get(lower);
    if (koMatch && koMatch.type === typeHint) return koMatch;
    const enMatch = lookup.byEn.get(lower);
    if (enMatch && enMatch.type === typeHint) return enMatch;
    // Fall back to type-specific lists
    const koAll = lookup.allByKo?.get(lower);
    if (koAll) {
      const match = koAll.find((e) => e.type === typeHint);
      if (match) return match;
    }
    const enAll = lookup.allByEn?.get(lower);
    if (enAll) {
      const match = enAll.find((e) => e.type === typeHint);
      if (match) return match;
    }
    return null;
  }
  return lookup.byKo.get(lower) ?? lookup.byEn.get(lower) ?? null;
}

// --- BBCode node types from rich-text.tsx ---

interface TextNode {
  type: "text" | "newline" | "tag";
  text?: string;
  tag?: string;
  param?: string;
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
        const entity = findEntity(plainText, lookup, node.param);

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

// --- Developer comment block ---

const DEVNOTE_KO_RE = /^\[devnote\](.*)\[\/devnote\]$/;
const DEVNOTE_EN_RE = /^\[devnote:en\](.*)\[\/devnote\]$/;

function DevnoteBlock({
  koContent,
  enContent,
  lookup,
  isItemLevel,
  keyPrefix,
}: {
  koContent: string;
  enContent: string | null;
  lookup: EntityLookup;
  isItemLevel: boolean;
  keyPrefix: string;
}) {
  return (
    <div key={keyPrefix} className={isItemLevel ? "ml-6 mt-1 mb-2" : "mt-1 mb-3"}>
      <div className="pl-3 border-l-2 border-zinc-600 text-xs text-zinc-400 leading-relaxed">
        <span className="text-zinc-500 font-medium mr-1.5">Dev</span>
        {enrichLine(koContent, lookup, `${keyPrefix}-ko`)}
      </div>
      {enContent && (
        <details className="mt-1">
          <summary className="pl-3 text-[11px] text-zinc-600 cursor-pointer hover:text-zinc-500 transition-colors select-none">
            원문 보기
          </summary>
          <div className="mt-1 pl-3 border-l-2 border-zinc-700/50 text-[11px] text-zinc-600 italic leading-relaxed">
            {enContent}
          </div>
        </details>
      )}
    </div>
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
  const allEntities = useMemo(() => entities ?? cards ?? [], [entities, cards]);
  const lookup = useMemo(() => buildEntityLookup(allEntities), [allEntities]);
  const lines = markdown.split("\n");

  // Group consecutive list items into <ul> containers
  const elements: ReactNode[] = [];
  let listBuffer: ReactNode[] = [];
  let listKey = 0;
  let wasInList = false;

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

    // Developer comment: [devnote]Korean[/devnote] + optional [devnote:en]English[/devnote]
    const koMatch = trimmed.match(DEVNOTE_KO_RE);
    if (koMatch) {
      const hadList = listBuffer.length > 0;
      flushList();
      const koText = koMatch[1];
      let enText: string | null = null;
      if (i + 1 < lines.length) {
        const nextMatch = lines[i + 1].trimStart().match(DEVNOTE_EN_RE);
        if (nextMatch) {
          enText = nextMatch[1];
          i++;
        }
      }
      elements.push(
        <DevnoteBlock
          key={`devnote-${i}`}
          koContent={koText}
          enContent={enText}
          lookup={lookup}
          isItemLevel={hadList || wasInList}
          keyPrefix={`devnote-${i}`}
        />,
      );
      wasInList = false;
      continue;
    }

    // Skip orphaned [devnote:en] lines
    if (DEVNOTE_EN_RE.test(trimmed)) continue;

    if (trimmed.startsWith("- ")) {
      listBuffer.push(renderLine(lines[i], lookup, `line-${i}`));
      wasInList = true;
    } else {
      flushList();
      wasInList = false;
      const el = renderLine(lines[i], lookup, `line-${i}`);
      if (el) elements.push(el);
    }
  }
  flushList();

  return <div className="patch-note-content">{elements}</div>;
}
