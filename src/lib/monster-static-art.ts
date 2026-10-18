import { compareVersions } from "./entity-versioning";

/**
 * Monsters whose art in older builds was a still image, not a Spine skeleton.
 *
 * Each era says which still the game shows for each move (verified against the
 * archived builds, see AGENTS.md "STS2 구 빌드 아카이브"):
 * - Doormaker never had a skeleton. `doormaker.tscn` starts on placeholder 1
 *   and each move swaps the sprite for the *next* move
 *   (`Doormaker.UpdateVisual(...)`), so the still for a move is the one set by
 *   the move before it in the move graph.
 * - Skulking Colony only got its Spine animation in v0.104.0; before that
 *   `skulking_colony.tscn` held `images/monsters/skulkling_colomy.png`.
 */
export interface MonsterStaticArtEra {
  /** First build of the era (inclusive). Omitted = from the first build. */
  from?: string;
  /** First build after the era (exclusive). Omitted = still in use. */
  until?: string;
  defaultImage: string;
  byMove?: Record<string, string>;
}

export interface MonsterStaticArt {
  defaultImage: string;
  byMove: Record<string, string>;
}

const DOORMAKER = (n: 1 | 2 | 3 | 4) => `/images/sts2/monsters-beta/doormaker_placeholder_${n}.webp`;

const MONSTER_STATIC_ART: Record<string, MonsterStaticArtEra[]> = {
  DOORMAKER: [
    {
      // v0.98.0-v0.99.1: the scene starts on placeholder 4. Later door revivals
      // rotate 2 -> 3 -> 4 by revival count, so the first cycle is shown.
      until: "0.100.0",
      defaultImage: DOORMAKER(4),
      byMove: { WHAT_IS_IT: DOORMAKER(4), BEAM: DOORMAKER(4), GET_BACK_IN: DOORMAKER(4) },
    },
    {
      from: "0.100.0",
      until: "0.101.0",
      defaultImage: DOORMAKER(1),
      byMove: { DRAMATIC_OPEN: DOORMAKER(1), BEAM: DOORMAKER(2), CHOMP: DOORMAKER(3), PULVERIZE: DOORMAKER(4) },
    },
    {
      // v0.101.0 until the boss was removed from the pool in v0.105.0 (kept as the
      // latest look for the deprecated monster).
      from: "0.101.0",
      defaultImage: DOORMAKER(1),
      byMove: { DRAMATIC_OPEN: DOORMAKER(1), HUNGER: DOORMAKER(3), SCRUTINY: DOORMAKER(2), GRASP: DOORMAKER(4) },
    },
  ],
  SKULKING_COLONY: [
    { until: "0.104.0", defaultImage: "/images/sts2/monsters-beta/skulking_colony_static.webp" },
  ],
};

/**
 * Still art for `monsterId` in `version` ("0.100.0" or "v0.100.0"), or null when
 * the monster is drawn with its Spine skeleton there. No version = current.
 */
export function resolveMonsterStaticArt(monsterId: string, version?: string | null): MonsterStaticArt | null {
  const eras = MONSTER_STATIC_ART[monsterId.toUpperCase()];
  if (!eras) return null;
  const era = eras.find((candidate) => (
    (!candidate.from || !version || compareVersions(version, candidate.from) >= 0)
    && (!candidate.until || (version != null && compareVersions(version, candidate.until) < 0))
  ));
  if (!era) return null;
  // Doormaker's last era has no end, so "current" (no version) lands on it; the
  // Skulking era has an end and is skipped for "current".
  return { defaultImage: era.defaultImage, byMove: era.byMove ?? {} };
}
