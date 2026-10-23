import type { EntityType } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import { SAMPLE_YOUTUBE } from "@/components/pagestorm/sample";

/**
 * Lorem ipsum posts that use every feature of each editor, so the dev page
 * opens on something to poke at. Entity ids come from
 * public/generated/comment-entities-sts2.json.
 */

function keyword(text: string, entityId: string, entityType: EntityType, name = text): PostBlock {
  return { type: "keyword", text, keyword: name, description: "", entityId, entityType };
}

function text(value: string): PostBlock {
  return { type: "text", text: value };
}

/** Comments: display{keyword}, bare keyword, text-con, card-con, emote, line break. ≤ 200 chars. */
export const COMMENT_SAMPLE: PostBlock[] = [
  text("Lorem ipsum "),
  keyword("강펀치", "BASH", "card", "강타"),
  text(" dolor sit amet, "),
  keyword("취약", "VULNERABLE", "power"),
  text(" consectetur.\nSed do eiusmod "),
  { type: "text-con", text: "로렘", bgColor: "gold", textColor: "dark" },
  text(" "),
  { type: "card-con", cardId: "STRIKE_DEFECT", displayText: "타격", gameLocale: "kor" },
  text(" "),
  { type: "emote-con", emoteId: "exclaim" },
];

/** History course comments add `#floor` mentions. */
export const HISTORY_COURSE_SAMPLE: PostBlock[] = [
  text("Lorem ipsum "),
  { type: "history-run-floor", floor: 6, actIndex: 0, step: 5, mapPointType: "elite" },
  text(" dolor sit amet, "),
  keyword("힘", "STRENGTH", "power"),
  text(" consectetur."),
];

/** Chemical X posts are capped at 30 characters. */
export const CHEMICAL_X_SAMPLE: PostBlock[] = [
  keyword("독찌름", "POISONED_STAB", "card", "독 찌르기"),
  text(" 후 "),
  keyword("중독", "POISON", "power"),
  text(" 폭발 "),
  { type: "text-con", text: "로렘", bgColor: "green", textColor: "dark" },
];

/** Combo: two or more resources, one YouTube video, a titled link, a run reference. No line breaks. */
export const COMBO_SAMPLE: PostBlock[] = [
  text("Lorem ipsum "),
  keyword("깔때기", "TWISTED_FUNNEL", "relic", "뒤틀린 깔때기"),
  text(" + "),
  keyword("발병", "OUTBREAK", "card"),
  text(" + "),
  keyword("촉진제", "ACCELERANT", "card"),
  text(" · Dolor sit amet "),
  {
    type: "link",
    href: "https://m.dcinside.com/board/slay/501657?recommend=1",
    title: "마음의 평안을 주는 짤 - 슬레이 더 스파이어 마이너 갤러리",
  },
  text(" "),
  { type: "youtube", videoId: SAMPLE_YOUTUBE.videoId, title: SAMPLE_YOUTUBE.title },
  text(" "),
  {
    type: "history-run",
    runId: "dev-sample-run",
    snapshot: {
      title: "Lorem 독 덱",
      character: "CHARACTER.SILENT",
      startTime: 1_790_000_000,
      ascension: 10,
      win: true,
      totalFloors: 48,
      runTime: 3_600,
      build: "v0.99",
      seed: "LOREM",
      coverSpec: null,
    },
  },
];

export const DEFRAGMENT_SAMPLE_TITLE = "Lorem ipsum dolor sit amet";

/** Defragment bodies keep line breaks and Enter does not submit. */
export const DEFRAGMENT_SAMPLE: PostBlock[] = [
  text("Lorem ipsum dolor sit amet, "),
  keyword("우주 먼지", "STARDUST", "card"),
  text(" consectetur adipiscing elit.\n\nSed do eiusmod tempor "),
  keyword("별똥별", "FALLING_STAR", "card"),
  text(" incididunt ut labore.\n"),
  { type: "text-con", text: "결론", bgColor: "blue", textColor: "dark" },
  text(" "),
  { type: "card-con", cardId: "PAGESTORM", displayText: "서류 폭풍", gameLocale: "kor" },
];

export const DEFRAGMENT_OVERLAY_SAMPLE: PostBlock[] = [
  text("Lorem ipsum "),
  keyword("피 포션", "BLOOD_POTION", "potion"),
  text(" dolor."),
];

/** Transfigure descriptions: text effects, energy/star icons, link-free keywords. */
export const TRANSFIGURE_SAMPLE: PostBlock[] = [
  text("[gold][sine]Lorem[/sine][/gold] 피해를 6 줍니다. "),
  { type: "cost-token", kind: "energy", count: 1 },
  text(" 획득.\n"),
  keyword("취약", "VULNERABLE", "power"),
  text("을 1 부여합니다. [red][jitter]ipsum[/jitter][/red] "),
  { type: "cost-token", kind: "star", count: 2 },
];
