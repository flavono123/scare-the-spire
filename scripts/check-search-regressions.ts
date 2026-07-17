import assert from "node:assert/strict";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { matchEntities } from "@/lib/chemical-utils";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import {
  globalSearchItemScore,
  globalSearchTypeLabels,
  type GlobalSearchIndexItem,
} from "@/lib/global-search";

assert.equal(fuzzyMatchCodexText("타격", "ㅌㄱ"), true);
assert.equal(fuzzyMatchCodexText("아이언클래드", "ㅇㅇㅋㄹㄷ"), true);
assert.equal(fuzzyMatchCodexText("네크로바인더", "ㄴㅋㄹㅂㅇㄷ"), true);

const entities: EntityInfo[] = [
  {
    id: "IRONCLAD",
    type: "character",
    nameKo: "아이언클래드",
    nameEn: "The Ironclad",
    imageUrl: null,
    href: "/compendium/characters?character=ironclad",
  },
  {
    id: "NECROBINDER",
    type: "character",
    nameKo: "네크로바인더",
    nameEn: "The Necrobinder",
    imageUrl: null,
    href: "/compendium/characters?character=necrobinder",
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
  globalSearchItemScore(globalSearchItem, "ㅇㅇㅋㄹㄷ", globalSearchTypeLabels.ko),
  null,
);

console.log("Korean fuzzy search regressions passed");
