import assert from "node:assert/strict";
import {
  blocksToPlainText,
  blocksToStorageText,
  blocksToTiptapDocument,
  sanitizeRichTextJson,
  tiptapToBlocks,
} from "../src/lib/chemical-utils";
import { transfigureBlocksSignature } from "../src/lib/transfigure-types";

const dirtyDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "완벽한 \u0000타격 " },
        {
          type: "entity-mention",
          attrs: {
            id: "perfected_strike\u0000",
            entityType: "card\u0000",
            label: "완벽한 타격\u0000",
            mentionSuggestionChar: "\u0000",
          },
        },
        {
          type: "custom-keyword",
          attrs: {
            text: "완타\u0000",
            keyword: "완벽한 타격\u0000",
            description: "타격 카드\u0000",
          },
        },
        {
          type: "youtube-reference",
          attrs: {
            videoId: "dQw4w9WgXcQ\u0000",
            title: "영상 제목\u0000",
          },
        },
        {
          type: "history-run-reference",
          attrs: {
            runId: "1abcdefghijklmno\u0000",
            title: "",
            character: "CHARACTER.IRONCLAD\u0000",
            startTime: 1_752_669_600,
            ascension: 10,
            win: true,
            totalFloors: 52,
            runTime: 3_600,
            build: "v0.109.0\u0000",
            seed: "ABC123\u0000",
          },
        },
      ],
    },
  ],
};

const sanitizedDocument = sanitizeRichTextJson(dirtyDocument);
assert.equal(JSON.stringify(sanitizedDocument).includes("\\u0000"), false);

const blocks = tiptapToBlocks(dirtyDocument);
assert.deepEqual(blocks, [
  { type: "text", text: "완벽한 타격 " },
  {
    type: "entity",
    entityId: "perfected_strike",
    entityType: "card",
    displayText: "완벽한 타격",
  },
  {
    type: "keyword",
    text: "완타",
    keyword: "완벽한 타격",
    description: "타격 카드",
    entityId: undefined,
    entityType: undefined,
  },
  {
    type: "youtube",
    videoId: "dQw4w9WgXcQ",
    title: "영상 제목",
  },
  {
    type: "history-run",
    runId: "1abcdefghijklmno",
    snapshot: {
      title: null,
      character: "CHARACTER.IRONCLAD",
      startTime: 1_752_669_600,
      ascension: 10,
      win: true,
      totalFloors: 52,
      runTime: 3_600,
      build: "v0.109.0",
      seed: "ABC123",
    },
  },
]);
assert.equal(blocksToPlainText(blocks).includes("\u0000"), false);
assert.equal(blocksToStorageText(blocks).includes("\u0000"), false);

const externallyConstructedBlocks = [
  { type: "text" as const, text: "앞\u0000뒤" },
];
assert.equal(blocksToPlainText(externallyConstructedBlocks), "앞뒤");
assert.equal(blocksToStorageText(externallyConstructedBlocks), "앞뒤");

const multilineDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "첫 줄" },
        { type: "hardBreak" },
        { type: "text", text: "둘째 줄" },
      ],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "셋째 줄" }],
    },
  ],
};
const multilineBlocks = tiptapToBlocks(multilineDocument);
assert.deepEqual(multilineBlocks, [
  { type: "text", text: "첫 줄\n둘째 줄\n셋째 줄" },
]);
assert.equal(blocksToPlainText(multilineBlocks), "첫 줄\n둘째 줄\n셋째 줄");
assert.deepEqual(
  blocksToTiptapDocument(multilineBlocks),
  {
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "첫 줄" },
        { type: "hardBreak" },
        { type: "text", text: "둘째 줄" },
        { type: "hardBreak" },
        { type: "text", text: "셋째 줄" },
      ],
    }],
  },
);
assert.notEqual(
  transfigureBlocksSignature([{ type: "text", text: "첫 줄 둘째 줄" }]),
  transfigureBlocksSignature([{ type: "text", text: "첫 줄\n둘째 줄" }]),
);

console.log("rich content NUL sanitization: ok");
