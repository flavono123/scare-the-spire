import assert from "node:assert/strict";
import { nextRoutingResponse } from "../workers/next-routing-parity";
import { redactPathname } from "../workers/path-redaction";

function route(path: string, method = "GET") {
  const url = new URL(`https://example.test${path}`);
  const response = nextRoutingResponse(new Request(url, { method }), url);
  return response && { status: response.status, location: response.headers.get("location") };
}

// Responses production returned from OpenNext (relative Location, query kept).
assert.deepEqual(route("/ko"), { status: 308, location: "/" });
assert.deepEqual(route("/ko/compendium/cards"), { status: 308, location: "/compendium/cards" });
assert.deepEqual(route("/kor"), { status: 308, location: "/" });
assert.deepEqual(route("/kor/compendium/cards"), { status: 308, location: "/compendium/cards" });
assert.deepEqual(route("/kor?x=1"), { status: 308, location: "/?x=1" });
assert.deepEqual(route("/ko/compendium?x=1"), { status: 308, location: "/compendium?x=1" });
assert.deepEqual(route("/ko/?x=1"), { status: 308, location: "/ko?x=1" });
assert.deepEqual(route("/ko//compendium"), { status: 308, location: "/ko/compendium" });
assert.deepEqual(route("/foo//bar?q=1"), { status: 308, location: "/foo/bar?q=1" });
assert.deepEqual(route("/nonexist/"), { status: 308, location: "/nonexist" });
assert.deepEqual(route("/nonexist/?q=1"), { status: 308, location: "/nonexist?q=1" });
assert.deepEqual(route("/this-or-that/worldcup/"), { status: 308, location: "/this-or-that/worldcup" });
assert.deepEqual(route("/robots.txt/"), { status: 308, location: "/robots.txt" });
assert.deepEqual(route("/nonexist/", "POST"), { status: 308, location: "/nonexist" });
assert.equal(route("/KO/compendium"), null, "Config redirects are case-sensitive");
assert.equal(route("/korean"), null);
assert.equal(route("/"), null);
assert.equal(route("/api/link-preview/"), null, "OpenNext skipped the trailing-slash redirect for /api/");
assert.equal(route("/api/"), null);
assert.equal(route("/compendium/cards"), null);
assert.deepEqual(route("/_next/data/build/index.json"), { status: 404, location: null });

assert.equal(redactPathname("/chemical-x/00000000-0000-4000-8000-000000000000/extra"), "/chemical-x/{id}/extra");
assert.equal(redactPathname("/en/this-or-that/some-post"), "/en/this-or-that/{id}");
assert.equal(redactPathname("/defragment/combo/abc"), "/defragment/combo/{id}");
assert.equal(redactPathname("/does-not-exist"), "/does-not-exist");

console.log("next-routing-parity.spec.ts ok");
