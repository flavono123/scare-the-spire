import type { EntityInfo } from "@/components/patch-note-renderer";

export type ConnectionsMember = {
  key: string;
  name: string;
  /** Spelling in the original puzzle. */
  raw: string;
  entity: EntityInfo;
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
