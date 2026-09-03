export const PAGESTORM_HREF = "/pagestorm";
export const PAGESTORM_WRITE_HREF = "/pagestorm/write";
export const PAGESTORM_LOREM_HREF = "/pagestorm/lorem";
export const PAGESTORM_TOKEN_SRC = "/images/sts2/powers/pagestorm_power.webp";
export const PAGESTORM_BACKGROUND_SRC = "/images/sts2/cards/pagestorm.webp";
export const PAGESTORM_TABLE = "pagestorm_posts";
export const PAGESTORM_TITLE_MIN_CHARS = 1;
export const PAGESTORM_TITLE_MAX_CHARS = 80;
export const PAGESTORM_BODY_MIN_CHARS = 1;
export const PAGESTORM_BODY_MAX_CHARS = 8000;
export const PAGESTORM_SNIPPET_CHARS = 160;
export const PAGESTORM_LOREM_SNIPPET =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

export type PagestormDocNode = {
  type?: string;
  text?: string;
  content?: PagestormDocNode[];
  attrs?: Record<string, unknown>;
  marks?: unknown[];
};

export type PagestormDoc = {
  type: "doc";
  content?: PagestormDocNode[];
};

export type PagestormPost = {
  id: string;
  user_id: string;
  nickname: string;
  title: string;
  content: PagestormDoc;
  content_text: string;
  env: string;
  created_at: string;
};

export type PagestormPostCard = Omit<PagestormPost, "content">;

export function pagestormContentText(node: PagestormDocNode | null | undefined): string {
  if (!node) return "";
  const parts: string[] = [];
  const walk = (current: PagestormDocNode) => {
    if (current.text) parts.push(current.text);
    current.content?.forEach(walk);
  };
  walk(node);
  return parts.join("").replace(/\s+/g, " ").trim();
}

export function pagestormSnippet(text: string, max = PAGESTORM_SNIPPET_CHARS): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 3))}...`;
}

export function isPagestormDoc(value: unknown): value is PagestormDoc {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (value as PagestormDoc).type === "doc";
}

export function normalizePagestormPost(row: unknown): PagestormPost {
  const record = row as Record<string, unknown>;
  const content = isPagestormDoc(record.content)
    ? record.content
    : { type: "doc", content: [{ type: "paragraph" }] };
  return {
    id: String(record.id ?? ""),
    user_id: String(record.user_id ?? ""),
    nickname: String(record.nickname ?? ""),
    title: String(record.title ?? ""),
    content,
    content_text: String(record.content_text ?? pagestormContentText(content)),
    env: String(record.env ?? ""),
    created_at: String(record.created_at ?? ""),
  };
}

export function normalizePagestormPostCard(row: unknown): PagestormPostCard {
  const post = normalizePagestormPost({
    ...(row as Record<string, unknown>),
    content: { type: "doc" },
  });
  return {
    id: post.id,
    user_id: post.user_id,
    nickname: post.nickname,
    title: post.title,
    content_text: post.content_text,
    env: post.env,
    created_at: post.created_at,
  };
}

export function pagestormDetailHref(postId: string): string {
  return `${PAGESTORM_HREF}/${postId}`;
}
