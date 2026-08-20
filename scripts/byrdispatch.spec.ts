import assert from "node:assert/strict";
import { parseByrdispatchMarkdown } from "../src/lib/byrdispatch";

const parsed = parseByrdispatchMarkdown(
  `# 2026-08-20

## 장난감 상자(공통)

- 댓글을 이제 30자가 아닌 200자까지 쓸 수 있습니다.
- 버그 줄 (버그)(제보감사)

### 조각모음 (new)

- 한 줄 게시판

## 백과사전

- 과거 패치 내역 중 누락된 것을 적용했습니다.
  - 악의, v0.100.0 (제보 감사)
<details>
<summary>상세 내역 전부 보기</summary>

- [v0.100.0](/patches/v0.100.0)
  - 강령회, 강화해도 영혼+로 바꾸지 않음
</details>

### 캐릭터

[character-low-hp-idle:v0.111.0]

- 낮은 체력 대기를 캐릭터 상세에서 볼 수 있습니다.
`,
  "2026-01-01",
);

assert.equal(parsed.date, "2026-08-20");
assert.equal(parsed.regularSections[0]?.title, "장난감 상자(공통)");
assert.deepEqual(parsed.regularSections[1]?.statuses, ["new"]);
assert.equal(parsed.regularSections[1]?.title, "조각모음");

const bugBullet = parsed.regularSections[0]?.items.find(
  (item) => item.type === "bullet" && item.bullet.text.startsWith("버그 줄"),
);
assert.ok(bugBullet && bugBullet.type === "bullet");
assert.deepEqual(bugBullet.bullet.statuses, ["bug", "reportThanks"]);

const encyclopedia = parsed.regularSections.find((section) => section.title === "백과사전");
assert.ok(encyclopedia);
const details = encyclopedia.items.find((item) => item.type === "details");
assert.ok(details && details.type === "details");
assert.equal(details.details.summary, "상세 내역 전부 보기");
assert.equal(details.details.items[0]?.type, "bullet");
if (details.details.items[0]?.type === "bullet") {
  assert.equal(details.details.items[0].bullet.text, "[v0.100.0](/patches/v0.100.0)");
  assert.equal(details.details.items[0].bullet.depth, 0);
}
assert.equal(details.details.items[1]?.type, "bullet");
if (details.details.items[1]?.type === "bullet") {
  assert.equal(details.details.items[1].bullet.depth, 1);
}

const characters = parsed.regularSections.find((section) => section.title === "캐릭터");
assert.ok(characters);
assert.equal(characters.items[0]?.type, "characterLowHpIdle");
if (characters.items[0]?.type === "characterLowHpIdle") {
  assert.equal(characters.items[0].block.version, "v0.111.0");
}

console.log("byrdispatch.spec.ts: ok");
