import { isUuid } from "@/lib/engagement-keys";

const COMMUNITY_STORY_ID_PREFIX = "community:";

/** `/stories/<slug>` for a static story, `/stories/<uuid>` for a community one. */
export function storyHref(storyId: string): string {
  const segment = storyId.startsWith(COMMUNITY_STORY_ID_PREFIX)
    ? storyId.slice(COMMUNITY_STORY_ID_PREFIX.length)
    : storyId;
  return `/stories/${segment}`;
}

/** The story id (comment thread key) a `/stories/<segment>` path names. */
export function storyIdFromPathSegment(segment: string): string {
  return isUuid(segment) ? `${COMMUNITY_STORY_ID_PREFIX}${segment.toLowerCase()}` : segment;
}
