import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildEntityLookup,
  findEntity,
  PatchNoteRenderer,
  type EntityInfo,
} from "@/components/patch-note-renderer";
import {
  wrapNumberedAscensionMentions,
  wrapUntaggedEntityNames,
  AUTO_LINK_ENTITY_TYPES,
} from "@/lib/auto-link-entity-names";
import { getByrdispatchEntries } from "@/lib/byrdispatch";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { collectStrings, selectEntitiesForTexts } from "@/lib/entity-subset";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { loadAllEntities } from "@/lib/load-all-entities";

// byrdispatch passes PatchNoteRenderer only the entities its markdown can
// reach (selectEntitiesForTexts). The subset must resolve and render every
// text exactly like the full entity graph.

const entity = (fields: Partial<EntityInfo> & Pick<EntityInfo, "id" | "type" | "nameKo" | "nameEn">): EntityInfo => ({
  imageUrl: "",
  color: "",
  ...fields,
});

// Unit cases for the selection rule.
{
  const bash = entity({ id: "BASH", type: "card", nameKo: "강타", nameEn: "Bash" });
  const shiv = entity({ id: "SHIV", type: "card", nameKo: "단도", nameEn: "Shiv", aliasesEn: ["Shivs"] });
  const ironclad = entity({ id: "IRONCLAD", type: "character", nameKo: "아이언클래드", nameEn: "Ironclad" });
  const jaw = entity({ id: "JAW_WORM", type: "monster", nameKo: "턱벌레", nameEn: "Jaw Worm" });
  const upgraded = entity({ id: "PLUS", type: "card", nameKo: "플러스", nameEn: "Bash+" });
  const all = [bash, shiv, ironclad, jaw, upgraded];

  assert.deepEqual(selectEntitiesForTexts(all, ["Use [gold]BASH[/gold] now"]), [bash]);
  assert.deepEqual(selectEntitiesForTexts(all, ["two shivs"]), [shiv], "aliases count, case-insensitively");
  assert.deepEqual(
    selectEntitiesForTexts(all, ["[gold]Bash[sine]+[/sine][/gold]"]),
    [bash, upgraded],
    "nested tags are read the way [gold] extracts its text",
  );
  assert.deepEqual(selectEntitiesForTexts(all, ["[character-low-hp-idle:v0.111.0]"]), [ironclad]);
  assert.deepEqual(selectEntitiesForTexts(all, ["[monster-pattern-diff:jaw_worm]"]), [jaw]);
  assert.equal(selectEntitiesForTexts(all, ["강타"])[0], bash, "object identity is kept");
  assert.deepEqual(collectStrings({ a: ["x", { b: "y", c: 1, d: null }], e: "z" }), ["x", "y", "z"]);
}

const GOLD_TOKEN_RE = /\[gold(?::([a-zA-Z]+))?\]([\s\S]*?)\[\/gold\]/g;
const BOLD_RE = /\*\*([^*\n]+)\*\*/g;

function entityKey(match: EntityInfo | null): string {
  return match ? `${match.type}:${match.id}:${match.cardPreviewUpgradeLevel ?? 0}` : "-";
}

function renderLine(markdown: string, entities: EntityInfo[], gameLocale: GameLocale, autoLinkEntities: boolean, gameUi: Awaited<ReturnType<typeof getCodexGameUiLabels>>) {
  return renderToStaticMarkup(
    <PatchNoteRenderer
      markdown={markdown}
      entities={entities}
      gameUi={gameUi}
      serviceLocale={getServiceLocaleForGameLocale(gameLocale)}
      gameLocale={gameLocale}
      preferEntityLocaleLabel
      epochArtMode="beta"
      autoLinkEntities={autoLinkEntities}
    />,
  );
}

async function checkByrdispatch(gameLocale: GameLocale) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const [entries, full, gameUi] = await Promise.all([
    getByrdispatchEntries(serviceLocale),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const texts = collectStrings(entries);
  const subset = selectEntitiesForTexts(full, texts);
  assert.ok(subset.length > 0 && subset.length < full.length / 4, `${gameLocale}: subset size ${subset.length}`);

  const fullLookup = buildEntityLookup(full);
  const subsetLookup = buildEntityLookup(subset);
  const resolveWith = (lookup: ReturnType<typeof buildEntityLookup>) => (raw: string) => {
    const match = findEntity(raw, lookup);
    return match && AUTO_LINK_ENTITY_TYPES.has(match.type) ? match : null;
  };

  let tokens = 0;
  for (const text of texts) {
    for (const match of text.matchAll(GOLD_TOKEN_RE)) {
      const plain = match[2].replace(/\[\/?[a-z][\w-]*(?::[^\]\n]*)?\]/gi, "");
      assert.equal(
        entityKey(findEntity(plain, subsetLookup, match[1])),
        entityKey(findEntity(plain, fullLookup, match[1])),
        `${gameLocale}: [gold${match[1] ? `:${match[1]}` : ""}]${plain}`,
      );
      tokens += 1;
    }
    for (const match of text.matchAll(BOLD_RE)) {
      for (const name of match[1].split(/\s*(?:->|→|&)\s*/)) {
        assert.equal(
          entityKey(findEntity(name, subsetLookup)),
          entityKey(findEntity(name, fullLookup)),
          `${gameLocale}: **${name}**`,
        );
        tokens += 1;
      }
    }
    const wrapped = wrapNumberedAscensionMentions(text);
    assert.equal(
      wrapUntaggedEntityNames(wrapped, subsetLookup.autoLinkKeywordsByFirst, resolveWith(subsetLookup)),
      wrapUntaggedEntityNames(wrapped, fullLookup.autoLinkKeywordsByFirst, resolveWith(fullLookup)),
      `${gameLocale}: auto-link of ${text.slice(0, 80)}`,
    );
  }

  // The renderer itself, with and without auto-linking.
  let rendered = 0;
  for (const text of texts) {
    for (const autoLinkEntities of [false, true]) {
      assert.equal(
        renderLine(text, subset, gameLocale, autoLinkEntities, gameUi),
        renderLine(text, full, gameLocale, autoLinkEntities, gameUi),
        `${gameLocale}: rendered markup of ${text.slice(0, 80)}`,
      );
      rendered += 1;
    }
  }

  console.log(
    `${gameLocale}: ${subset.length}/${full.length} entities, ${tokens} tokens resolved and ${rendered} renders identical`,
  );
}

async function main() {
  for (const gameLocale of ["kor", "eng", "jpn"] as const) {
    await checkByrdispatch(gameLocale);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
