"use client";

import { localize, localizeAny } from "@/lib/sts2-i18n";
import type {
  ReplayActAnalysis,
  ReplayHistoryEntry,
} from "@/lib/sts2-run-replay";

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
  const floor = act.baseFloor + stepIndex;
  const room = entry.rooms[0];
  const { typeLabel, nameLabel } = describeNodeForTooltip(entry);

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
    goldGained > 0 ||
    cardRemoved.length > 0;
  const hasSkipped =
    cardSkipped.length > 0 || relicSkipped.length > 0 || potionSkipped.length > 0;

  const positionStyle =
    position === "below"
      ? { left: "50%", top: "100%", transform: "translate(-50%, 8px)" }
      : { left: "100%", top: "50%", transform: "translate(8px, -50%)" };

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
        <div style={{ color: "#FFD479", fontWeight: 700 }}>{floor}층</div>
        <div className="flex flex-wrap gap-x-3">
          {typeof entry.current_hp === "number" && (
            <span style={{ color: "#FF7A7A" }}>
              {entry.current_hp}/{entry.max_hp ?? "—"} 체력
            </span>
          )}
          {typeof entry.current_gold === "number" && (
            <span style={{ color: "#FFD479" }}>{entry.current_gold}골드</span>
          )}
        </div>
        <div className="mt-1 text-zinc-100">
          {typeLabel}
          {nameLabel ? `: ${nameLabel}` : ""}
        </div>
        <ul className="ml-3 space-y-0.5">
          {damage > 0 && <li style={{ color: "#FF7A7A" }}>{damage} 피해</li>}
          {healed > 0 && <li style={{ color: "#86EFAC" }}>체력 {healed} 회복</li>}
          {maxGained > 0 && (
            <li style={{ color: "#86EFAC" }}>최대 체력 {maxGained} 획득</li>
          )}
          {maxLost > 0 && <li style={{ color: "#FF7A7A" }}>최대 체력 {maxLost} 손실</li>}
          {goldStolen > 0 && (
            <li style={{ color: "#FF7A7A" }}>{goldStolen} 골드 도난</li>
          )}
          {goldLost > 0 && goldStolen === 0 && (
            <li style={{ color: "#FF7A7A" }}>{goldLost} 골드 손실</li>
          )}
          {goldSpent > 0 && <li>{goldSpent} 골드 소모</li>}
          {turns > 0 && <li>{turns}턴</li>}
          {entry.map_point_type === "ancient" &&
            (entry.relic_choices ?? []).map((c) => (
              <li key={`ac-${c.id}`}>
                {localize("relics", c.id) ?? c.id}{" "}
                {c.picked ? "선택" : "건너뜀"}
              </li>
            ))}
        </ul>

        {hasRewards && (
          <>
            <div className="mt-1" style={{ color: "#FFD479" }}>
              보상:
            </div>
            <ul className="ml-3 space-y-0.5">
              {goldGained > 0 && <li>$ {goldGained} 골드</li>}
              {relicPicked.map((id) => (
                <li key={`r-${id}`}>⊡ {localize("relics", id) ?? id}</li>
              ))}
              {cardsGained.map((id, i) => (
                <li key={`cg-${id}-${i}`}>▤ {localize("cards", id) ?? id}</li>
              ))}
              {potionPicked.map((id) => (
                <li key={`p-${id}`}>⊓ {localize("potions", id) ?? id}</li>
              ))}
              {cardRemoved.map((id, i) => (
                <li key={`cr-${id}-${i}`}>✕ {localize("cards", id) ?? id} 제거</li>
              ))}
            </ul>
          </>
        )}

        {hasSkipped && (
          <>
            <div className="mt-1" style={{ color: "#FFD479" }}>
              건너뜀:
            </div>
            <ul className="ml-3 space-y-0.5">
              {cardSkipped.map((id, i) => (
                <li key={`cs-${id}-${i}`}>▤ {localize("cards", id) ?? id}</li>
              ))}
              {relicSkipped.map((id) => (
                <li key={`rs-${id}`}>⊡ {localize("relics", id) ?? id}</li>
              ))}
              {potionSkipped.map((id) => (
                <li key={`ps-${id}`}>⊓ {localize("potions", id) ?? id}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function describeNodeForTooltip(entry: ReplayHistoryEntry): {
  typeLabel: string;
  nameLabel: string | null;
} {
  const room = entry.rooms[0];
  const modelId = room?.model_id ?? null;
  const roomType = (room?.room_type ?? "").toLowerCase();
  const type = entry.map_point_type;

  const monsterName = () => localizeAny(modelId, ["encounters"]) || null;

  if (type === "ancient") {
    return { typeLabel: "고대의 존재", nameLabel: localize("ancients", modelId) };
  }
  if (type === "boss") {
    return { typeLabel: "보스", nameLabel: monsterName() };
  }
  if (type === "elite") {
    return { typeLabel: "엘리트", nameLabel: monsterName() };
  }
  if (type === "monster") {
    return { typeLabel: "적", nameLabel: monsterName() };
  }
  if (type === "rest_site") {
    return { typeLabel: "휴식 장소", nameLabel: null };
  }
  if (type === "shop") {
    return { typeLabel: "상점", nameLabel: null };
  }
  if (type === "treasure") {
    return { typeLabel: "보물 방", nameLabel: null };
  }
  if (type === "unknown") {
    if (roomType === "event") {
      return { typeLabel: "이벤트", nameLabel: localize("events", modelId) };
    }
    if (roomType === "monster") {
      return { typeLabel: "적", nameLabel: monsterName() };
    }
    if (roomType === "shop") {
      return { typeLabel: "상점", nameLabel: null };
    }
    if (roomType === "treasure") {
      return { typeLabel: "보물 방", nameLabel: null };
    }
    if (roomType === "rest_site") {
      return { typeLabel: "휴식 장소", nameLabel: null };
    }
  }
  return { typeLabel: "?", nameLabel: null };
}
