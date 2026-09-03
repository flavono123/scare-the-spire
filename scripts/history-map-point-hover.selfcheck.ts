/**
 * Map-point hover stats vs NMapPointHistoryHoverTip.
 *   pnpm exec tsx scripts/history-map-point-hover.selfcheck.ts
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import korRelics from "../data/sts2/localization/kor/relics.json";
import engRelics from "../data/sts2/localization/eng/relics.json";
import { furCoatHistoryEntryText } from "../src/lib/history-run-history-loc";
import {
  buildMapPointHistoryHover,
  historyHoverArtSrc,
  historyHoverColumnSize,
  splitHistoryHoverColumns,
} from "../src/lib/history-map-point-hover";
import { getGameI18nTablesSync } from "../src/lib/sts2-game-i18n";
import {
  parseReplayRun,
  type ReplayHistoryEntry,
} from "../src/lib/sts2-run-replay";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function historyDir(): string {
  return join(
    homedir(),
    "Library/Application Support/SlayTheSpire2/steam/76561199168753671/profile1/saves/history",
  );
}

const kor = getGameI18nTablesSync("kor");
const eng = getGameI18nTablesSync("eng");

function hover(entry: ReplayHistoryEntry, floor = 6, locale: "kor" | "eng" = "kor") {
  return buildMapPointHistoryHover(
    entry,
    floor,
    locale === "kor" ? kor : eng,
    locale,
  );
}

function synthetic(partial: Partial<ReplayHistoryEntry>): ReplayHistoryEntry {
  return {
    map_point_type: "monster",
    rooms: [{ room_type: "monster", model_id: "CULTISTS_NORMAL", turns_taken: 2 }],
    current_hp: 50,
    max_hp: 70,
    current_gold: 120,
    ...partial,
  };
}

function main() {
  assert(
    furCoatHistoryEntryText("kor") ===
      (korRelics as Record<string, string>)["FUR_COAT.historyEntry"],
    "kor fur-coat historyEntry matches relics.json",
  );
  assert(
    furCoatHistoryEntryText("eng") ===
      (engRelics as Record<string, string>)["FUR_COAT.historyEntry"],
    "eng fur-coat historyEntry matches relics.json",
  );

  const combatZero = hover(
    synthetic({ damage_taken: 0, hp_healed: 0 }),
  );
  assert(combatZero.roomStats === "적 광신자들", `room stats: ${combatZero.roomStats}`);
  assert(
    combatZero.playerStats?.includes("50/70"),
    "player stats keep HP/MaxHP",
  );
  assert(
    combatZero.actionLines.some((line) => line.text.includes("0") && line.text.includes("피해")),
    "combat rooms list 0 damage",
  );
  assert(
    combatZero.actionLines.some((line) => line.text.includes("2턴") || line.text.includes("2")),
    "combat rooms list turns",
  );

  const unknownEnemy = hover(
    synthetic({
      map_point_type: "unknown",
      rooms: [{ room_type: "monster", model_id: "CULTISTS_NORMAL", turns_taken: 1 }],
    }),
  );
  assert(
    unknownEnemy.roomStats.startsWith("미지 - 적"),
    `unknown enemy room: ${unknownEnemy.roomStats}`,
  );

  const rewards = hover(
    synthetic({
      gold_gained: 25,
      cards_gained: [{ id: "CARD.STRIKE_IRONCLAD", current_upgrade_level: 1 }],
      card_choices: [
        { id: "CARD.BASH", picked: false, upgradeLevel: 1 },
        { id: "CARD.STRIKE_IRONCLAD", picked: true },
      ],
      relic_choices: [
        { id: "ANCHOR", picked: true },
        { id: "VAJRA", picked: false },
      ],
      potion_choices: [{ id: "BLOCK_POTION", picked: false }],
      upgraded_cards: ["CARD.DEFEND_IRONCLAD"],
    }),
  );
  assert(
    rewards.rewardLines[0]?.icon === "gold",
    "gold gained uses gold sprite-font token",
  );
  assert(
    rewards.rewardLines[0]?.art == null,
    "gold gained keeps the token, not card/relic/potion art",
  );
  assert(
    rewards.rewardLines.some((line) => line.icon === "card" && line.text.includes("+")),
    "gained upgraded cards append +",
  );
  assert(
    rewards.rewardLines.some(
      (line) => line.art?.kind === "card" && line.art.id === "CARD.STRIKE_IRONCLAD",
    ),
    "gained cards keep portrait art refs",
  );
  assert(
    rewards.rewardLines.some((line) => line.icon === "chest" && line.text.includes("닻")),
    "picked relics use chest token",
  );
  assert(
    rewards.rewardLines.some(
      (line) => line.art?.kind === "relic" && line.art.id === "ANCHOR",
    ),
    "picked relics keep relic art refs",
  );
  assert(
    rewards.rewardLines.some((line) => line.text.includes("강화")),
    "upgrades land in Rewards",
  );
  assert(
    rewards.skippedLines.every((line) => line.icon != null),
    "skipped choices keep token icons",
  );
  assert(
    rewards.skippedLines.some((line) => line.icon === "card"),
    "skipped cards use card token",
  );
  assert(
    rewards.skippedLines.some((line) => line.icon === "card" && line.text.includes("+")),
    "skipped upgraded cards append + like CardModel.Title",
  );
  assert(
    rewards.skippedLines.some((line) => line.icon === "chest"),
    "skipped relics use chest token",
  );
  assert(
    rewards.skippedLines.some((line) => line.icon === "potion"),
    "skipped potions use potion token",
  );
  assert(
    rewards.skippedLines.some(
      (line) => line.art?.kind === "potion" && line.art.id === "BLOCK_POTION",
    ),
    "skipped potions keep potion art refs",
  );
  assert(
    historyHoverArtSrc({ kind: "card", id: "CARD.STRIKE_IRONCLAD" })
      === "/images/sts2/cards/strike_ironclad.webp",
    "card art strips CARD. prefix",
  );
  assert(
    historyHoverArtSrc({ kind: "relic", id: "ANCHOR" })
      === "/images/sts2/relics/anchor.webp",
    "relic art uses catalog slug",
  );
  assert(
    historyHoverArtSrc({ kind: "potion", id: "BLOCK_POTION" })
      === "/images/sts2/potions/block_potion.webp",
    "potion art uses catalog slug",
  );
  assert(
    !rewards.skippedLines.some((line) => line.text.includes("넘기기")),
    "skipped rows are obtained titles, not playback verbs",
  );

  const rest = hover(
    synthetic({
      map_point_type: "rest_site",
      rooms: [{ room_type: "rest_site", model_id: null, turns_taken: 0 }],
      rest_site_choices: ["SMITH"],
      damage_taken: 0,
    }),
  );
  assert(rest.roomStats === "휴식 장소", `rest room: ${rest.roomStats}`);
  assert(
    rest.actionLines.some((line) => line.text.includes("재련") && line.text.includes("선택")),
    `rest uses Chose: ${rest.actionLines.map((line) => line.text).join(" | ")}`,
  );
  assert(
    !rest.actionLines.some((line) => line.text.includes("피해")),
    "non-combat 0 damage is omitted",
  );

  const potions = hover(
    synthetic({
      potion_used: ["STRENGTH_POTION"],
      potion_discarded: ["WEAK_POTION"],
      gold_gained: 0,
    }),
  );
  assert(
    potions.actionLines.some((line) => line.icon === "potion" && line.text.includes("사용")),
    "potion used is an action row with potion token",
  );
  assert(
    potions.actionLines.some(
      (line) => line.art?.kind === "potion" && line.art.id === "STRENGTH_POTION",
    ),
    "potion used keeps potion art",
  );
  assert(
    potions.actionLines.some((line) => line.icon === "potion" && line.text.includes("제거")),
    "potion discarded uses removed loc, not a custom verb",
  );
  assert(
    potions.rewardLines.every((line) => line.icon !== "potion" || !line.text.includes("사용")),
    "potion used is not under Rewards",
  );

  assert(historyHoverColumnSize(5) === 5, "5 rows stay one column");
  assert(historyHoverColumnSize(6) === 5, "6 rows split 5+1");
  assert(historyHoverColumnSize(11) === 6, "11 rows split 6+5");
  const [left, right] = splitHistoryHoverColumns(
    Array.from({ length: 6 }, (_, i) => ({ text: String(i), icon: null })),
  );
  assert(left.length === 5 && right.length === 1, "column split matches game");

  const run = parseReplayRun(
    readFileSync(join(historyDir(), "1782038066.run"), "utf8"),
  );
  const eventFloor = run.map_point_history.flat().find(
    (entry) =>
      entry.map_point_type !== "ancient" &&
      (entry.event_choices?.length ?? 0) > 0,
  );
  assert(eventFloor, "fixture has event choices");
  const eventHover = hover(eventFloor!);
  assert(
    eventHover.actionLines.some((line) => line.text.includes("자제한다")),
    `event option loc: ${eventHover.actionLines.map((line) => line.text).join(" | ")}`,
  );
  assert(
    eventHover.roomStats === "이벤트 심연의 욕탕",
    `unknown event room: ${eventHover.roomStats}`,
  );
  assert(
    !eventHover.roomStats.includes(":"),
    "room stats do not insert a colon",
  );
  assert(
    eventFloor!.event_choices?.some((choice) => choice.locTable && choice.locKey),
    "event choices keep loc table+key from the run file",
  );

  const ranwidFloor = run.map_point_history.flat().find((entry) =>
    entry.event_choices?.some((choice) => choice.locKey?.includes("RANWID_THE_ELDER")),
  );
  if (ranwidFloor) {
    const ranwidHover = hover(ranwidFloor);
    assert(
      ranwidHover.actionLines.some((line) => line.text.includes("목 보호대")),
      `event vars bake into Chose: ${ranwidHover.actionLines.map((line) => line.text).join(" | ")}`,
    );
  }

  const skippedUpgrade = run.map_point_history.flat().find((entry) =>
    entry.card_choices?.some((choice) => !choice.picked && (choice.upgradeLevel ?? 0) > 0),
  );
  assert(skippedUpgrade, "fixture has a skipped upgraded card");
  const skippedHover = hover(skippedUpgrade!);
  assert(
    skippedHover.skippedLines.some((line) => line.icon === "card" && line.text.includes("+")),
    `skipped upgraded card from run: ${skippedHover.skippedLines.map((line) => line.text).join(" | ")}`,
  );

  const kaleido = hover(
    synthetic({
      relic_choices: [
        { id: "RELIC.KALEIDOSCOPE", picked: true },
        { id: "FISHING_ROD", picked: false },
      ],
      cards_gained: [{ id: "CARD.ABUNDANCE" }],
    }),
  );
  assert(
    kaleido.rewardLines.some((line) => line.text === "만화경"),
    `kaleidoscope loc: ${kaleido.rewardLines.map((line) => line.text).join(" | ")}`,
  );
  assert(
    kaleido.skippedLines.some((line) => line.text === "낚싯대"),
    `fishing rod loc: ${kaleido.skippedLines.map((line) => line.text).join(" | ")}`,
  );
  assert(
    kaleido.rewardLines.some((line) => line.text === "풍요"),
    `abundance loc: ${kaleido.rewardLines.map((line) => line.text).join(" | ")}`,
  );
  assert(
    !kaleido.rewardLines.some((line) => /RELIC|KALEIDOSCOPE|ABUNDANCE/.test(line.text)),
    "new relics/cards must not fall back to data ids",
  );
  const seaGlass = hover(
    synthetic({
      map_point_type: "ancient",
      rooms: [{ room_type: "event", model_id: "EVENT.NEOW", turns_taken: 0 }],
      ancient_choice: [
        {
          id: "IRONCLAD",
          picked: false,
          locTable: "relics",
          locKey: "SEA_GLASS.IRONCLAD.title",
        },
        {
          id: "KALEIDOSCOPE",
          picked: true,
          locTable: "relics",
          locKey: "KALEIDOSCOPE.title",
        },
      ],
    }),
    1,
  );
  assert(
    seaGlass.actionLines.some((line) => line.text.includes("악마 유리")),
    `sea glass loc: ${seaGlass.actionLines.map((line) => line.text).join(" | ")}`,
  );
  assert(
    seaGlass.actionLines.some((line) => line.text.includes("만화경")),
    `ancient kaleidoscope loc: ${seaGlass.actionLines.map((line) => line.text).join(" | ")}`,
  );

  const ancientFloor = run.map_point_history.flat().find(
    (entry) => entry.map_point_type === "ancient" && (entry.ancient_choice?.length ?? 0) > 1,
  );
  if (ancientFloor) {
    const ancientHover = hover(ancientFloor, 0);
    assert(
      ancientHover.actionLines.some((line) => line.text.includes("선택")),
      "ancient picked uses Chose",
    );
    assert(
      ancientHover.actionLines.some((line) => line.text.includes("건너뜀")),
      "ancient unpicked uses Skipped",
    );
    assert(ancientHover.roomStats.startsWith("고대의 존재"), ancientHover.roomStats);
  }

  console.log("ok", {
    combatRoom: combatZero.roomStats,
    unknownEnemy: unknownEnemy.roomStats,
    rewardIcons: rewards.rewardLines.map((line) => line.icon),
    skippedIcons: rewards.skippedLines.map((line) => line.icon),
  });
}

main();
