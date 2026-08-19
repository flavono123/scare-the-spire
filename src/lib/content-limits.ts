/** Visible comment length. Rich storage text can be longer; see COMMENT_STORAGE_MAX_CHARS. */
export const COMMENT_MIN_CHARS = 2;
export const COMMENT_MAX_CHARS = 200;

/**
 * `comments.content` headroom for mention/keyword encoding beyond the
 * visible 200-character limit.
 */
export const COMMENT_STORAGE_MAX_CHARS = 2000;

export const CHEMICAL_POST_MIN_CHARS = 2;
export const CHEMICAL_POST_MAX_CHARS = 30;

/** Remaining characters at which the counter turns warning yellow. */
export function charCountWarnRemaining(maxChars: number): number {
  return Math.max(5, Math.ceil(maxChars * 0.1));
}

export function isCharCountNearLimit(charCount: number, maxChars: number): boolean {
  return charCount >= maxChars - charCountWarnRemaining(maxChars);
}
