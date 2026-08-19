import type { EntityType } from "@/components/patch-note-renderer";
import type { CoverSpec } from "@/lib/run-cover-types";

/** A segment of plain text */
export interface TextBlock {
  type: "text";
  text: string;
}

/** A reference to a game entity (card, relic, potion, etc.) */
export interface EntityBlock {
  type: "entity";
  entityId: string;
  entityType: EntityType;
  displayText: string;
}

/** A user-defined keyword with custom description tooltip */
export interface KeywordBlock {
  type: "keyword";
  text: string;
  keyword?: string;
  description: string;
  entityId?: string;
  entityType?: EntityType;
}

/** In-description energy / Regent star cost icons (Transfigure authoring). */
export interface CostTokenBlock {
  type: "cost-token";
  kind: "energy" | "star";
  count: number;
}

/** A normalized YouTube video reference resolved while composing a Combo post */
export interface YouTubeBlock {
  type: "youtube";
  videoId: string;
  title: string;
}

/** Stable display metadata captured when a History Course run is referenced. */
export interface HistoryRunReferenceSnapshot {
  title?: string | null;
  character: string;
  startTime: number | null;
  ascension: number;
  win: boolean;
  totalFloors: number;
  runTime: number | null;
  build: string;
  seed: string;
  /** Optional YouTube-style cover captured at reference time. */
  coverSpec?: CoverSpec | null;
}

/**
 * A reference to a publicly shared History Course run.
 *
 * `runId` remains the identity and link target. The snapshot keeps an existing
 * Combo readable if the shared run is later removed.
 */
export interface HistoryRunBlock {
  type: "history-run";
  runId: string;
  snapshot: HistoryRunReferenceSnapshot;
}

export type PostBlock =
  | TextBlock
  | EntityBlock
  | KeywordBlock
  | CostTokenBlock
  | YouTubeBlock
  | HistoryRunBlock;

export interface ChemicalPost {
  id: string;
  user_id: string;
  nickname: string;
  content: PostBlock[];
  content_text: string;
  env: string;
  created_at: string;
  like_count?: number;
  comment_count?: number;
}
