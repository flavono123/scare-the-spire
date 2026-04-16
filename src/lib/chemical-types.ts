import type { EntityType } from "@/components/patch-note-renderer";

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

export type PostBlock = TextBlock | EntityBlock | KeywordBlock;

export interface ChemicalPost {
  id: string;
  user_id: string;
  nickname: string;
  content: PostBlock[];
  content_text: string;
  env: string;
  created_at: string;
}
