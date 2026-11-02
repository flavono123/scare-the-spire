import type { EntityInfo } from "@/components/patch-note-renderer";

export type ConnectionsMember = {
  key: string;
  name: string;
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
  /** Card color, or null for other types. */
  color: string | null;
  betaUrl: string;
  officialUrl: string | null;
  href: string;
  /** Card whose final art arrived after Early Access launched. */
  earlyAccess: boolean;
};

export type BetaArtCharacter = {
  color: string;
  name: string;
};
