import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { groupAncientDialogueLines, parseAncientDialogueOrder } from "../src/lib/ancient-dialogue";
import { getCodexAncients } from "../src/lib/codex-data";
import { buildSearchIndexPayload } from "../src/lib/search-index-data";
import { stripCodexMarkup } from "../src/lib/codex-search";

type RawLine = { order: string; speaker: "ancient" | "character"; text: string };
type RawAncient = { id: string; type: string; dialogue: Record<string, RawLine[]> };

async function main() {
  const root = process.cwd();
  const rawAncients = (JSON.parse(await fs.readFile(`${root}/data/sts2/kor/events.json`, "utf8")) as RawAncient[])
    .filter((event) => event.type === "Ancient");
  const localized = JSON.parse(await fs.readFile(`${root}/data/sts2/localization/kor/ancients.json`, "utf8")) as Record<string, string>;
  const ancients = await getCodexAncients({ gameLocale: "kor" });

  assert.deepEqual(parseAncientDialogueOrder("12-34r"), {
    raw: "12-34r",
    variant: 12,
    line: 34,
    suffix: "r",
  });
  assert.throws(() => parseAncientDialogueOrder("12r-34"));

  let preservedNextLabels = 0;
  for (const rawAncient of rawAncients) {
    const ancient = ancients.find((candidate) => candidate.id === rawAncient.id);
    assert(ancient, `Missing Ancient dialogue: ${rawAncient.id}`);
    for (const [group, rawLines] of Object.entries(rawAncient.dialogue)) {
      const scenes = ancient.dialogue[group];
      assert(scenes, `Missing dialogue group: ${rawAncient.id}/${group}`);
      assert.equal(scenes.flatMap((scene) => scene.lines).length, rawLines.length, `Flattened or lost lines: ${rawAncient.id}/${group}`);
      assert.equal(scenes.length, groupAncientDialogueLines(rawLines).length, `Lost dialogue variants: ${rawAncient.id}/${group}`);

      const localizationGroup = group === "First Visit" ? "firstVisitEver" : group === "Returning" ? "ANY" : group.toUpperCase();
      for (const scene of scenes) {
        for (const line of scene.lines) {
          const key = `${rawAncient.id}.talk.${localizationGroup}.${line.order}.next`;
          if (!localized[key]) continue;
          assert(line.nextLabel, `Dropped localized next label: ${key}`);
          preservedNextLabels += 1;
        }
      }
    }
  }
  assert(preservedNextLabels > 0, "No localized Ancient next labels were preserved");

  const searchIndex = await buildSearchIndexPayload();
  for (const ancient of ancients) {
    const item = searchIndex.items.find((candidate) => candidate.type === "ancient" && candidate.id === ancient.id);
    assert(item, `Missing Ancient search item: ${ancient.id}`);
    for (const scene of Object.values(ancient.dialogue).flat()) {
      for (const line of scene.lines) {
        const text = stripCodexMarkup(line.text).replace(/\s+/g, " ").trim();
        assert(item.description.includes(text), `Search index dropped ${ancient.id}/${line.order}`);
      }
    }
  }

  console.log(`validated ${ancients.length} Ancient dialogue sets and ${preservedNextLabels} localized next labels`);
}

void main();
