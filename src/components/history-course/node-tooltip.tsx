"use client";

import { useGameI18n } from "@/hooks/use-game-i18n";
import { useGameLocale } from "@/hooks/use-game-locale";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  formatGameTemplate,
  gameUi,
  localizeGame,
  type GameI18nTables,
} from "@/lib/sts2-game-i18n";
import type {
  ReplayActAnalysis,
  ReplayHistoryEntry,
} from "@/lib/sts2-run-replay";
import {
  getMadScienceVariantPartsFromId,
  MAD_SCIENCE_CARD_ID,
  TINKER_RIDER_CHOICE_LABELS,
  TINKER_RIDER_CHOICE_LABELS_EN,
} from "@/lib/tinker-time";
import { serviceMessages } from "@/messages/service";

// Hover tip used both on the replay map and inside the run summary's act
// rows. Lifted out of run-replay-poc.tsx so the summary panel can reuse it
// without dragging the whole map view in.

export interface NodeTooltipProps {
  act: ReplayActAnalysis;
  stepIndex: number;
  entry: ReplayHistoryEntry;
  /** Override for absolute positioning. Default = right of anchor. */
  position?: "right" | "below";
}

export function NodeTooltip({
  act,
  stepIndex,
  entry,
  position = "right",
}: NodeTooltipProps) {
  const tables = useGameI18n();
  const localeIsKor = useGameLocale() === "kor";
  const playback = serviceMessages[useServiceLocale()].historyCourse.detail.playback;
  const floor = act.baseFloor + stepIndex;
  const room = entry.rooms[0];
  const { typeLabel, nameLabel } = describeNodeForTooltip(entry, tables);

  const turns = room?.turns_taken ?? 0;
  const damage = entry.damage_taken ?? 0;
  const healed = entry.hp_healed ?? 0;
  const maxGained = entry.max_hp_gained ?? 0;
  const maxLost = entry.max_hp_lost ?? 0;
  const goldGained = entry.gold_gained ?? 0;
  const goldSpent = entry.gold_spent ?? 0;
  const goldLost = entry.gold_lost ?? 0;
  const goldStolen = entry.gold_stolen ?? 0;

  const cardsGained = (entry.cards_gained ?? []).map((c) => c.id);
  const relicPicked = (entry.relic_choices ?? []).filter((c) => c.picked).map((c) => c.id);
  const potionPicked = (entry.potion_choices ?? []).filter((c) => c.picked).map((c) => c.id);
  const potionUsed = entry.potion_used ?? [];
  const potionDiscarded = entry.potion_discarded ?? [];

  const cardSkipped = (entry.card_choices ?? [])
    .filter((c) => !c.picked)
    .map((c) => c.id);
  const relicSkipped = (entry.relic_choices ?? [])
    .filter((c) => !c.picked)
    .map((c) => c.id);
  const potionSkipped = (entry.potion_choices ?? [])
    .filter((c) => !c.picked)
    .map((c) => c.id);

  const cardRemoved = (entry.cards_removed ?? entry.cards_lost ?? []).map((c) => c.id);

  const hasRewards =
    cardsGained.length > 0 ||
    relicPicked.length > 0 ||
    potionPicked.length > 0 ||
    potionUsed.length > 0 ||
    potionDiscarded.length > 0 ||
    goldGained > 0 ||
    cardRemoved.length > 0;
  const hasSkipped =
    cardSkipped.length > 0 || relicSkipped.length > 0 || potionSkipped.length > 0;

  const positionStyle =
    position === "below"
      ? { left: "50%", top: "100%", transform: "translate(-50%, 8px)" }
      : { left: "100%", top: "50%", transform: "translate(8px, -50%)" };

  const nameOf = (table: "cards" | "relics" | "potions", id: string) =>
    localizeGame(tables, table, id) ?? id;
  const cardName = (id: string | undefined) =>
    tooltipCardLabel(id, tables, localeIsKor);

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        ...positionStyle,
        width: 280,
      }}
    >
      <div
        style={{
          borderStyle: "solid",
          borderWidth: 24,
          borderImage:
            "url('/images/sts2/ui/hover_tip.png') 24 fill / 24px / 0 stretch",
          padding: "4px 8px",
          fontSize: 12,
          lineHeight: 1.45,
          color: "#e2e8f0",
          fontWeight: 500,
        }}
      >
        <div style={{ color: "#FFD479", fontWeight: 700 }}>
          {formatGameTemplate(gameUi(tables, "floor", "Floor {FloorNum}"), {
            FloorNum: floor,
          })}
        </div>
        <div className="flex flex-wrap gap-x-3">
          {typeof entry.current_hp === "number" && (
            <span style={{ color: "#FF7A7A" }}>
              {entry.current_hp}/{entry.max_hp ?? "—"} {playback.hp}
            </span>
          )}
          {typeof entry.current_gold === "number" && (
            <span style={{ color: "#FFD479" }}>
              {entry.current_gold} {playback.gold}
            </span>
          )}
        </div>
        <div className="mt-1 text-zinc-100">
          {typeLabel}
          {nameLabel ? `: ${nameLabel}` : ""}
        </div>
        <ul className="ml-3 space-y-0.5">
          {damage > 0 && (
            <li style={{ color: "#FF7A7A" }}>
              {damage} {playback.damage}
            </li>
          )}
          {healed > 0 && (
            <li style={{ color: "#86EFAC" }}>
              {playback.heal} {healed}
            </li>
          )}
          {maxGained > 0 && (
            <li style={{ color: "#86EFAC" }}>
              {playback.verbs["max-hp-up"]} {maxGained}
            </li>
          )}
          {maxLost > 0 && (
            <li style={{ color: "#FF7A7A" }}>
              {playback.verbs["max-hp-down"]} {maxLost}
            </li>
          )}
          {goldStolen > 0 && (
            <li style={{ color: "#FF7A7A" }}>
              {formatGameTemplate(
                gameUi(tables, "goldStolen", "{Amount} Gold was stolen"),
                { Amount: goldStolen },
              )}
            </li>
          )}
          {goldLost > 0 && goldStolen === 0 && (
            <li style={{ color: "#FF7A7A" }}>
              {formatGameTemplate(
                gameUi(tables, "goldLost", "Lost {Amount} Gold"),
                { Amount: goldLost },
              )}
            </li>
          )}
          {goldSpent > 0 && (
            <li>
              {playback.goldSpent.replace("{amount}", String(goldSpent))}
            </li>
          )}
          {turns > 0 && (
            <li>{playback.turns.replace("{count}", String(turns))}</li>
          )}
          {entry.map_point_type === "ancient" &&
            (entry.relic_choices ?? []).map((c) => (
              <li key={`ac-${c.id}`}>
                {nameOf("relics", c.id)}{" "}
                {c.picked
                  ? playback.verbs["card-gained"]
                  : playback.verbs["card-skipped"]}
              </li>
            ))}
        </ul>

        {hasRewards && (
          <>
            <div className="mt-1" style={{ color: "#FFD479" }}>
              {gameUi(tables, "rewardsHeader", "Rewards:")}
            </div>
            <ul className="ml-3 space-y-0.5">
              {goldGained > 0 && (
                <li>
                  {formatGameTemplate(
                    gameUi(tables, "goldGained", "{Amount} Gold"),
                    { Amount: goldGained, Icon: "$ " },
                  )}
                </li>
              )}
              {relicPicked.map((id) => (
                <li key={`r-${id}`}>⊡ {nameOf("relics", id)}</li>
              ))}
              {cardsGained.map((id, i) => (
                <li key={`cg-${id}-${i}`}>▤ {cardName(id)}</li>
              ))}
              {potionPicked.map((id) => (
                <li key={`p-${id}`}>
                  ⊓ {nameOf("potions", id)} {playback.verbs["potion-gained"]}
                </li>
              ))}
              {potionUsed.map((id, i) => (
                <li key={`pu-${id}-${i}`}>
                  ⊓ {nameOf("potions", id)} {playback.verbs["potion-used"]}
                </li>
              ))}
              {potionDiscarded.map((id, i) => (
                <li key={`pd-${id}-${i}`}>
                  ⊓ {nameOf("potions", id)} {playback.verbs["potion-discarded"]}
                </li>
              ))}
              {cardRemoved.map((id, i) => (
                <li key={`cr-${id}-${i}`}>
                  ✕ {cardName(id)} {playback.verbs["card-removed"]}
                </li>
              ))}
            </ul>
          </>
        )}

        {hasSkipped && (
          <>
            <div className="mt-1" style={{ color: "#FFD479" }}>
              {gameUi(tables, "skippedHeader", "Skipped:")}
            </div>
            <ul className="ml-3 space-y-0.5">
              {cardSkipped.map((id, i) => (
                <li key={`cs-${id}-${i}`}>▤ {cardName(id)}</li>
              ))}
              {relicSkipped.map((id) => (
                <li key={`rs-${id}`}>⊡ {nameOf("relics", id)}</li>
              ))}
              {potionSkipped.map((id) => (
                <li key={`ps-${id}`}>⊓ {nameOf("potions", id)}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function tooltipCardLabel(
  id: string | undefined,
  tables: GameI18nTables,
  localeIsKor: boolean,
): string {
  if (!id) return "?";
  const madScienceParts = getMadScienceVariantPartsFromId(id);
  if (madScienceParts?.riderId) {
    const baseName =
      localizeGame(tables, "cards", MAD_SCIENCE_CARD_ID) ?? MAD_SCIENCE_CARD_ID;
    const rider =
      localizeGame(
        tables,
        "events",
        `TINKER_TIME.pages.CHOOSE_RIDER.options.${madScienceParts.riderId}`,
      ) ??
      (localeIsKor
        ? TINKER_RIDER_CHOICE_LABELS[madScienceParts.riderId]
        : TINKER_RIDER_CHOICE_LABELS_EN[madScienceParts.riderId]);
    return `${baseName} · ${rider}`;
  }
  return localizeGame(tables, "cards", id) ?? id;
}

function describeNodeForTooltip(
  entry: ReplayHistoryEntry,
  tables: GameI18nTables,
): {
  typeLabel: string;
  nameLabel: string | null;
} {
  const room = entry.rooms[0];
  const modelId = room?.model_id ?? null;
  const roomType = (room?.room_type ?? "").toLowerCase();
  const type = entry.map_point_type;

  const monsterName = () => localizeGame(tables, "encounters", modelId);

  if (type === "ancient") {
    return {
      typeLabel: gameUi(tables, "legendAncient", "Ancient"),
      nameLabel: localizeGame(tables, "ancients", modelId),
    };
  }
  if (type === "boss") {
    return {
      typeLabel: gameUi(tables, "legendBoss", "Boss"),
      nameLabel: monsterName(),
    };
  }
  if (type === "elite") {
    return {
      typeLabel: gameUi(tables, "legendElite", "Elite"),
      nameLabel: monsterName(),
    };
  }
  if (type === "monster") {
    return {
      typeLabel: gameUi(tables, "legendMonster", "Enemy"),
      nameLabel: monsterName(),
    };
  }
  if (type === "rest_site") {
    return { typeLabel: gameUi(tables, "legendRest", "Rest"), nameLabel: null };
  }
  if (type === "shop") {
    return {
      typeLabel: gameUi(tables, "legendShop", "Merchant"),
      nameLabel: null,
    };
  }
  if (type === "treasure") {
    return {
      typeLabel: gameUi(tables, "legendTreasure", "Treasure"),
      nameLabel: null,
    };
  }
  if (type === "unknown") {
    if (roomType === "event") {
      return {
        typeLabel: gameUi(tables, "legendEvent", "Event"),
        nameLabel: localizeGame(tables, "events", modelId),
      };
    }
    if (roomType === "monster") {
      return {
        typeLabel: gameUi(tables, "legendMonster", "Enemy"),
        nameLabel: monsterName(),
      };
    }
    if (roomType === "shop") {
      return {
        typeLabel: gameUi(tables, "legendShop", "Merchant"),
        nameLabel: null,
      };
    }
    if (roomType === "treasure") {
      return {
        typeLabel: gameUi(tables, "legendTreasure", "Treasure"),
        nameLabel: null,
      };
    }
    if (roomType === "rest_site") {
      return { typeLabel: gameUi(tables, "legendRest", "Rest"), nameLabel: null };
    }
  }
  return { typeLabel: "?", nameLabel: null };
}
