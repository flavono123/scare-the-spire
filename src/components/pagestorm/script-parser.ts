import type { JSONContent } from "@tiptap/core";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { parseYouTubeVideoId } from "@/lib/youtube-reference";
import { PAGESTORM_ASSET_ROW } from "./asset-layout";
import { assetFromEntity } from "./sample";
import { gameAssetAttrs } from "./tiptap-nodes";

export type ParsedPagestormScript = {
  title?: string;
  nickname?: string;
  nodes: JSONContent[];
};

export type ParsedPagestormJson = {
  title?: string;
  nickname?: string;
  doc: JSONContent;
};

function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_]+/g, " ");
}

function cleanTagPrefix(tag: string): string {
  return tag
    .replace(/^(?:이야기|스토리|에포크|일반\s*짤|자작\s*카드|전투\s*화면|덱\s*확인\s*화면|휴식\s*장소\s*화면|보스\s*보상\s*카드\s*선택|이벤트\s*화면|리젠트\s*자원\s*툴팁|상점\s*화면):\s*/i, "")
    .trim();
}

export function findEntityByQuery(
  rawQuery: string,
  entities: readonly EntityInfo[],
): EntityInfo | undefined {
  const query = rawQuery.trim();
  if (!query) return undefined;

  const normalized = normalizeQuery(query);

  // 1. Exact match by nameKo, aliases, or id
  const exact = entities.find((entity) => {
    if (normalizeQuery(entity.nameKo) === normalized) return true;
    if (normalizeQuery(entity.id) === normalized) return true;
    if (entity.nameEn && normalizeQuery(entity.nameEn) === normalized) return true;
    return entity.aliasesKo?.some((alias) => normalizeQuery(alias) === normalized);
  });
  if (exact) return exact;

  // 2. Cleaned prefix match
  const cleaned = cleanTagPrefix(query);
  if (cleaned && cleaned !== query) {
    const cleanedNormalized = normalizeQuery(cleaned);
    const cleanedMatch = entities.find((entity) => {
      if (normalizeQuery(entity.nameKo) === cleanedNormalized) return true;
      if (normalizeQuery(entity.id) === cleanedNormalized) return true;
      return entity.aliasesKo?.some((alias) => normalizeQuery(alias) === cleanedNormalized);
    });
    if (cleanedMatch) return cleanedMatch;
  }

  // 3. Epoch story title match (e.g. '리젠트 1장 - 불만' -> REGENT6_EPOCH '불만')
  const epoch = entities.find((entity) => {
    if (entity.type !== "epoch") return false;
    const epochName = entity.nameKo.trim();
    if (!epochName) return false;
    return query.includes(epochName);
  });
  if (epoch) return epoch;

  // 4. Cleaned trailing punctuation/plus (e.g. '군주의 칼날+' -> '군주의 칼날')
  const strippedPlus = cleaned.replace(/\++$/, "").trim();
  if (strippedPlus && strippedPlus !== cleaned) {
    const plusNormalized = normalizeQuery(strippedPlus);
    const plusMatch = entities.find((entity) => {
      if (normalizeQuery(entity.nameKo) === plusNormalized) return true;
      return entity.aliasesKo?.some((alias) => normalizeQuery(alias) === plusNormalized);
    });
    if (plusMatch) return plusMatch;
  }

  return undefined;
}

export function parsePagestormJson(raw: string): ParsedPagestormJson | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;

    const title = typeof parsed.title === "string" ? parsed.title.trim() : undefined;
    const nickname = typeof parsed.nickname === "string" ? parsed.nickname.trim() : undefined;

    if (parsed.type === "doc" && Array.isArray(parsed.content)) {
      return { title, nickname, doc: parsed as unknown as JSONContent };
    }

    if (parsed.content && typeof parsed.content === "object") {
      const contentObj = parsed.content as Record<string, unknown>;
      if (contentObj.type === "doc" && Array.isArray(contentObj.content)) {
        return { title, nickname, doc: contentObj as unknown as JSONContent };
      }
    }

    if (Array.isArray(parsed.content)) {
      return {
        title,
        nickname,
        doc: {
          type: "doc",
          content: parsed.content as JSONContent[],
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function isPagestormScriptText(text: string): boolean {
  return text.includes("<") && text.includes(">") && text.includes("{") && text.includes("}");
}

export function parsePagestormScript(
  text: string,
  entities: readonly EntityInfo[],
): ParsedPagestormScript | null {
  if (!isPagestormScriptText(text)) return null;

  const lines = text.split(/\r?\n/);
  let title: string | undefined;
  let nickname: string | undefined;
  const nodes: JSONContent[] = [];

  let lineIdx = 0;

  // 1. Header parsing (title, author, youtube link)
  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx];
    if (rawLine === undefined) break;
    const line = rawLine.trim();
    if (!line) {
      lineIdx += 1;
      continue;
    }

    if (line.startsWith("#")) {
      title = line.replace(/^#+\s*/, "").trim();
      lineIdx += 1;
      continue;
    }

    const titleMatch = line.match(/^(?:title|제목):\s*(.+)$/i);
    if (titleMatch?.[1]) {
      title = titleMatch[1].trim();
      lineIdx += 1;
      continue;
    }

    const authorMatch = line.match(/^(?:author|nickname|작성자|닉네임):\s*(.+)$/i);
    if (authorMatch?.[1]) {
      nickname = authorMatch[1].trim();
      lineIdx += 1;
      continue;
    }

    const videoId = parseYouTubeVideoId(line);
    if (videoId) {
      nodes.push({
        type: "youtubePlayer",
        attrs: {
          videoId,
          title: "YouTube",
          align: "center",
        },
      });
      nodes.push({ type: "paragraph" });
      lineIdx += 1;
      continue;
    }

    // Stop header parsing when hitting script tags
    if (line.startsWith("<") || line.startsWith("{")) {
      break;
    }

    lineIdx += 1;
  }

  // 2. Block parsing: <tag> followed by {dialogue}
  let currentTag: string | null = null;
  let currentDialogues: string[] = [];

  function flushBlock() {
    if (!currentTag && currentDialogues.length === 0) return;

    if (currentTag) {
      const tagContent = currentTag.trim();
      const parts = tagContent.split(",").map((part) => part.trim()).filter(Boolean);

      if (parts.length > 1) {
        // Multi-asset row
        const resolvedEntities: EntityInfo[] = [];
        for (const part of parts) {
          const entity = findEntityByQuery(part, entities);
          if (entity) resolvedEntities.push(entity);
        }

        if (resolvedEntities.length >= 2) {
          // TipTap assetRow supports at most 2 items per row
          const pairs: EntityInfo[][] = [];
          for (let i = 0; i < resolvedEntities.length; i += 2) {
            pairs.push(resolvedEntities.slice(i, i + 2));
          }

          for (const pair of pairs) {
            if (pair.length === 2) {
              nodes.push({
                type: PAGESTORM_ASSET_ROW,
                content: pair.map((entity) => ({
                  type: "gameAsset",
                  attrs: gameAssetAttrs(assetFromEntity(entity), {
                    presentation: entity.type === "card" ? "tile" : "art",
                    beta: false,
                  }),
                })),
              });
            } else if (pair[0]) {
              nodes.push({
                type: "gameAsset",
                attrs: gameAssetAttrs(assetFromEntity(pair[0]), {
                  presentation: pair[0].type === "card" ? "tile" : "art",
                  beta: false,
                }),
              });
            }
          }
        } else if (resolvedEntities[0]) {
          nodes.push({
            type: "gameAsset",
            attrs: gameAssetAttrs(assetFromEntity(resolvedEntities[0]), {
              presentation: resolvedEntities[0].type === "card" ? "tile" : "art",
              beta: false,
            }),
          });
        } else {
          // Fallback label for unresolvable multi-item tags
          nodes.push({
            type: "paragraph",
            attrs: { textAlign: "center" },
            content: [
              {
                type: "text",
                marks: [
                  { type: "bold" },
                  { type: "pagestormColor", attrs: { colorKey: "spire-gold" } },
                ],
                text: `[${tagContent}]`,
              },
            ],
          });
        }
      } else {
        // Single asset tag
        const entity = findEntityByQuery(tagContent, entities);
        if (entity) {
          nodes.push({
            type: "gameAsset",
            attrs: gameAssetAttrs(assetFromEntity(entity), {
              presentation: entity.type === "card" ? "tile" : "art",
              beta: false,
            }),
          });
        } else {
          // Label paragraph for scene descriptions, memes, or untracked assets
          nodes.push({
            type: "paragraph",
            attrs: { textAlign: "center" },
            content: [
              {
                type: "text",
                marks: [
                  { type: "bold" },
                  { type: "pagestormColor", attrs: { colorKey: "spire-gold" } },
                ],
                text: `[${tagContent}]`,
              },
            ],
          });
        }
      }
    }

    if (currentDialogues.length > 0) {
      const dialogueText = currentDialogues.join(" ").replace(/\s+/g, " ").trim();
      if (dialogueText) {
        nodes.push({
          type: "paragraph",
          content: [
            {
              type: "text",
              text: dialogueText,
            },
          ],
        });
      }
    }

    currentTag = null;
    currentDialogues = [];
  }

  for (; lineIdx < lines.length; lineIdx += 1) {
    const rawLine = lines[lineIdx];
    if (rawLine === undefined) continue;
    const line = rawLine.trim();
    if (!line) continue;

    const tagMatch = line.match(/^<([^>]+)>$/);
    if (tagMatch?.[1]) {
      flushBlock();
      currentTag = tagMatch[1];
      continue;
    }

    const braceMatch = line.match(/^\{([^}]+)\}$/);
    if (braceMatch?.[1]) {
      currentDialogues.push(braceMatch[1].trim());
      continue;
    }

    // Unwrapped plain text line under a block
    if (line.length > 0 && !line.startsWith("<")) {
      currentDialogues.push(line);
    }
  }

  flushBlock();

  if (nodes.length === 0) return null;

  return {
    title,
    nickname,
    nodes,
  };
}
