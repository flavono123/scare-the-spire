/**
 * The stories group's columns and rules (docs/supabase-exit/STEP1_DESIGN.md 9.7),
 * shared by use-community-stories.ts, the patch static client's composer and the
 * Worker. No imports: the Worker bundle uses it. Mirrors community_stories' CHECKs.
 */

export const STORY_COLUMNS =
  "id,user_id,static_story_id,nickname,sentence,game,entity_type,entity_id,change_id,patch_line_id,source,tags,linked_entities,created_at,env,avatar_id,avatar_kind,palette_id,palette_swapped";

/** The page sizes in use: the home feed, a patch page, /patches/changes. */
export const STORY_LIMITS = [100, 200, 1000] as const;

const SOURCE = /^[A-Za-z0-9._-]{1,64}$/;
const REF = /^[A-Za-z0-9._:-]{1,256}$/;
const LINKED_MAX_BYTES = 128 * 1024;
const AUTHOR_FIELD_MAX = 64;

export function isStoryLimit(value: string): boolean {
  return (STORY_LIMITS as readonly number[]).includes(Number(value)) && /^\d+$/.test(value);
}

export function isStorySource(value: string): boolean {
  return SOURCE.test(value);
}

export type StoryInsertRow = {
  nickname: string;
  sentence: string;
  game: "sts2";
  entity_type: string | null;
  entity_id: string | null;
  patch_line_id: string;
  source: string;
  tags: [];
  linked_entities: { entityType: string; entityId: string; label?: string }[];
  avatar_id?: string | null;
  avatar_kind?: string | null;
  palette_id?: string | null;
  palette_swapped?: boolean | null;
};

function optionalRef(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "string" && REF.test(value) ? value : undefined;
}

/** The row to insert (without user_id and env, which the Worker sets), or null when a rule fails. */
export function storyInsertRow(input: Record<string, unknown>): StoryInsertRow | null {
  if (typeof input.sentence !== "string" || typeof input.nickname !== "string") return null;
  const sentence = input.sentence.trim();
  const nickname = input.nickname.trim();
  const sentenceLength = Array.from(sentence).length;
  const nicknameLength = Array.from(nickname).length;
  if (sentenceLength < 2 || sentenceLength > 120 || nicknameLength < 1 || nicknameLength > 20) return null;
  const entityType = optionalRef(input.entityType);
  const entityId = optionalRef(input.entityId);
  if (entityType === undefined || entityId === undefined) return null;
  if (typeof input.patchLineId !== "string" || !REF.test(input.patchLineId)) return null;
  if (typeof input.source !== "string" || !SOURCE.test(input.source)) return null;
  if (!Array.isArray(input.linkedEntities)) return null;
  const linked: StoryInsertRow["linked_entities"] = [];
  for (const item of input.linkedEntities) {
    if (!item || typeof item !== "object") return null;
    const entry = item as Record<string, unknown>;
    if (typeof entry.entityType !== "string" || typeof entry.entityId !== "string") return null;
    if (entry.label !== undefined && typeof entry.label !== "string") return null;
    linked.push({
      entityType: entry.entityType,
      entityId: entry.entityId,
      ...(typeof entry.label === "string" ? { label: entry.label } : {}),
    });
  }
  if (new TextEncoder().encode(JSON.stringify(linked)).byteLength > LINKED_MAX_BYTES) return null;

  const row: StoryInsertRow = {
    nickname,
    sentence,
    game: "sts2",
    entity_type: entityType,
    entity_id: entityId,
    patch_line_id: input.patchLineId,
    source: input.source,
    tags: [],
    linked_entities: linked,
  };
  const author = input.author;
  if (author !== undefined) {
    if (!author || typeof author !== "object" || Array.isArray(author)) return null;
    const token = author as Record<string, unknown>;
    for (const [from, to] of [["avatarId", "avatar_id"], ["avatarKind", "avatar_kind"], ["paletteId", "palette_id"]] as const) {
      const value = token[from];
      if (value !== null && value !== undefined && (typeof value !== "string" || value.length > AUTHOR_FIELD_MAX)) return null;
      if (value !== undefined) row[to] = value as string | null;
    }
    const swapped = token.paletteSwapped;
    if (swapped !== undefined && swapped !== null && typeof swapped !== "boolean") return null;
    if (swapped !== undefined) row.palette_swapped = swapped as boolean | null;
  }
  return row;
}
