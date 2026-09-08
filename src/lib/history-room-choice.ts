import type {
  CodexCard,
  CodexEnchantment,
  CodexEvent,
  CodexPotion,
  CodexRelic,
  EventOption,
} from "@/lib/codex-types";
import { bakeDescription } from "@/lib/codex-bake";
import { lookupHistoryCard } from "@/lib/history-card-lookup";
import { lookupHistoryPotion } from "@/lib/history-potion-lookup";
import { lookupHistoryRelic } from "@/lib/history-relic-lookup";
import { stripReplayId } from "@/lib/history-last-scene";
import type { HistoryChoiceLoc } from "@/lib/history-last-scene-catalog";
import {
  isGameI18nTableName,
  localizeGame,
  localizeGameKey,
  type GameI18nTables,
} from "@/lib/sts2-game-i18n";
import { prettifyId } from "@/lib/sts2-i18n";
import type { ReplayChoice } from "@/lib/sts2-run-replay";
import type { HistoryLocTables } from "@/lib/history-loc-tables";
import { resolveRelicDisplayImage } from "@/lib/relic-character-variant";

export type HistoryRoomChoiceCopy = {
  title: string;
  description: string | null;
  backgroundImageUrl: string | null;
};

function withoutTitleSuffix(id: string): string {
  return id.endsWith(".title") ? id.slice(0, -".title".length) : id;
}

export function choiceOptionId(choice: ReplayChoice): string {
  const fromLoc = choice.locKey ?? choice.id;
  const match = fromLoc.match(/options\.([^.]+?)(?:\.title)?$/i);
  if (match?.[1]) return match[1];
  return stripReplayId(choice.id);
}

export function findEventOption(
  event: CodexEvent | undefined,
  choice: ReplayChoice,
): EventOption | null {
  if (!event) return null;
  const optionId = choiceOptionId(choice).toUpperCase();
  const options = [
    ...(event.options ?? []),
    ...(event.pages ?? []).flatMap((page) => page.options ?? []),
  ];
  return options.find((option) => option.id.toUpperCase() === optionId) ?? null;
}

function descriptionKeys(choice: ReplayChoice): string[] {
  const locKey = choice.locKey ?? choice.id;
  const base = withoutTitleSuffix(locKey);
  const stripped = stripReplayId(base);
  const relicBlessing =
    choice.locTable === "relics"
    || locKey.endsWith(".eventDescription")
    || /^RELIC\./i.test(choice.id);
  const keys: string[] = [];
  if (locKey.endsWith(".description") || locKey.endsWith(".eventDescription")) {
    keys.push(locKey);
  }
  if (relicBlessing) {
    keys.push(`${base}.eventDescription`, `${stripped}.eventDescription`, `${base}.description`, `${stripped}.description`);
  } else {
    keys.push(`${base}.description`, `${base}.eventDescription`);
    if (stripped !== base) {
      keys.push(`${stripped}.description`, `${stripped}.eventDescription`);
    }
  }
  return [...new Set(keys.filter(Boolean))];
}

function lookupEnchantment(
  enchantments: CodexEnchantment[] | undefined,
  value: string,
): CodexEnchantment | undefined {
  if (!enchantments || !value) return undefined;
  const id = stripReplayId(value).toUpperCase();
  const lower = value.toLowerCase();
  return enchantments.find((row) =>
    row.id.toUpperCase() === id
    || row.name === value
    || row.nameEn.toLowerCase() === lower
  );
}

function choiceTemplateVars(
  choice: ReplayChoice,
  tables: GameI18nTables,
  relicsById?: Record<string, CodexRelic>,
  enchantments?: CodexEnchantment[],
): Record<string, string | number> | undefined {
  const relicVars = lookupHistoryRelic(relicsById, choice.id)?.vars;
  const locVars = choice.locVars ?? {};
  if (!choice.locVars && !relicVars) return undefined;
  const vars: Record<string, string | number> = { ...(relicVars ?? {}), ...locVars };
  for (const [key, value] of Object.entries(locVars)) {
    if (typeof value !== "string") continue;
    if (!/^Enchantment\d+$/i.test(key)) continue;
    const enchantment = lookupEnchantment(enchantments, value);
    if (enchantment) {
      vars[key] = localizeGame(tables, "enchantments", enchantment.id) ?? enchantment.name;
      const amountKey = `${key}Amount`;
      if (vars[amountKey] == null && enchantment.vars.Amount != null) {
        vars[amountKey] = enchantment.vars.Amount;
      }
      continue;
    }
    if (/^[A-Z][A-Z0-9_]+$/.test(value)) {
      const named = localizeGame(tables, "enchantments", value);
      if (named) vars[key] = named;
    }
  }
  return vars;
}

function lookupChoiceTemplate(
  choice: ReplayChoice,
  tables: GameI18nTables,
  choiceLoc: HistoryChoiceLoc | null | undefined,
  locTables: HistoryLocTables | null | undefined,
): string | null {
  const locTable = choice.locTable;
  const relicBlessing =
    locTable === "relics"
    || (choice.locKey?.endsWith(".eventDescription") ?? false)
    || /^RELIC\./i.test(choice.id);
  const keys = descriptionKeys(choice);
  const compactTable = locTable && isGameI18nTableName(locTable) ? tables[locTable] : null;
  const generatedTable =
    locTable === "events" ? choiceLoc?.events
    : locTable === "ancients" ? choiceLoc?.ancients
    : locTable === "relics" || relicBlessing ? choiceLoc?.relics
    : null;
  const historyTable =
    locTable === "events" ? locTables?.events
    : locTable === "ancients" ? locTables?.ancients
    : locTable === "relics" || relicBlessing ? locTables?.relics
    : null;

  for (const key of keys) {
    const compact = compactTable?.[key];
    if (compact) return compact;
    const generated = generatedTable?.[key];
    if (generated) return generated;
    const history = historyTable?.[key];
    if (history) return history;
  }

  if (locTable && isGameI18nTableName(locTable) && choice.locKey) {
    const titled = localizeGameKey(tables, locTable, `${withoutTitleSuffix(choice.locKey)}.description`);
    if (titled) return titled;
  }
  return null;
}

function unresolvedPlaceholderCount(text: string): number {
  return text.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g)?.length ?? 0;
}

function fillUnknownEnchantmentAmounts(text: string): string {
  return text.replace(/\{Enchantment\d+Amount\}/g, "X");
}

function formatCopy(
  template: string | null | undefined,
  locVars: Record<string, string | number> | undefined,
): string | null {
  if (!template) return null;
  const baked = locVars ? bakeDescription(template, locVars) : template;
  return fillUnknownEnchantmentAmounts(baked);
}

export function eventOpeningDescription(event: CodexEvent | undefined): string | null {
  if (!event) return null;
  const initial = event.pages?.find((page) => page.id.toUpperCase() === "INITIAL");
  const text = initial?.description || event.description || null;
  return text?.trim() ? text : null;
}

export function roomChoiceTitle(
  choice: ReplayChoice,
  tables: GameI18nTables,
  fallbackTable: "cards" | "relics" | "potions" | "events" | "ancients",
  eventOption?: EventOption | null,
): string {
  const locKey = choice.locKey;
  if (locKey && (locKey.endsWith(".eventDescription") || locKey.endsWith(".description"))) {
    const resourceId = locKey.replace(/\.(eventDescription|description)$/i, "");
    const named =
      localizeGameKey(tables, "relics", resourceId)
      ?? localizeGame(tables, "relics", choice.id)
      ?? localizeGameKey(tables, "cards", resourceId)
      ?? localizeGame(tables, "cards", choice.id);
    if (named) return named;
  }
  if (choice.locTable && isGameI18nTableName(choice.locTable) && locKey) {
    const template = localizeGameKey(tables, choice.locTable, locKey);
    if (template) {
      return formatCopy(template, choice.locVars) ?? template;
    }
  }
  if (eventOption?.title) {
    return formatCopy(eventOption.title, choice.locVars) ?? eventOption.title;
  }
  return localizeGame(tables, fallbackTable, choice.id)
    ?? localizeGame(tables, "relics", choice.id)
    ?? localizeGame(tables, "cards", choice.id)
    ?? prettifyId(stripReplayId(choice.id));
}

export function roomChoiceDescription(
  choice: ReplayChoice,
  tables: GameI18nTables,
  choiceLoc: HistoryChoiceLoc | null | undefined,
  locTables: HistoryLocTables | null | undefined,
  eventOption?: EventOption | null,
  relicsById?: Record<string, CodexRelic>,
  enchantments?: CodexEnchantment[],
): string | null {
  const vars = choiceTemplateVars(choice, tables, relicsById, enchantments);
  const title = roomChoiceTitle(choice, tables, "events", eventOption);
  const relic = lookupHistoryRelic(relicsById, choice.id);
  const candidates = [
    formatCopy(lookupChoiceTemplate(choice, tables, choiceLoc, locTables), vars),
    eventOption?.description ? formatCopy(eventOption.description, vars) : null,
    relic?.eventDescription ? formatCopy(relic.eventDescription, vars) : null,
  ].filter((text): text is string => Boolean(text && text !== title));
  candidates.sort((a, b) => unresolvedPlaceholderCount(a) - unresolvedPlaceholderCount(b));
  return candidates[0] ?? null;
}

export function roomChoiceBackgroundImageUrl(
  choice: ReplayChoice,
  catalogs: {
    cardsById?: Record<string, CodexCard>;
    relicsById?: Record<string, CodexRelic>;
    potionsById?: Record<string, CodexPotion>;
  },
): string | null {
  const ids = [
    choice.id,
    ...Object.values(choice.locVars ?? {}).flatMap((value) =>
      typeof value === "string" ? [value] : [],
    ),
  ];
  for (const id of ids) {
    const relic = lookupHistoryRelic(catalogs.relicsById, id);
    const relicImage = relic ? resolveRelicDisplayImage(relic, relic.pool) : null;
    if (relicImage) return relicImage;
    const card = lookupHistoryCard(catalogs.cardsById ?? {}, id);
    if (card?.imageUrl) return card.imageUrl;
    const potion = lookupHistoryPotion(catalogs.potionsById, id);
    if (potion?.imageUrl) return potion.imageUrl;
  }
  return null;
}

export function historyRoomChoiceCopy(
  choice: ReplayChoice,
  tables: GameI18nTables,
  fallbackTable: "events" | "ancients",
  opts: {
    choiceLoc?: HistoryChoiceLoc | null;
    locTables?: HistoryLocTables | null;
    event?: CodexEvent;
    cardsById?: Record<string, CodexCard>;
    relicsById?: Record<string, CodexRelic>;
    potionsById?: Record<string, CodexPotion>;
    enchantments?: CodexEnchantment[];
  } = {},
): HistoryRoomChoiceCopy {
  const eventOption = findEventOption(opts.event, choice);
  return {
    title: roomChoiceTitle(choice, tables, fallbackTable, eventOption),
    description: roomChoiceDescription(
      choice,
      tables,
      opts.choiceLoc,
      opts.locTables,
      eventOption,
      opts.relicsById,
      opts.enchantments,
    ),
    backgroundImageUrl: roomChoiceBackgroundImageUrl(choice, opts),
  };
}
