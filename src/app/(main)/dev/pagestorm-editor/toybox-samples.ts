import {
  DEFAULT_TIER_ROWS,
  type DecisionsDecisionsResourceRef,
  type TierPlacement,
  type TierRow,
} from "@/lib/decisions-decisions";
import type { ThisOrThatResourceType } from "@/lib/this-or-that";

export type PagestormToyboxServiceHref = "/this-or-that" | "/decisions-decisions";

export type PagestormToyboxPost = {
  id: string;
  service: PagestormToyboxServiceHref;
  own: boolean;
  title: string;
  body: string;
} & (
  | {
    service: "/this-or-that";
    leftType: ThisOrThatResourceType;
    leftId: string;
    rightType: ThisOrThatResourceType;
    rightId: string;
  }
  | {
    service: "/decisions-decisions";
    rows: TierRow[];
    placements: TierPlacement[];
    pool: DecisionsDecisionsResourceRef[];
  }
);

export const PAGESTORM_TOYBOX_POSTS: readonly PagestormToyboxPost[] = [
  {
    id: "mock-tot-multihit",
    service: "/this-or-that",
    own: true,
    title: "우주 먼지 vs 천원돌파",
    body: "케미컬 X 축에서 다단히트 메인으로 뭘 넣을지. 스타 수급이면 우주 먼지, 한 장 화력이면 천원돌파.",
    leftType: "card",
    leftId: "STARDUST",
    rightType: "card",
    rightId: "HEAVENLY_DRILL",
  },
  {
    id: "mock-tot-relic",
    service: "/this-or-that",
    own: false,
    title: "케미컬 X vs 잉크병",
    body: "다단히트 유물 비교. 케미컬 X는 횟수, 잉크병은 뽑기 순환.",
    leftType: "relic",
    leftId: "CHEMICAL_X",
    rightType: "relic",
    rightId: "INK_BOTTLE",
  },
  {
    id: "mock-dd-regent",
    service: "/decisions-decisions",
    own: true,
    title: "리젠트 다단히트 티어",
    body: "서류 폭풍 축. S에 우주 먼지·천원돌파, A에 케미컬 X와 서류 폭풍.",
    rows: [...DEFAULT_TIER_ROWS],
    placements: [
      { type: "card", id: "STARDUST", rowId: "s", sort: 0 },
      { type: "card", id: "HEAVENLY_DRILL", rowId: "s", sort: 1 },
      { type: "relic", id: "CHEMICAL_X", rowId: "a", sort: 0 },
      { type: "card", id: "PAGESTORM", rowId: "a", sort: 1 },
      { type: "card", id: "FALLING_STAR", rowId: "b", sort: 0 },
    ],
    pool: [],
  },
  {
    id: "mock-dd-silent",
    service: "/decisions-decisions",
    own: false,
    title: "사일런트 폐기 티어",
    body: "별똥별로 스타를 모은 뒤 쳐내기로 정리하는 보드.",
    rows: [...DEFAULT_TIER_ROWS],
    placements: [
      { type: "card", id: "FALLING_STAR", rowId: "s", sort: 0 },
      { type: "card", id: "PAGESTORM", rowId: "b", sort: 0 },
    ],
    pool: [],
  },
];

export function findToyboxPost(id: string): PagestormToyboxPost | undefined {
  return PAGESTORM_TOYBOX_POSTS.find((post) => post.id === id);
}

export function filterToyboxPosts(options: {
  serviceHref?: string | null;
  query: string;
}): PagestormToyboxPost[] {
  const needle = options.query.trim().toLowerCase();
  const servicePath = options.serviceHref
    ? options.serviceHref.replace(/^\/(?:en)(?=\/)/, "")
    : null;
  return [...PAGESTORM_TOYBOX_POSTS]
    .filter((post) => {
      if (servicePath && post.service !== servicePath) return false;
      if (!needle) return true;
      return (
        post.title.toLowerCase().includes(needle)
        || post.body.toLowerCase().includes(needle)
      );
    })
    .sort((left, right) => Number(right.own) - Number(left.own));
}
