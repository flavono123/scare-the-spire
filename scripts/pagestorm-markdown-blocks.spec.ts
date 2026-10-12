import assert from "node:assert/strict";
import { openingCodeFence, parseFencedCodeBlocks } from "../src/components/pagestorm/markdown-blocks";

assert.deepEqual(openingCodeFence("```"), { language: "" });
assert.deepEqual(openingCodeFence("```ts"), { language: "ts" });
assert.equal(openingCodeFence("``` ts"), null);
assert.equal(openingCodeFence("not ```"), null);

const fenced = parseFencedCodeBlocks("앞문장\n```ts\nconst n = 1;\n```\n뒷문장");
assert.equal(fenced?.[0]?.type, "paragraph");
assert.equal(fenced?.[1]?.type, "codeBlock");
assert.equal(fenced?.[1]?.attrs?.language, "ts");
assert.equal(fenced?.[1]?.content?.[0]?.text, "const n = 1;");
assert.equal(fenced?.[2]?.content?.[0]?.text, "뒷문장");

const indented = parseFencedCodeBlocks("```\n  keep\n indent\n```");
assert.equal(indented?.[0]?.content?.[0]?.text, "  keep\n indent");

assert.equal(parseFencedCodeBlocks("그냥 문장"), null);
