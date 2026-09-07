import type { Sts1Card, Sts1CardStats } from "./types";

export function sts1CardStats(card: Sts1Card, upgradeLevel = 0): Sts1CardStats {
  const level = Math.max(0, upgradeLevel);
  const stats: Sts1CardStats = {
    cost: card.cost,
    damage: card.damage,
    block: card.block,
    magic: card.magic,
    exhaust: card.exhaust,
    ethereal: card.ethereal,
    innate: card.innate,
    retain: card.retain,
    nameSuffix: "",
    upgraded: level > 0,
  };

  if (level <= 0 || !card.upgrade) return stats;

  const upgrade = card.upgrade;
  if (card.unlimitedUpgrade && upgrade.damageScalesWithTimesUpgraded) {
    const base = upgrade.damage ?? 4;
    let damage = card.damage ?? 0;
    for (let step = 0; step < level; step += 1) {
      damage += base + step;
    }
    stats.damage = damage;
    stats.nameSuffix = `+${level}`;
    return stats;
  }

  if (upgrade.damage != null && stats.damage != null) stats.damage += upgrade.damage;
  if (upgrade.block != null && stats.block != null) stats.block += upgrade.block;
  if (upgrade.magic != null && stats.magic != null) stats.magic += upgrade.magic;
  if (upgrade.cost != null) stats.cost = upgrade.cost;
  if (upgrade.exhaust) stats.exhaust = true;
  if (upgrade.innate) stats.innate = true;
  if (upgrade.ethereal) stats.ethereal = true;
  if (upgrade.retain) stats.retain = true;
  stats.nameSuffix = "+";
  return stats;
}

export function sts1CostLabel(cost: number): string {
  if (cost === -1) return "X";
  if (cost === -2) return "";
  return String(cost);
}

export function sts1MatchesCostFilter(cost: number, selected: Set<string>): boolean {
  if (selected.size === 0) return true;
  if (cost === -1) return selected.has("X");
  if (cost >= 4) return selected.has("3+");
  return selected.has(String(cost));
}
