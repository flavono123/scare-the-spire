import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function lastNonEmptyLine(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? "";
}

function stripGameMarkup(text: string): string {
  return text
    .replace(/\[\/?[a-z_]+(?:=[^\]]+)?(?::[^\]]+)?\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function heroFromLocale(file: string): string {
  const table = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  const description = table["COLORFUL_PHILOSOPHERS.pages.INITIAL.description"] ?? "";
  return stripGameMarkup(lastNonEmptyLine(description));
}

const koreanHero = "당신도 스스로 생각하는 바를 그들에게 말합니다.";
const englishHero = "You chime in with your thoughts.";

assert.equal(
  heroFromLocale("data/sts2/localization/kor/events.json"),
  koreanHero,
);
assert.equal(
  heroFromLocale("data/sts2/localization/eng/events.json"),
  englishHero,
);

console.log("debate copy ok");
