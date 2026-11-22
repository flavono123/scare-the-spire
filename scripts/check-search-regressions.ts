import assert from "node:assert/strict";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { matchEntities } from "@/lib/chemical-utils";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import { readFileSync } from "node:fs";
import {
  globalSearchItemScore,
  rankGlobalSearchResults,
  type GlobalSearchIndexItem,
} from "@/lib/global-search";
import { serviceMessages } from "@/messages/service";

assert.equal(fuzzyMatchCodexText("타격", "ㅌㄱ"), true);
assert.equal(fuzzyMatchCodexText("아이언클래드", "ㅇㅇㅋㄹㄷ"), true);
assert.equal(fuzzyMatchCodexText("네크로바인더", "ㄴㅋㄹㅂㅇㄷ"), true);
assert.equal(fuzzyMatchCodexText("강사", "강ㅅ"), true);

const entities: EntityInfo[] = [
  {
    id: "IRONCLAD",
    type: "character",
    nameKo: "아이언클래드",
    nameEn: "The Ironclad",
    imageUrl: null,
    href: "/compendium/characters?character=ironclad",
    color: "ironclad",
  },
  {
    id: "NECROBINDER",
    type: "character",
    nameKo: "네크로바인더",
    nameEn: "The Necrobinder",
    imageUrl: null,
    href: "/compendium/characters?character=necrobinder",
    color: "necrobinder",
  },
];

assert.deepEqual(
  matchEntities("ㄴㅋㄹㅂㅇㄷ", entities).map((entity) => entity.id),
  ["NECROBINDER"],
);

const globalSearchItem: GlobalSearchIndexItem = {
  id: "IRONCLAD",
  type: "character",
  title: "아이언클래드",
  titleEn: "The Ironclad",
  description: "",
  descriptionEn: "",
  imageUrl: null,
  href: "/compendium/characters?character=ironclad",
};

assert.notEqual(
  globalSearchItemScore(globalSearchItem, "ㅇㅇㅋㄹㄷ", serviceMessages.ko.globalSearch.labels),
  null,
);

assert.notEqual(
  globalSearchItemScore(
    {
      ...globalSearchItem,
      id: "TUTOR",
      type: "card",
      title: "강사",
      titleEn: "Tutor",
      href: "/compendium/cards?card=tutor",
    },
    "강ㅅ",
    serviceMessages.ko.globalSearch.labels,
  ),
  null,
);

const koLabels = serviceMessages.ko.globalSearch.labels;

function item(overrides: Partial<GlobalSearchIndexItem> & Pick<GlobalSearchIndexItem, "id" | "title">): GlobalSearchIndexItem {
  return {
    type: "card",
    titleEn: "",
    description: "",
    descriptionEn: "",
    imageUrl: null,
    href: "/",
    ...overrides,
  };
}

// An exact name beats a prefix, a prefix beats a substring, and a name beats
// a description, whatever the type order says.
assert.deepEqual(
  rankGlobalSearchResults(
    [
      item({ id: "PATCH", type: "patch", title: "분노 조절 패치", description: "분노" }),
      item({ id: "STORY", type: "story", title: "어떤 이야기", description: "분노가 들어간 이야기" }),
      item({ id: "MIDDLE", title: "참을 수 없는 분노" }),
      item({ id: "ANGER", title: "분노" }),
    ],
    "분노",
    koLabels,
  ).map((entry) => entry.id),
  ["ANGER", "PATCH", "MIDDLE", "STORY"],
);

// Same name in both games: STS2 first. An STS1-only exact name still wins.
assert.deepEqual(
  rankGlobalSearchResults(
    [
      item({ id: "STS1_BASH", title: "강타", game: "sts1" }),
      item({ id: "BASH", title: "강타" }),
      item({ id: "STS1_ONLY", title: "강타의 메아리", game: "sts1" }),
    ],
    "강타",
    koLabels,
  ).map((entry) => entry.id),
  ["BASH", "STS1_BASH", "STS1_ONLY"],
);
assert.equal(
  rankGlobalSearchResults(
    [
      item({ id: "STS2_PREFIX", title: "축복받은 망치" }),
      item({ id: "STS1_EXACT", title: "축복", game: "sts1" }),
    ],
    "축복",
    koLabels,
  )[0]?.id,
  "STS1_EXACT",
);

// The real index: exact names come first.
const indexPath = "public/generated/search-index.json";
const realItems = (JSON.parse(readFileSync(indexPath, "utf8")) as { items: GlobalSearchIndexItem[] }).items;
for (const [query, expectedTitle] of [
  ["타격", "타격"],
  ["수비", "수비"],
  ["분노", "분노"],
  ["파괴광선", "파괴광선"],
  ["니오우", "니오우"],
  ["Strike", "타격"],
] as const) {
  const [first] = rankGlobalSearchResults(realItems, query, koLabels);
  assert.equal(first?.title, expectedTitle, `first result for ${query}`);
}

console.log("Korean fuzzy search regressions passed");
