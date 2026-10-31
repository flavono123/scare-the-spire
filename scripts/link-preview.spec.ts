import assert from "node:assert/strict";
import { isPublicHttpUrl, readOpenGraph } from "../src/lib/link-preview";
import { handleLinkPreviewRequest } from "../src/lib/link-preview-handler";

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
assert.equal(isPublicHttpUrl("http://100.64.0.1/"), null, "carrier-grade NAT");
assert.equal(isPublicHttpUrl("http://198.18.0.1/"), null, "benchmarking");
assert.equal(isPublicHttpUrl("http://224.0.0.1/"), null, "multicast");
assert.equal(isPublicHttpUrl("http://255.255.255.255/"), null, "broadcast");
assert.equal(isPublicHttpUrl("http://2130706433/"), null, "numeric loopback");
assert.equal(isPublicHttpUrl("http://100.63.0.1/")?.hostname, "100.63.0.1");
assert.equal(isPublicHttpUrl("http://192.0.0.1/"), null, "IETF protocol assignments");
assert.equal(isPublicHttpUrl("http://192.0.2.1/"), null, "TEST-NET-1");
assert.equal(isPublicHttpUrl("http://198.51.100.1/"), null, "TEST-NET-2");
assert.equal(isPublicHttpUrl("http://203.0.113.1/"), null, "TEST-NET-3");
assert.equal(isPublicHttpUrl("http://192.0.1.1/")?.hostname, "192.0.1.1");
assert.equal(isPublicHttpUrl("http://203.0.114.1/")?.hostname, "203.0.114.1");
assert.equal(isPublicHttpUrl("https://metadata.internal/"), null);
assert.equal(isPublicHttpUrl("https://internal./"), null);
assert.equal(isPublicHttpUrl("https://example.com:8443/"), null, "only the web ports");
assert.equal(isPublicHttpUrl("http://example.com:80/")?.hostname, "example.com");
assert.equal(isPublicHttpUrl("https://example.com:443/")?.hostname, "example.com");
assert.equal(isPublicHttpUrl("http://example.com:443/")?.hostname, "example.com");
assert.equal(isPublicHttpUrl("https://scare-the-spire.flavono123.workers.dev/en"), null);
assert.equal(isPublicHttpUrl("https://1234abcd-scare-the-spire-testbed.flavono123.workers.dev/"), null);
assert.equal(isPublicHttpUrl("https://scare-the-spire-patches.flavono123.workers.dev/patches"), null);
assert.equal(isPublicHttpUrl("https://new-domain.example/", "new-domain.example"), null);
assert.equal(isPublicHttpUrl("https://other.workers.dev/", "new-domain.example")?.hostname, "other.workers.dev");

// Every redirect hop must be public; the private hop is never requested.
async function previewThrough(hops: Record<string, Response>) {
  const requested: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    requested.push(url);
    assert.equal(init?.redirect, "manual");
    return hops[url] ?? new Response("missing", { status: 404 });
  }) as typeof fetch;
  try {
    const response = await handleLinkPreviewRequest(
      new Request(`https://example.test/api/link-preview?url=${encodeURIComponent("https://start.example/a")}`),
    );
    return { requested, body: await response.json(), cacheControl: response.headers.get("cache-control") };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const redirectHome = (location: string) => new Response(null, { status: 302, headers: { location } });

async function main() {
  const blocked = await previewThrough({
    "https://start.example/a": redirectHome("http://127.0.0.1:8787/en"),
  });
  assert.deepEqual(blocked.requested, ["https://start.example/a"]);
  assert.deepEqual(blocked.body, { title: "", description: "", image: "" });
  assert.equal(blocked.cacheControl, null);

  const selfRedirect = await previewThrough({
    "https://start.example/a": redirectHome("https://example.test/secret"),
  });
  assert.deepEqual(selfRedirect.requested, ["https://start.example/a"], "a hop back to this host");

  const followed = await previewThrough({
    "https://start.example/a": redirectHome("/b"),
    "https://start.example/b": new Response(
      '<html><head><meta property="og:title" content="Final"><meta property="og:image" content="/cover.png"></head>',
      { headers: { "content-type": "text/html" } },
    ),
  });
  assert.deepEqual(followed.requested, ["https://start.example/a", "https://start.example/b"]);
  assert.equal(followed.body.title, "Final");
  assert.equal(followed.body.image, "https://start.example/cover.png");
}

main().then(
  () => console.log("link-preview.spec.ts ok"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
