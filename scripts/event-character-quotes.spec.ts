import assert from "node:assert/strict";
import { bakeDescription } from "../src/lib/codex-bake";
import { getCodexCharacters, getCodexEvents } from "../src/lib/codex-data";
import {
  applyEventCharacterQuotes,
  eventContainsCharacterQuotePlaceholders,
  splitEventDescriptionQuotes,
  toEventCharacterQuoteSpeaker,
} from "../src/lib/event-character-quotes";

async function main() {
  const quotes = {
    goldMonologue: "[sine]These riches can bolster my tribe's armory...[/sine]",
    aromaPrinciple: "[sine][red]Pain is nothing. My enemies must die.[/red][/sine]",
  };

  assert.equal(
    bakeDescription("{Monologue}\n{AromaPrinciple}", {}),
    "{Monologue}\n{AromaPrinciple}",
    "character quote placeholders must survive static event baking",
  );
  assert.equal(
    applyEventCharacterQuotes(
      "before\n{Monologue}\nafter",
      quotes,
    ),
    "before\n[sine]These riches can bolster my tribe's armory...[/sine]\nafter",
  );
  assert.equal(
    applyEventCharacterQuotes(
      "[AromaPrinciple]",
      quotes,
    ),
    quotes.aromaPrinciple,
    "extracted square-bracket fallbacks must also resolve",
  );

  const aromaSegments = splitEventDescriptionQuotes(
    "lead\n\n{AromaPrinciple}\n{AromaPrinciple}\n{AromaPrinciple}\n\ntrail",
  );
  assert.deepEqual(aromaSegments, [
    { type: "text", value: "lead\n\n" },
    { type: "quote", placeholder: "AromaPrinciple", count: 3 },
    { type: "text", value: "\n\ntrail" },
  ]);

  const mixed = splitEventDescriptionQuotes("{Monologue} then {AromaPrinciple}");
  assert.deepEqual(mixed, [
    { type: "quote", placeholder: "Monologue", count: 1 },
    { type: "text", value: " then " },
    { type: "quote", placeholder: "AromaPrinciple", count: 1 },
  ]);

  await checkExtractedEvents();
  console.log("event-character-quotes.spec.ts: ok");
}

async function checkExtractedEvents() {
  const [events, characters] = await Promise.all([
    getCodexEvents({ gameLocale: "kor" }),
    getCodexCharacters({ gameLocale: "kor" }),
  ]);
  const sunken = events.find((event) => event.id === "SUNKEN_TREASURY");
  const aroma = events.find((event) => event.id === "AROMA_OF_CHAOS");
  const ironclad = characters.find((character) => character.id === "IRONCLAD");
  assert.ok(sunken && aroma && ironclad);

  const secondChest = sunken.pages?.find((page) => page.id === "SECOND_CHEST")?.description ?? "";
  const maintainControl = aroma.pages?.find((page) => page.id === "MAINTAIN_CONTROL")?.description ?? "";
  assert.equal(eventContainsCharacterQuotePlaceholders(sunken), true);
  assert.equal(eventContainsCharacterQuotePlaceholders(aroma), true);
  assert.match(secondChest, /\{Monologue\}/);
  assert.match(maintainControl, /\{AromaPrinciple\}/);
  assert.doesNotMatch(secondChest, /\bX\b/);
  assert.doesNotMatch(maintainControl, /\bX\b/);

  const speaker = toEventCharacterQuoteSpeaker(ironclad);
  const renderedMonologue = applyEventCharacterQuotes(secondChest, speaker.quotes);
  const renderedPrinciple = applyEventCharacterQuotes(maintainControl, speaker.quotes);
  assert.ok(renderedMonologue.includes(ironclad.quotes.goldMonologue));
  assert.equal(renderedPrinciple.split(ironclad.quotes.aromaPrinciple).length - 1, 3);
}

void main();
