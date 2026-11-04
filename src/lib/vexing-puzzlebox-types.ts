import type { EntityInfo } from "@/components/patch-note-renderer";

export type ConnectionsMember = {
  /** `game:type:id`, or `raw:<spelling>` for a name with no game data. */
  key: string;
  name: string;
  /** Spelling in the original puzzle. */
  raw: string;
  imageUrl: string | null;
  /** STS2 Compendium hover tip. */
  entity: EntityInfo | null;
  /** STS1 Compendium hover tip, `sts1:<resource>:<slug>`. */
  sts1MentionId: string | null;
  /** STS1 things the Compendium lacks (events, blights): their game description. */
  note: { description: string } | null;
};

export type ConnectionsCategory = {
  level: number;
  title: string;
  titleEn: string;
  note: string | null;
  members: ConnectionsMember[];
};

export type ConnectionsPuzzle = {
  number: number;
  issueId: string;
  issueNumber: number;
  /** The Neowsletter issue's date, YYYY-MM-DD. */
  issueDate: string | null;
  /** Which game the puzzle was written for; members can still name the other one. */
  era: "sts1" | "sts2";
  claimId: string;
  slug: string;
  categories: ConnectionsCategory[];
};

export type BetaArtType = "card" | "relic" | "power" | "epoch";

export type BetaArtEntry = {
  key: string;
  type: BetaArtType;
  id: string;
  name: string;
  nameEn: string;
  /** Card color, or null for other types. */
  color: string | null;
  betaUrl: string;
  officialUrl: string | null;
  href: string;
  /**
   * A card whose official portrait came in a patch after the 0.98 Early Access launch,
   * so players met the beta art in the game first (patch notes' "new card portrait" lines).
   */
  earlyAccess: boolean;
  /** The 슬서운이야기 beta art Shorts episode (`beta-art-N`) and the art's place in it. */
  episode: number | null;
  episodeOrder: number | null;
};

export type BetaArtCharacter = {
  color: string;
  name: string;
};

/** A Connections puzzle as the rankings tab needs it. */
export type RankingsConnectionsBoard = {
  number: number;
  issueDate: string | null;
  era: "sts1" | "sts2";
  /** Group titles by level, yellow to purple. */
  levels: string[];
};

/** A beta art quiz set as the rankings tab needs it: each question's art and its choices' names. */
export type RankingsQuizSet = {
  number: number;
  questions: { key: string; name: string; betaUrl: string; choices: string[] }[];
};
