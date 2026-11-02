/** The database refused the row, so sending it again unchanged cannot succeed. */
export function isDatabaseRejection(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "42501" || (typeof code === "string" && code.startsWith("23"));
}

export type DefragmentSubmitOutcome<TPost> =
  | { kind: "overlay-invalid" }
  | { kind: "post-failed"; rejected: boolean }
  // The post exists. Sending it again would duplicate it, so only the overlay is retried.
  | { kind: "overlay-failed"; post: TPost; activeUserId: string; rejected: boolean }
  | { kind: "saved"; post: TPost };

/**
 * One write panel submit: check the overlay, save the post, save its overlay.
 * Every failure comes back as an outcome so the panel can keep the writer's
 * text and say which step failed.
 */
export async function submitDefragmentPost<TPost>({
  overlayInvalid,
  resolveUserId,
  insertPost,
  saveOverlay,
}: {
  overlayInvalid: boolean;
  resolveUserId: () => Promise<string | null>;
  insertPost: (activeUserId: string) => Promise<TPost | null>;
  saveOverlay: (post: TPost, activeUserId: string) => Promise<void>;
}): Promise<DefragmentSubmitOutcome<TPost>> {
  if (overlayInvalid) return { kind: "overlay-invalid" };

  let activeUserId: string | null;
  let post: TPost | null;
  try {
    activeUserId = await resolveUserId();
    if (!activeUserId) return { kind: "post-failed", rejected: false };
    post = await insertPost(activeUserId);
  } catch (error) {
    return { kind: "post-failed", rejected: isDatabaseRejection(error) };
  }
  // The insert helpers return null for a post they refuse to send.
  if (!post) return { kind: "post-failed", rejected: true };

  try {
    await saveOverlay(post, activeUserId);
  } catch (error) {
    return {
      kind: "overlay-failed",
      post,
      activeUserId,
      rejected: isDatabaseRejection(error),
    };
  }
  return { kind: "saved", post };
}
