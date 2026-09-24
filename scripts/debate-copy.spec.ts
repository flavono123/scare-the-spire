import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function stripGameMarkup(text: string): string {
  return text
    .replace(/\[\/?[a-z_]+(?:=[^\]]+)?(?::[^\]]+)?\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function heroFromLocale(file: string): string {
  const table = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  const description = table["COLORFUL_PHILOSOPHERS.pages.DONE.description"] ?? "";
  return stripGameMarkup(description);
}

const koreanHero = "당신의 의견은 받아들여지지 않는 것으로 보이며, 동상들은 끝없는 논쟁을 이어 나갑니다.";
const englishHero = "Your opinion doesn't seem welcome, and the statues resume their unending debate.";

assert.equal(
  heroFromLocale("data/sts2/localization/kor/events.json"),
  koreanHero,
);
assert.equal(
  heroFromLocale("data/sts2/localization/eng/events.json"),
  englishHero,
);

function titleFromLocale(file: string): string {
  const table = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  return table["COLORFUL_PHILOSOPHERS.title"] ?? "";
}

assert.equal(titleFromLocale("data/sts2/localization/kor/events.json"), "다채로운 철학자들");
assert.equal(titleFromLocale("data/sts2/localization/eng/events.json"), "Colorful Philosophers");

console.log("debate copy ok");
