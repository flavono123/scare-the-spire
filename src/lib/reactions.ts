export const STORY_REACTIONS = [
  {
    type: "exclamation",
    labelKo: "놀람",
    labelEn: "Exclamation",
    asset: "/images/sts2/ui/emote/exclaim.png",
  },
  {
    type: "skull",
    labelKo: "해골",
    labelEn: "Skull",
    asset: "/images/sts2/ui/emote/skull.png",
  },
  {
    type: "thumb_down",
    labelKo: "별로",
    labelEn: "Thumb down",
    asset: "/images/sts2/ui/emote/thumb_down.png",
  },
  {
    type: "sad_slime",
    labelKo: "슬라임",
    labelEn: "Sad slime",
    asset: "/images/sts2/ui/emote/slime_sad.png",
  },
  {
    type: "question_mark",
    labelKo: "궁금",
    labelEn: "Question",
    asset: "/images/sts2/ui/emote/question.png",
  },
  {
    type: "heart",
    labelKo: "하트",
    labelEn: "Heart",
    asset: "/images/sts2/ui/emote/heart.png",
  },
  {
    type: "thumb_up",
    labelKo: "좋아요",
    labelEn: "Thumb up",
    asset: "/images/sts2/ui/emote/thumb_up.png",
  },
  {
    type: "happy_cultist",
    labelKo: "컬티스트",
    labelEn: "Happy cultist",
    asset: "/images/sts2/ui/emote/happy_cultist.png",
  },
] as const;

export type StoryReactionType = (typeof STORY_REACTIONS)[number]["type"];

export type StoryReactionCounts = Partial<Record<StoryReactionType, number>>;

export const DEFAULT_STORY_REACTION: StoryReactionType = "thumb_up";

const STORY_REACTION_TYPES = new Set<string>(STORY_REACTIONS.map((reaction) => reaction.type));

export function isStoryReactionType(value: unknown): value is StoryReactionType {
  return typeof value === "string" && STORY_REACTION_TYPES.has(value);
}

export function storyReactionByType(type: StoryReactionType) {
  return STORY_REACTIONS.find((reaction) => reaction.type === type) ?? STORY_REACTIONS[6];
}

export function storyReactionTotal(counts: StoryReactionCounts): number {
  return STORY_REACTIONS.reduce((total, reaction) => total + Math.max(0, counts[reaction.type] ?? 0), 0);
}

export function mergeStoryReactionCounts(
  base: StoryReactionCounts,
  delta: StoryReactionCounts,
): StoryReactionCounts {
  const merged: StoryReactionCounts = {};
  for (const reaction of STORY_REACTIONS) {
    const count = Math.max(0, (base[reaction.type] ?? 0) + (delta[reaction.type] ?? 0));
    if (count > 0) merged[reaction.type] = count;
  }
  return merged;
}
