import type { EntityType } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";

export interface ComboResourceRef {
  type: EntityType;
  id: string;
}

export interface ComboPost {
  id: string;
  user_id: string;
  nickname: string;
  content: PostBlock[];
  content_text: string;
  resources: ComboResourceRef[];
  env: string;
  created_at: string;
}

export function comboResourceKey(resource: ComboResourceRef): string {
  return `${resource.type}:${resource.id}`;
}

export function extractComboResourceRefs(blocks: PostBlock[]): ComboResourceRef[] {
  const resources: ComboResourceRef[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    let resource: ComboResourceRef | null = null;
    if (block.type === "entity") {
      resource = { type: block.entityType, id: block.entityId };
    } else if (block.type === "keyword" && block.entityId && block.entityType) {
      resource = { type: block.entityType, id: block.entityId };
    }
    if (!resource) continue;

    const key = comboResourceKey(resource);
    if (seen.has(key)) continue;

    seen.add(key);
    resources.push(resource);
  }

  return resources;
}
