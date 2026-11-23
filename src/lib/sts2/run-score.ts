/**
 * An STS2 run history file (.run, what 역사강의서 uploads) scored and badged the way the game does (0.113.0):
 * ScoreUtility.CalculateScore / GetBadges, NGameOverScreen.AnimateScoreLines and the 23 badges of BadgePool.
 * Proven against the game's own code by scripts/sts2-run-score.check.ts (scripts/sts2-score-harness).
 */
import cards from "../../../data/sts2/eng/cards.json";
import characters from "../../../data/sts2/eng/characters.json";
import { isMultiplayerOnlyCardId } from "@/lib/card-multiplayer-catalog";
import type { Sts2ScoreLine } from "@/lib/sts2/score";

/** The fields of a run history file (RunHistory, JSON names) the score and badges read. */
export interface Sts2RunFile {
  schema_version?: number;
  /** "standard" | "daily" | "dread" | "blitz"; "custom" before schema 11 (migrated to standard). */
  game_mode?: string;
  win: boolean;
  was_abandoned?: boolean;
  ascension: number;
  /** WinTime on a win, RunTime otherwise (RunHistoryUtilities.CreateRunHistoryEntry). */
  run_time?: number;
  players: Sts2RunPlayer[];
  map_point_history: Sts2RunMapPoint[][];
}

export interface Sts2RunPlayer {
  id: number;
  /** "CHARACTER.IRONCLAD" */
  character: string;
  deck: { id: string }[];
  relics: { id: string }[];
  /** What GetBadges gave this player at the game-over screen (RunHistoryPlayer.Badges). */
  badges?: { id: string; rarity: string }[];
}

export interface Sts2RunMapPoint {
  map_point_type: string;
  rooms: { room_type: string }[];
  player_stats: Sts2RunPlayerStats[];
}

export interface Sts2RunPlayerStats {
  player_id: number;
  gold_gained?: number;
  gold_spent?: number;
  current_gold?: number;
  max_hp?: number;
  damage_taken?: number;
  rest_site_choices?: string[];
}

export type Sts2BadgeRarity = "bronze" | "silver" | "gold";
export interface Sts2RunBadge {
  id: string;
  rarity: Sts2BadgeRarity;
}

const rooms = (run: Sts2RunFile) => run.map_point_history.flat().flatMap((point) => point.rooms);

/** ScoreUtility.GetElitesKilledCount: elite rooms, minus a final one (the fight that ended the run). */
export function sts2ElitesKilled(run: Sts2RunFile): number {
  const all = rooms(run);
  const count = all.filter((room) => room.room_type === "elite").length;
  return all.at(-1)?.room_type === "elite" ? count - 1 : count;
}

/** The very last room of the run (C# history.Last().Last().Rooms.Last()). */
function isFinalRoom(run: Sts2RunFile, act: number, point: number, room: number): boolean {
  const history = run.map_point_history;
  return act === history.length - 1 && point === history[act].length - 1 && room === history[act][point].rooms.length - 1;
}

/** ScoreUtility.GetBossesSlainCount: boss rooms entered, except the last room of a run that was not won. */
export function sts2BossesSlain(run: Sts2RunFile): number {
  let count = 0;
  run.map_point_history.forEach((points, act) =>
    points.forEach((point, p) =>
      point.rooms.forEach((room, r) => {
        if (room.room_type === "boss" && !(!run.win && isFinalRoom(run, act, p, r))) count++;
      }),
    ),
  );
  return count;
}

const isDread = (run: Sts2RunFile) => run.game_mode === "dread";

/**
 * NGameOverScreen.AnimateScoreLines for `playerId` (default the first player): the gold line shows that player's gold
 * while its points use the party's (GetScoreForGoldGained). Lines sum to the total, except on Blitz: the screen hides the
 * gold line there but CalculateScore still adds its points.
 */
export function sts2RunScore(run: Sts2RunFile, playerId = run.players[0]?.id): { total: number; lines: Sts2ScoreLine[] } {
  const history = run.map_point_history;
  const points = history.flat();
  const lines: Sts2ScoreLine[] = [
    { key: "floorsClimbed", count: points.length, points: history.reduce((sum, act, i) => sum + act.length * 10 * (i + 1), 0) },
  ];
  const partyGold = points.flatMap((point) => point.player_stats).reduce((sum, stats) => sum + (stats.gold_gained ?? 0), 0);
  // C# int division.
  const goldPoints = Math.trunc(partyGold / (100 * run.players.length));
  if (run.game_mode !== "blitz") {
    // MapPointHistoryEntry.GetEntry throws for a player missing from a point; such a file never reaches the screen.
    const mine = points.reduce((sum, point) => sum + (point.player_stats.find((stats) => stats.player_id === playerId)?.gold_gained ?? 0), 0);
    lines.push({ key: "goldGained", count: mine, points: goldPoints });
  }
  const elites = sts2ElitesKilled(run);
  if (elites > 0) lines.push({ key: "elitesKilled", count: elites, points: elites * 50 });
  const bosses = sts2BossesSlain(run);
  if (bosses > 0) lines.push({ key: "bossesSlain", count: bosses, points: bosses * 100 });
  const base = lines[0].points + goldPoints + elites * 50 + bosses * 100;
  let total = base;
  if (isDread(run)) {
    total = base * 3;
    lines.push({ key: "dread", count: 0, points: total - base, multiplier: 3 });
  } else {
    // (int)((double)num * (1.0 + (double)ascension * 0.1)); the line is shown only above 0.
    total = Math.trunc(base * (1 + run.ascension * 0.1));
    if (run.ascension > 0) {
      lines.push({ key: "ascension", count: run.ascension, points: total - base, multiplier: Math.round((1 + run.ascension * 0.1) * 10) / 10 });
    }
  }
  return { total, lines };
}

type CardFacts = { curse: boolean; basic: boolean; multiplayerOnly: boolean };
// Cards the site still lists but 0.113.0 no longer has: SaveUtil.CardOrDeprecated gives DeprecatedCard (Status/Status).
const NOT_IN_GAME = new Set(["FOLLOW_THROUGH", "GRAPPLE", "SCARE"]);
const CARDS = new Map<string, CardFacts>(
  (cards as { id: string; type: string; rarity: string }[])
    .filter((card) => !NOT_IN_GAME.has(card.id))
    .map((card) => [card.id, { curse: card.type === "Curse", basic: card.rarity === "Basic", multiplayerOnly: isMultiplayerOnlyCardId(card.id) }]),
);
const DEPRECATED_CARD: CardFacts = { curse: false, basic: false, multiplayerOnly: false };
// CharacterModel.StartingHp; ids missing from characters.json (and DeprecatedCharacter) from the 0.113.0 models.
const STARTING_HP = new Map<string, number>([
  ["DEPRIVED", 1000],
  ["RANDOM_CHARACTER", 1],
  ["ROTATING_CHARACTER", 1],
  ...(characters as { id: string; starting_hp: number }[]).map((c) => [c.id, c.starting_hp] as [string, number]),
]);
const DEPRECATED_CHARACTER_HP = 1000;

/** What the badges read of a card (SaveUtil.CardOrDeprecated) and a character, by model entry ("STRIKE_IRONCLAD"). */
export const sts2BadgeCardFacts = (entryId: string): CardFacts => CARDS.get(entryId) ?? DEPRECATED_CARD;
export const sts2StartingHp = (entryId: string): number => STARTING_HP.get(entryId) ?? DEPRECATED_CHARACTER_HP;

const entry = (modelId: string) => modelId.slice(modelId.indexOf(".") + 1);

/** RunHistory migrations v8->v9 and v9->v10 (SharedMigrationHelper.v100Renames / v110Renames) for card ids. */
function migratedCardId(id: string, schema: number): string {
  if (schema < 9 && id === "CARD.PREPARE") id = "CARD.PREPARED";
  if (schema < 10 && id === "CARD.SCARE") id = "CARD.SIDESTEP";
  return entry(id);
}

const tier = (value: number, bronze: number, silver: number, gold: number): Sts2BadgeRarity | null =>
  value >= gold ? "gold" : value >= silver ? "silver" : value >= bronze ? "bronze" : null;
const countTier = (count: number): Sts2BadgeRarity | null => (count >= 3 ? "gold" : count === 2 ? "silver" : count === 1 ? "bronze" : null);

/**
 * ScoreUtility.GetBadges for one player, in BadgePool order, each badge at the rarity it reached (only that tier).
 * The run-end gold and max HP are the last map point's (what the game saves there); abandoned runs get none
 * (RunHistoryUtilities.GetBadgesForPlayer). CCCCOMBO, DAMAGE_LEADER and DEBUFFER come from the file's recorded badges.
 */
export function sts2RunBadges(run: Sts2RunFile, playerId: number): Sts2RunBadge[] {
  const player = run.players.find((p) => p.id === playerId);
  if (!player || run.was_abandoned) return [];
  const won = run.win;
  const solo = run.players.length === 1;
  const schema = run.schema_version ?? 0;
  const deck = player.deck.map((card) => migratedCardId(card.id, schema));
  const facts = sts2BadgeCardFacts;
  const nonBasic = deck.filter((id) => !facts(id).basic);
  const lastStats = run.map_point_history.at(-1)?.at(-1)?.player_stats.find((stats) => stats.player_id === playerId);
  const gold = lastStats?.current_gold ?? 0;
  const maxHp = lastStats?.max_hp ?? 0;
  const startingHp = sts2StartingHp(entry(player.character));
  const relics = new Set(player.relics.map((relic) => relic.id));
  const recorded = new Map((player.badges ?? []).map((badge) => [badge.id, badge.rarity.toLowerCase() as Sts2BadgeRarity]));

  // Per-room, per-player-stat walks as the badges write them (a point's stats count once for each matching room).
  const myStats = (roomType: string) =>
    run.map_point_history.flatMap((points, act) =>
      points.flatMap((point, p) =>
        point.rooms.flatMap((room, r) =>
          room.room_type === roomType ? point.player_stats.filter((s) => s.player_id === playerId).map((stats) => ({ stats, act, p, r })) : [],
        ),
      ),
    );
  const restRooms = run.map_point_history.flat().flatMap((point) => point.rooms).filter((room) => room.room_type === "rest_site").length;
  const rests = myStats("rest_site").map(({ stats }) => stats.rest_site_choices ?? []);
  const copies = new Map<string, number>();
  for (const id of nonBasic) copies.set(id, (copies.get(id) ?? 0) + 1);
  // CCCCOMBO, DAMAGE_LEADER and DEBUFFER read SerializablePlayer.ExtraFields (cards per turn, damage dealt, debuffs
  // applied), which a history file does not keep: only the badge the game recorded in the file says it was earned.
  const recordedOnly = (id: string): Sts2BadgeRarity | null => recorded.get(id) ?? null;

  // [id, rarity or null when not obtained, requiresWin, multiplayerOnly]
  const pool: [string, Sts2BadgeRarity | null, boolean, boolean][] = [
    ["CCCCOMBO", recordedOnly("CCCCOMBO"), false, false],
    ["CURSES", deck.filter((id) => facts(id).curse).length >= 5 ? "bronze" : null, true, false],
    // Also needs MapPointHistory[0].Count >= 5; the game checks it, the recorded badge already reflects it.
    ["DAMAGE_LEADER", recordedOnly("DAMAGE_LEADER"), false, true],
    ["DEBUFFER", recordedOnly("DEBUFFER"), false, true],
    ["DOUBLE_SNECKO", relics.has("RELIC.SNECKO_EYE") && relics.has("RELIC.FAKE_SNECKO_EYE") ? "bronze" : null, false, false],
    ["ELITE", tier(sts2ElitesKilled(run), 3, 6, 9), false, false],
    ["FAMISHED", maxHp < Math.trunc((startingHp + 1) / 2) ? "bronze" : null, true, false],
    ["GLUTTON", tier(maxHp - startingHp, 15, 30, 50), true, false],
    ["HEALER", countTier(rests.filter((choices) => choices.includes("MEND")).length), false, true],
    ["HIGHLANDER", new Set(nonBasic).size === nonBasic.length ? "bronze" : null, true, false],
    ["HONED", [...copies.values()].some((n) => n >= 5) ? "bronze" : null, true, false],
    ["BIG_DECK", tier(deck.length, 40, 60, 100), true, false],
    ["ILIKESHINY", player.relics.length >= 25 ? "bronze" : null, false, false],
    ["KACHING", myStats("shop").reduce((sum, { stats }) => sum + (stats.gold_spent ?? 0), 0) >= 1000 ? "bronze" : null, false, false],
    ["MONEY_MONEY", tier(gold, 200, 400, 600), true, false],
    ["MYSTERY_MACHINE", run.map_point_history.flat().filter((point) => point.map_point_type === "unknown").length >= 15 ? "bronze" : null, false, false],
    [
      "PERFECT",
      countTier(myStats("boss").filter(({ stats, act, p, r }) => !(!won && isFinalRoom(run, act, p, r)) && (stats.damage_taken ?? 0) <= 0).length),
      false,
      false,
    ],
    // Restful/Restless count every rest room (any player's) and fail on the first of this player's stats that breaks them.
    ["RESTFUL", restRooms > 0 && rests.every((choices) => choices.includes("HEAL")) ? "bronze" : null, true, false],
    ["RESTLESS", restRooms > 0 && rests.every((choices) => !choices.includes("HEAL")) ? "bronze" : null, true, false],
    ["SPEEDY", ((t) => (t <= 1800 ? "gold" : t <= 2400 ? "silver" : t <= 3000 ? "bronze" : null))(won ? Math.trunc(run.run_time ?? 0) : 0), true, false],
    ["TABLET", maxHp === 1 ? "gold" : null, true, false],
    ["TEAM_PLAYER", deck.filter((id) => facts(id).multiplayerOnly).length >= 3 ? "silver" : null, false, true],
    ["TINY_DECK", deck.length <= 5 ? "gold" : deck.length <= 10 ? "silver" : deck.length <= 20 ? "bronze" : null, true, false],
  ];
  return pool.flatMap(([id, rarity, requiresWin, multiplayerOnly]) =>
    rarity && (!requiresWin || won) && (!multiplayerOnly || !solo) ? [{ id, rarity }] : [],
  );
}
