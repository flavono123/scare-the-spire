import assert from "node:assert/strict";
import { isPublicHttpUrl, readOpenGraph } from "../src/lib/link-preview";

const html = `
<html><head>
<meta property="og:title" content="도누 - 나무위키">
<meta name="description" content="도넛과 혼동">
<meta content="https://i.namu.wiki/cover.jpg" property="og:image">
<title>ignored</title>
</head><body></body></html>`;

const preview = readOpenGraph(html, "https://namu.wiki/w/도누");
assert.equal(preview.title, "도누 - 나무위키");
assert.equal(preview.description, "도넛과 혼동");
assert.equal(preview.image, "https://i.namu.wiki/cover.jpg");

assert.equal(readOpenGraph("<html><head><title>Fallback &amp; Co</title></head>", "https://example.com").title, "Fallback & Co");
assert.equal(isPublicHttpUrl("https://namu.wiki/w/a")?.hostname, "namu.wiki");
assert.equal(isPublicHttpUrl("http://127.0.0.1/secret"), null);
assert.equal(isPublicHttpUrl("https://192.168.0.1/"), null);
assert.equal(isPublicHttpUrl("https://user:pass@example.com"), null);
