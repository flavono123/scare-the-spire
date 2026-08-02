export type ThisOrThatVoteChoice = "left" | "right";
export type ThisOrThatVoteSurface = "index" | "detail";

export interface ThisOrThatVoteSummary {
  leftCount: number;
  rightCount: number;
  totalCount: number;
}

export const EMPTY_THIS_OR_THAT_VOTE_SUMMARY: ThisOrThatVoteSummary = {
  leftCount: 0,
  rightCount: 0,
  totalCount: 0,
};

export function changeThisOrThatVoteSummary(
  summary: ThisOrThatVoteSummary,
  choice: ThisOrThatVoteChoice,
  delta: 1 | -1,
): ThisOrThatVoteSummary {
  return {
    leftCount: Math.max(0, summary.leftCount + (choice === "left" ? delta : 0)),
    rightCount: Math.max(0, summary.rightCount + (choice === "right" ? delta : 0)),
    totalCount: Math.max(0, summary.totalCount + delta),
  };
}

export function thisOrThatVotePercentage(
  summary: ThisOrThatVoteSummary,
  choice: ThisOrThatVoteChoice,
): number {
  if (summary.totalCount === 0) return 0;
  const count = choice === "left" ? summary.leftCount : summary.rightCount;
  return Math.round((count / summary.totalCount) * 100);
}
