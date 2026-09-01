import { bakeDescription } from "@/lib/codex-bake";
import { historyCardDisplayName } from "@/lib/history-card-lookup";
import { restSiteChoiceLabel } from "@/lib/history-party";
import { historyStaticHoverTip } from "@/lib/history-static-hover-tips";
import {
  furCoatHistoryEntryText,
  runHistoryText,
} from "@/lib/history-run-history-loc";
import type { GameLocale } from "@/lib/i18n";
import {
  formatGameTemplate,
  isGameI18nTableName,
  localizeGameKey,
  type GameI18nTableName,
  type GameI18nTables,
} from "@/lib/sts2-game-i18n";
import type {
  ReplayCardRef,
  ReplayChoice,
  ReplayHistoryEntry,
} from "@/lib/sts2-run-replay";

export const HISTORY_HOVER_ICON_SRC = {
  gold: "/images/sts2/icons/gold_icon.webp",
  card: "/images/sts2/icons/card_icon.webp",
  chest: "/images/sts2/icons/chest_icon.webp",
  potion: "/images/sts2/icons/potion_icon.webp",
} as const;

export type HistoryHoverIcon = keyof typeof HISTORY_HOVER_ICON_SRC;

export type HistoryHoverLine = {
  text: string;
  icon: HistoryHoverIcon | null;
};

export type HistoryHoverModel = {
  floorTitle: string;
  playerStats: string | null;
  roomStats: string;
  actionLines: HistoryHoverLine[];
  rewardLines: HistoryHoverLine[];
  skippedLines: HistoryHoverLine[];
  rewardsHeader: string;
  skippedHeader: string;
};

const COMBAT_ROOM_TYPES = new Set(["monster", "elite", "boss"]);

const ROOM_TYPE_BY_MAP_POINT: Record<string, string> = {
  shop: "ROOM_MERCHANT",
  treasure: "ROOM_TREASURE",
  rest_site: "ROOM_REST",
  monster: "ROOM_ENEMY",
  elite: "ROOM_ELITE",
  boss: "ROOM_BOSS",
  ancient: "ROOM_ANCIENT",
};

const ROOM_TYPE_BY_UNKNOWN: Record<string, string> = {
  monster: "ROOM_UNKNOWN_ENEMY",
  treasure: "ROOM_UNKNOWN_TREASURE",
  shop: "ROOM_UNKNOWN_MERCHANT",
  elite: "ROOM_UNKNOWN_ELITE",
  event: "ROOM_EVENT",
};

function loc(
  locale: GameLocale,
  key: string,
  fallback: string,
  vars?: Record<string, string | number>,
): string {
  const template = runHistoryText(locale, key, fallback);
  if (!vars) return template;
  return bakeDescription(template, vars);
}

function line(text: string, icon: HistoryHoverIcon | null = null): HistoryHoverLine {
  return { text: text.replace(/\{Icon\}/g, ""), icon };
}

function cardPlusName(
  id: string | undefined,
  tables: GameI18nTables,
  upgradeLevel = 0,
): string {
  const name = historyCardDisplayName(id ?? "", tables);
  if (!id || upgradeLevel <= 0) return name;
  return upgradeLevel > 1 ? `${name}+${upgradeLevel}` : `${name}+`;
}

function cardRefName(card: ReplayCardRef, tables: GameI18nTables): string {
  return cardPlusName(card.id, tables, card.current_upgrade_level ?? 0);
}

function resourceName(
  tables: GameI18nTables,
  table: GameI18nTableName,
  id: string | undefined,
): string {
  if (!id) return "?";
  return localizeGameKey(tables, table, id) ?? id;
}

function locChoiceTitle(
  choice: ReplayChoice,
  tables: GameI18nTables,
  fallbackTables: GameI18nTableName[],
): string {
  const key = choice.locKey ?? choice.id;
  const tableName = isGameI18nTableName(choice.locTable)
    ? choice.locTable
    : null;
  const named = tableName ? localizeGameKey(tables, tableName, key) : null;
  if (named) {
    return choice.locVars ? bakeDescription(named, choice.locVars) : named;
  }
  for (const table of fallbackTables) {
    const hit = localizeGameKey(tables, table, key);
    if (hit) return choice.locVars ? bakeDescription(hit, choice.locVars) : hit;
  }
  return localizeGameKey(tables, fallbackTables[0] ?? "events", choice.id) ?? choice.id;
}

function roomTypeKey(entry: ReplayHistoryEntry): string | null {
  if (entry.map_point_type === "unknown") {
    const roomType = (entry.rooms[0]?.room_type ?? "").toLowerCase();
    return ROOM_TYPE_BY_UNKNOWN[roomType] ?? null;
  }
  return ROOM_TYPE_BY_MAP_POINT[entry.map_point_type] ?? null;
}

function modelTitle(
  entry: ReplayHistoryEntry,
  tables: GameI18nTables,
): string {
  const room = entry.rooms[0];
  const roomType = (room?.room_type ?? "").toLowerCase();
  const modelId = room?.model_id ?? null;
  if (roomType === "event") {
    return (
      localizeGameKey(tables, "events", modelId) ??
      localizeGameKey(tables, "ancients", modelId) ??
      ""
    );
  }
  if (roomType === "treasure" || roomType === "shop" || roomType === "rest_site") {
    return "";
  }
  return localizeGameKey(tables, "encounters", modelId) ?? "";
}

function combatRoom(entry: ReplayHistoryEntry) {
  return entry.rooms.find((room) => COMBAT_ROOM_TYPES.has(room.room_type.toLowerCase()));
}

/** Game splits reward/skipped lists into two columns after 5 rows. */
export function historyHoverColumnSize(count: number): number {
  return Math.max(5, Math.ceil(count / 2));
}

export function splitHistoryHoverColumns(
  lines: HistoryHoverLine[],
): [HistoryHoverLine[], HistoryHoverLine[]] {
  if (lines.length <= 5) return [lines, []];
  const size = historyHoverColumnSize(lines.length);
  return [lines.slice(0, size), lines.slice(size)];
}

/**
 * Ports `NMapPointHistoryHoverTip` action + reward/skipped lists.
 * Strings come from `run_history.json`; token icons from sprite-font assets.
 */
export function buildMapPointHistoryHover(
  entry: ReplayHistoryEntry,
  floor: number,
  tables: GameI18nTables,
  locale: GameLocale,
): HistoryHoverModel {
  const typeId = roomTypeKey(entry);
  const typeTitle = typeId
    ? historyStaticHoverTip(typeId, locale).title
    : "";
  const title = modelTitle(entry, tables);
  // `MAP_POINT_HISTORY.room_stats` is `{MapPointType}{ModelTitle:: {}|}`.
  // I2 `{Var:: {}|}` means "space + value when set" — not a colon.
  const roomStats = `${typeTitle}${title ? ` ${title}` : ""}`.trim() || "?";

  const hasHp = typeof entry.current_hp === "number";
  const playerStats = hasHp
    ? loc(locale, "MAP_POINT_HISTORY.player_stats", "[red]{HP}/{MaxHP} HP[/red]    [gold]{Gold} Gold[/gold]", {
        HP: entry.current_hp ?? 0,
        MaxHP: entry.max_hp ?? 0,
        Gold: entry.current_gold ?? 0,
      })
    : null;

  return {
    floorTitle: loc(locale, "MAP_POINT_HISTORY.header", "Floor {FloorNum}", {
      FloorNum: floor,
    }),
    playerStats,
    roomStats,
    actionLines: buildActionLines(entry, tables, locale),
    rewardsHeader: loc(locale, "HISTORY_ENTRY.rewardsHeader", "Rewards:"),
    skippedHeader: loc(locale, "HISTORY_ENTRY.skippedHeader", "Skipped:"),
    ...buildRewardAndSkipped(entry, tables, locale),
  };
}

function buildActionLines(
  entry: ReplayHistoryEntry,
  tables: GameI18nTables,
  locale: GameLocale,
): HistoryHoverLine[] {
  const lines: HistoryHoverLine[] = [];
  const chose = (choice: string) =>
    loc(locale, "MAP_POINT_HISTORY.chose", "Chose {Choice}", { Choice: choice });
  const skipped = (choice: string) =>
    loc(locale, "MAP_POINT_HISTORY.skipped", "Skipped {Choice}", { Choice: choice });

  if (entry.map_point_type === "ancient") {
    const picked = (entry.ancient_choice ?? []).find((choice) => choice.picked);
    if (picked) {
      lines.push(
        line(chose(locChoiceTitle(picked, tables, ["relics", "events", "ancients", "characters"]))),
      );
    }
    for (const choice of entry.ancient_choice ?? []) {
      if (choice.picked) continue;
      lines.push(
        line(skipped(locChoiceTitle(choice, tables, ["relics", "events", "ancients", "characters"]))),
      );
    }
  } else if (
    entry.rooms.some((room) => room.room_type.toLowerCase() === "event")
  ) {
    for (const choice of entry.event_choices ?? []) {
      lines.push(
        line(chose(locChoiceTitle(choice, tables, ["events", "relics"]))),
      );
    }
  }

  for (const choice of entry.rest_site_choices ?? []) {
    lines.push(line(chose(restSiteChoiceLabel(choice, locale))));
  }

  if (entry.is_affected_by_fur_coat) {
    const coatTitle = localizeGameKey(tables, "relics", "FUR_COAT") ?? "FUR_COAT";
    lines.push(
      line(formatGameTemplate(furCoatHistoryEntryText(locale), { Title: coatTitle })),
    );
  }

  const combat = combatRoom(entry);
  if ((entry.max_hp_lost ?? 0) > 0) {
    lines.push(
      line(
        loc(locale, "MAP_POINT_HISTORY.maxHpLost", "[red]Lost {HP} Max HP[/red]", {
          HP: entry.max_hp_lost ?? 0,
        }),
      ),
    );
  }
  if ((entry.damage_taken ?? 0) > 0 || combat) {
    lines.push(
      line(
        loc(locale, "MAP_POINT_HISTORY.damageTaken", "[red]{Damage} Damage[/red]", {
          Damage: entry.damage_taken ?? 0,
        }),
      ),
    );
  }
  if ((entry.max_hp_gained ?? 0) > 0) {
    lines.push(
      line(
        loc(locale, "MAP_POINT_HISTORY.maxHpGained", "[green]Gained {HP} Max HP[/green]", {
          HP: entry.max_hp_gained ?? 0,
        }),
      ),
    );
  }
  if ((entry.hp_healed ?? 0) > 0) {
    lines.push(
      line(
        loc(locale, "MAP_POINT_HISTORY.healed", "[green]Healed for {HP} HP[/green]", {
          HP: entry.hp_healed ?? 0,
        }),
      ),
    );
  }
  if (combat) {
    lines.push(
      line(
        loc(locale, "MAP_POINT_HISTORY.turnsTaken", "{Turns} {Turns:plural:Turn|Turns}", {
          Turns: combat.turns_taken,
        }),
      ),
    );
  }
  for (const questId of entry.completed_quests ?? []) {
    lines.push(
      line(
        loc(locale, "MAP_POINT_HISTORY.questCompleted", "Completed the {Quest} Quest.", {
          Quest: resourceName(tables, "cards", questId),
        }),
      ),
    );
  }
  for (const id of entry.potion_used ?? []) {
    lines.push(
      line(
        loc(locale, "HISTORY_ENTRY.used", "{Icon}{Title} was used.", {
          Title: resourceName(tables, "potions", id),
          Icon: "",
        }),
        "potion",
      ),
    );
  }
  for (const id of entry.potion_discarded ?? []) {
    lines.push(
      line(
        loc(locale, "HISTORY_ENTRY.removed", "{Icon}{Title} was removed.", {
          Title: resourceName(tables, "potions", id),
          Icon: "",
        }),
        "potion",
      ),
    );
  }
  if ((entry.gold_spent ?? 0) > 0) {
    lines.push(
      line(
        loc(locale, "HISTORY_ENTRY.goldSpent", "Spent {Amount} Gold", {
          Amount: entry.gold_spent ?? 0,
        }),
      ),
    );
  }
  if ((entry.gold_lost ?? 0) > 0) {
    lines.push(
      line(
        loc(locale, "HISTORY_ENTRY.goldLost", "Lost {Amount} Gold", {
          Amount: entry.gold_lost ?? 0,
        }),
      ),
    );
  }
  if ((entry.gold_stolen ?? 0) > 0) {
    lines.push(
      line(
        loc(locale, "HISTORY_ENTRY.goldStolen", "{Amount} Gold was stolen", {
          Amount: entry.gold_stolen ?? 0,
        }),
      ),
    );
  }
  return lines;
}

function obtained(
  locale: GameLocale,
  title: string,
  icon: HistoryHoverIcon,
): HistoryHoverLine {
  return line(
    loc(locale, "HISTORY_ENTRY.obtained", "{Icon}{Title}", { Title: title, Icon: "" }),
    icon,
  );
}

function buildRewardAndSkipped(
  entry: ReplayHistoryEntry,
  tables: GameI18nTables,
  locale: GameLocale,
): Pick<HistoryHoverModel, "rewardLines" | "skippedLines"> {
  const rewards: HistoryHoverLine[] = [];
  const skipped: HistoryHoverLine[] = [];

  if ((entry.gold_gained ?? 0) > 0) {
    rewards.push(
      line(
        loc(locale, "HISTORY_ENTRY.goldGained", "{Icon}{Amount} Gold", {
          Amount: entry.gold_gained ?? 0,
          Icon: "",
        }),
        "gold",
      ),
    );
  }
  for (const card of entry.cards_gained ?? []) {
    rewards.push(obtained(locale, cardRefName(card, tables), "card"));
  }
  for (const choice of entry.card_choices ?? []) {
    if (choice.picked) continue;
    skipped.push(
      obtained(
        locale,
        cardPlusName(choice.id, tables, choice.upgradeLevel ?? 0),
        "card",
      ),
    );
  }
  for (const choice of entry.relic_choices ?? []) {
    const named = resourceName(tables, "relics", choice.id);
    const row = obtained(locale, named, "chest");
    if (choice.picked) rewards.push(row);
    else skipped.push(row);
  }
  for (const choice of entry.potion_choices ?? []) {
    const named = resourceName(tables, "potions", choice.id);
    const row = obtained(locale, named, "potion");
    if (choice.picked) rewards.push(row);
    else skipped.push(row);
  }
  for (const card of entry.cards_removed ?? []) {
    rewards.push(
      line(
        loc(locale, "HISTORY_ENTRY.removed", "{Icon}{Title} was removed.", {
          Title: cardRefName(card, tables),
          Icon: "",
        }),
        "card",
      ),
    );
  }
  for (const id of entry.relics_removed ?? []) {
    rewards.push(
      line(
        loc(locale, "HISTORY_ENTRY.removed", "{Icon}{Title} was removed.", {
          Title: resourceName(tables, "relics", id),
          Icon: "",
        }),
        "chest",
      ),
    );
  }
  for (const id of entry.upgraded_cards ?? []) {
    rewards.push(
      line(
        loc(locale, "HISTORY_ENTRY.upgraded", "{Icon}{Title} was upgraded.", {
          Title: resourceName(tables, "cards", id),
          Icon: "",
        }),
        "card",
      ),
    );
  }
  for (const id of entry.downgraded_cards ?? []) {
    rewards.push(
      line(
        loc(locale, "HISTORY_ENTRY.downgraded", "{Icon}{Title} was downgraded.", {
          Title: resourceName(tables, "cards", id),
          Icon: "",
        }),
        "card",
      ),
    );
  }
  for (const enchant of entry.cards_enchanted ?? []) {
    rewards.push(
      line(
        loc(
          locale,
          "HISTORY_ENTRY.enchanted",
          "{Icon}{Title1} enchanted with [purple]{Title2}[/purple].",
          {
            Title1: cardPlusName(enchant.cardId, tables, enchant.upgradeLevel ?? 0),
            Title2: resourceName(tables, "enchantments", enchant.enchantmentId),
            Icon: "",
          },
        ),
        "card",
      ),
    );
  }
  for (const transform of entry.cards_transformed ?? []) {
    rewards.push(
      line(
        loc(locale, "HISTORY_ENTRY.transformed", "{Icon}{Title1} transformed into {Title2}.", {
          Title1: cardRefName(transform.original, tables),
          Title2: cardRefName(transform.final, tables),
          Icon: "",
        }),
        "card",
      ),
    );
  }

  return { rewardLines: rewards, skippedLines: skipped };
}
