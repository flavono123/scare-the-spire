// Shapes of src/generated/borrowed-game-copy.json. Type-only and free of the
// generated file, so its stage-1 builder (scripts/lib/source-json-payloads.ts) can share them.

export interface HistoryCourseLandingGameCopy {
  title: string;
  runHistoryLabel: string;
  heroQuote: string;
}

export interface ThisOrThatGameCopy {
  title: string;
  prompt: string;
  votePrompt: string;
  voteDone: string;
}

export interface TransfigureGameCopy {
  title: string;
  subtitle: string;
  viewUpgrades: string;
}

export interface DefragmentGameCopy {
  title: string;
  subtitle: string;
  placeholder: string;
}

export interface DecisionsDecisionsGameCopy {
  title: string;
  hero: string;
  presetLabels: Record<string, string>;
}

export interface PagestormGameCopy {
  title: string;
  hero: string;
}

export interface DebateGameCopy {
  title: string;
  hero: string;
  invite: string;
  reelHero: string;
}

export interface VexingPuzzleboxGameCopy {
  title: string;
  hero: string;
  betaArtHighScore: string;
  betaArtLowScore: string;
  /** MERCHANT.talk.purchaseSuccess: the fourth tile, a right group, or a right quiz pick. */
  merchantSuccessLines: string[];
  /** MERCHANT.talk.purchaseFailureGold: a locked toggle is clicked. */
  merchantFailureLines: string[];
  /** MERCHANT.talk.purchaseFailureForbidden: a guess is wrong. */
  merchantForbiddenLines: string[];
  /** MERCHANT.talk.purchaseFailureSpace: a fifth tile when four are already picked. */
  merchantSpaceLines: string[];
  /** settings_ui TAB_SOUND, MUSIC_VOLUME, SFX_VOLUME */
  soundTab: string;
  musicVolume: string;
  sfxVolume: string;
  /** gameplay_ui POTION_POPUP.throw / .discard */
  potionThrow: string;
  potionDiscard: string;
  vakuuName: string;
  /** WHISPERING_EARRING.approval */
  vakuuApproval: string;
  /** WHISPERING_EARRING.warning */
  vakuuWarning: string;
  /** VAKUU.talk.ANY.1-0r: "{Visits} times..." */
  vakuuVisits: string;
  /** VAKUU.talk.ANY.2-0r */
  vakuuEndless: string;
  /** main_menu_ui DAILY_RUN_MENU.LEADERBOARDS.title, for the rankings tab. */
  leaderboardTitle: string;
  /** main_menu_ui LEADERBOARDS.rankHeader / nameHeader / scoreHeader */
  leaderboardRank: string;
  leaderboardName: string;
  leaderboardScore: string;
  /** DAILY_RUN_MENU.LEADERBOARDS.fetchingScores without its thinky dots. */
  leaderboardFetching: string;
  /** The first line of DAILY_RUN_MENU.LEADERBOARDS.noScore. */
  leaderboardEmpty: string;
}

export interface FeedbackFormGameCopy {
  title: string;
  categoryLabel: string;
  descriptionPlaceholder: string;
  sendLabel: string;
  sendingLabel: string;
  sendFailedLabel: string;
  sendSuccessLabel: string;
}

export interface PatchStageGameCopy {
  prepTime: {
    title: string;
    description: string;
  };
  delay: {
    title: string;
    description: string;
  };
  workToolsTitle: string;
  draft: {
    title: string;
    notice: string;
  };
}

export interface PatchBackstabGameCopy {
  title: string;
  description: string;
  emptyDraw: string;
  hero: string;
  transfigureTitle: string;
  transfigureLead: string;
  transfigureCta: string;
}

export interface BorrowedGameCopyPayload {
  chemicalXPlaceholder: string;
  comboPlaceholder: string;
  feedbackForm: FeedbackFormGameCopy;
  historyCourseLanding: HistoryCourseLandingGameCopy;
  patchStage: PatchStageGameCopy;
  patchBackstab: PatchBackstabGameCopy;
  thisOrThat: ThisOrThatGameCopy;
  transfigure: TransfigureGameCopy;
  defragment: DefragmentGameCopy;
  decisionsDecisions: DecisionsDecisionsGameCopy;
  pagestorm: PagestormGameCopy;
  debate: DebateGameCopy;
  vexingPuzzlebox: VexingPuzzleboxGameCopy;
}
