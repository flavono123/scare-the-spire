import {
  mailboxAdapter,
  philosophersPostAdapter,
  philosophersReelAdapter,
  philosophersWeekAdapter,
  profileActivityAdapter,
  profileInquiriesAdapter,
  profileNicknamesAdapter,
  profileStatsAdapter,
  storiesAdapter,
} from "./community";
import { engagementAdapter, engagementCountsAdapter, engagementMeAdapter } from "./engagement";
import { historyRunAdapter, historyRunsAdapter, historyRunsEngagementAdapter, myHistoryRunsAdapter } from "./history-runs";
import { navAdapter } from "./nav";
import { leaderboardAdapter, standingsAdapter } from "./puzzlebox";
import type { D1Adapter } from "./rows";
import {
  defragmentBodyAdapter,
  defragmentFeedAdapter,
  defragmentRunsAdapter,
  pagestormDraftsAdapter,
  pagestormPostsAdapter,
  thisOrThatLikeCountsAdapter,
  thisOrThatMyLikesAdapter,
  thisOrThatMyVotesAdapter,
  thisOrThatVoteSummariesAdapter,
  toyboxFeedAdapter,
  toyboxPostAdapter,
  tournamentPresetsAdapter,
  tournamentStatsAdapter,
} from "./toybox";

/** The D1 adapter of every step-1 read route, by route id (workers/api/routes). */
export const D1_ADAPTERS: Readonly<Record<string, D1Adapter>> = {
  "read.nav": (context) => navAdapter(context),
  "read.engagement": engagementAdapter,
  "read.engagement-counts": engagementCountsAdapter,
  "me.engagement": engagementMeAdapter,
  "read.colorful-philosophers.week": philosophersWeekAdapter,
  "read.colorful-philosophers.post": philosophersPostAdapter,
  "read.colorful-philosophers.reel": philosophersReelAdapter,
  "me.mailbox": mailboxAdapter,
  "read.profile.nicknames": profileNicknamesAdapter,
  "me.profile.stats": profileStatsAdapter,
  "me.profile.activity": profileActivityAdapter,
  "me.profile.inquiries": profileInquiriesAdapter,
  "read.puzzlebox.leaderboard": leaderboardAdapter,
  "me.puzzlebox.leaderboard": leaderboardAdapter,
  "me.puzzlebox.standings": standingsAdapter,
  "read.history-runs": historyRunsAdapter,
  "read.history-run": historyRunAdapter,
  "read.history-runs.engagement": historyRunsEngagementAdapter,
  "me.history-runs": myHistoryRunsAdapter,
  "read.stories": storiesAdapter,
  "read.toybox-feed": toyboxFeedAdapter,
  "read.defragment-feed": defragmentFeedAdapter,
  "read.defragment-runs": defragmentRunsAdapter,
  "read.toybox-post": toyboxPostAdapter,
  "read.favorite-tournament.presets": tournamentPresetsAdapter,
  "read.favorite-tournament.stats": tournamentStatsAdapter,
  "read.pagestorm.posts": pagestormPostsAdapter,
  "me.pagestorm.drafts": pagestormDraftsAdapter,
  "read.defragment-body": defragmentBodyAdapter,
  "read.this-or-that.like-counts": thisOrThatLikeCountsAdapter,
  "me.this-or-that.likes": thisOrThatMyLikesAdapter,
  "read.this-or-that.vote-summaries": thisOrThatVoteSummariesAdapter,
  "me.this-or-that.votes": thisOrThatMyVotesAdapter,
};
