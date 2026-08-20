import assert from "node:assert/strict";
import {
  buildAutoLinkKeywordsByFirst,
  wrapUntaggedEntityNames,
} from "../src/lib/auto-link-entity-names";
import type { EntityType } from "../src/components/patch-note-renderer";

const keywordsByFirst = buildAutoLinkKeywordsByFirst([
  { label: "악의", type: "card" },
  { label: "하수인 타격", type: "card" },
  { label: "하수인 투하", type: "card" },
  { label: "하수인", type: "power" },
  { label: "소멸", type: "keyword" },
  { label: "영혼", type: "card" },
  { label: "Null", type: "card" },
  { label: "타격", type: "card" },
]);

function resolve(raw: string): { type: EntityType } | null {
  const lower = raw.toLowerCase();
  if (lower === "악의") return { type: "card" };
  if (lower === "하수인 타격" || lower === "하수인 투하") return { type: "card" };
  if (lower === "하수인") return { type: "power" };
  if (lower === "소멸") return { type: "keyword" };
  if (lower === "영혼" || lower === "영혼+") return { type: "card" };
  if (lower === "null") return { type: "card" };
  return null;
}

assert.equal(
  wrapUntaggedEntityNames("악의, 0비용 고급 리워크", keywordsByFirst, resolve),
  "[gold:card]악의[/gold], 0비용 고급 리워크",
);

assert.equal(
  wrapUntaggedEntityNames("핫픽스, 강화하지 않으면 소멸", keywordsByFirst, resolve),
  "핫픽스, 강화하지 않으면 [gold:keyword]소멸[/gold]",
);

assert.equal(
  wrapUntaggedEntityNames("물렀거라!, 하수인 타격 대신 하수인 투하", keywordsByFirst, resolve),
  "물렀거라!, [gold:card]하수인 타격[/gold] 대신 [gold:card]하수인 투하[/gold]",
);

assert.equal(
  wrapUntaggedEntityNames("강령회, 영혼+로 바꾸지 않음", keywordsByFirst, resolve),
  "강령회, [gold:card]영혼+[/gold]로 바꾸지 않음",
);

assert.equal(
  wrapUntaggedEntityNames("[gold:card]악의[/gold], 이미 태그됨", keywordsByFirst, resolve),
  "[gold:card]악의[/gold], 이미 태그됨",
);

assert.equal(
  wrapUntaggedEntityNames("Null, 약화 2(3)→1(2)", keywordsByFirst, resolve),
  "[gold:card]Null[/gold], 약화 2(3)→1(2)",
);

assert.equal(
  wrapUntaggedEntityNames("annulled", keywordsByFirst, resolve),
  "annulled",
);

assert.equal(
  wrapUntaggedEntityNames("추가 타격", keywordsByFirst, resolve),
  "추가 타격",
);

console.log("auto-link-entity-names.spec.ts: ok");
