import { DEFRAGMENT_HREF, DEFRAGMENT_TOKEN_SRC, defragmentBoardPath } from "@/lib/defragment";
import { DECISIONS_DECISIONS_HREF, DECISIONS_DECISIONS_TOKEN_SRC } from "@/lib/decisions-decisions";
import { FAVORITE_TOURNAMENT_HREF, FAVORITE_TOURNAMENT_TOKEN_SRC } from "@/lib/favorite-tournament";
import { PAGESTORM_HREF, PAGESTORM_TOKEN_SRC, pagestormDetailHref } from "@/lib/pagestorm";

/** iPhone mainstream from scripts/mobile-qa.mjs */
export const TOYBOX_PREVIEW_MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
export const TOYBOX_PREVIEW_PC_VIEWPORT = { width: 1280, height: 800 } as const;

export type ToyBoxPreviewServiceId =
  | "defragment"
  | "combo"
  | "transfigure"
  | "this_or_that"
  | "favorite_tournament"
  | "chemical_x"
  | "decisions_decisions"
  | "pagestorm"
  | "history_course";

export type ToyBoxPreviewSample = {
  id: string;
  federatedService?: string;
};

export type ToyBoxPreviewSurface = {
  id: ToyBoxPreviewServiceId;
  label: string;
  tokenSrc: string;
  indexHref: string;
  detailHref: (sample: ToyBoxPreviewSample) => string;
};

export const TOYBOX_PREVIEW_SURFACES: readonly ToyBoxPreviewSurface[] = [
  {
    id: "defragment",
    label: "조각모음",
    tokenSrc: DEFRAGMENT_TOKEN_SRC,
    indexHref: DEFRAGMENT_HREF,
    detailHref: (sample) => defragmentBoardPath({
      id: sample.id,
      service: sample.federatedService ?? "combo",
    }),
  },
  {
    id: "combo",
    label: "코오오옴보",
    tokenSrc: "/images/sts2/badges/ccccombo.webp",
    indexHref: "/c-c-c-combo",
    detailHref: (sample) => `/c-c-c-combo/${sample.id}`,
  },
  {
    id: "transfigure",
    label: "변형",
    tokenSrc: "/images/sts2/relics/astrolabe.webp",
    indexHref: "/transfigure",
    detailHref: (sample) => `/transfigure/${sample.id}`,
  },
  {
    id: "this_or_that",
    label: "이거 아님 저거?",
    tokenSrc: "/images/sts2/relics/choices_paradox.webp",
    indexHref: "/this-or-that",
    detailHref: (sample) => `/this-or-that/${sample.id}`,
  },
  {
    id: "favorite_tournament",
    label: "이아저? 월드컵",
    tokenSrc: FAVORITE_TOURNAMENT_TOKEN_SRC,
    indexHref: FAVORITE_TOURNAMENT_HREF,
    detailHref: (sample) => `${FAVORITE_TOURNAMENT_HREF}/${sample.id}`,
  },
  {
    id: "chemical_x",
    label: "케미컬X",
    tokenSrc: "/images/sts2/relics/chemical_x.webp",
    indexHref: "/chemical-x",
    detailHref: (sample) => `/chemical-x/${sample.id}`,
  },
  {
    id: "decisions_decisions",
    label: "어려운 결정",
    tokenSrc: DECISIONS_DECISIONS_TOKEN_SRC,
    indexHref: DECISIONS_DECISIONS_HREF,
    detailHref: (sample) => `${DECISIONS_DECISIONS_HREF}/${sample.id}`,
  },
  {
    id: "pagestorm",
    label: "서류 폭풍",
    tokenSrc: PAGESTORM_TOKEN_SRC,
    indexHref: PAGESTORM_HREF,
    detailHref: (sample) => pagestormDetailHref(sample.id),
  },
  {
    id: "history_course",
    label: "역사 강의서",
    tokenSrc: "/images/sts2/relics/history_course.webp",
    indexHref: "/history-course",
    detailHref: (sample) => `/history-course/${sample.id}`,
  },
];
