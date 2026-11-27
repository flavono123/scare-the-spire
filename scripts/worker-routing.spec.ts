/**
 * Worker routing a browser or crawler sees, run against fake asset bindings.
 * Run: pnpm exec tsx scripts/worker-routing.spec.ts
 */
import assert from "node:assert/strict";

import { serviceMessages } from "../src/messages/service";
import { NOT_FOUND_TITLE_EN } from "../workers/document-locale";
import * as mainEntry from "../workers/main-worker";
import * as patchEntry from "../workers/patch-worker";
import { LATEST_PATCH_VERSION_ASSET } from "../workers/patch-worker-assets";
import * as sts1Entry from "../workers/sts1-worker";

const mainWorker = mainEntry.default;
const patchWorker = patchEntry.default;
const LEGACY_WORKERS_DEV_HOST = "scare-the-spire.flavono123.workers.dev";

// workerd takes every named export of a Worker entry as an entrypoint and will not start on any other
// value: `wrangler dev` dies and local /api shows "database is not answering". Production tolerates it.
for (const [name, entry] of Object.entries({ mainEntry, patchEntry, sts1Entry })) {
  for (const [key, value] of Object.entries(entry)) {
    assert.ok(key === "default" || typeof value === "function", `${name} exports non-entrypoint "${key}"`);
  }
}

const ORIGIN = "https://routing.test";
const ctx = { waitUntil() {} };
const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0 Safari/537.36";
const GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const assets = {
  async fetch(request: Request) {
    return new URL(request.url).pathname === "/_cf_static_pages/index.html"
      ? new Response("<html lang=\"ko\"></html>", { status: 200 })
      : new Response("missing", { status: 404 });
  },
};

async function home(userAgent: string): Promise<Response> {
  return mainWorker.fetch(
    new Request(`${ORIGIN}/`, {
      headers: { accept: "text/html", "accept-language": "en-US,en;q=0.9", "user-agent": userAgent },
    }),
    { ASSETS: assets },
    ctx,
  );
}

const patchAssets = {
  async fetch(request: Request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/patches/1/index.html") return new Response("page");
    if (pathname === LATEST_PATCH_VERSION_ASSET) return new Response("0.114.0\n");
    const locale = /^\/_patches\/not-found\/([^/]+)\/index\.html$/.exec(pathname)?.[1];
    return locale
      ? new Response(`not-found:${locale}`)
      : new Response("missing", { status: 404 });
  },
};

async function patchPage(path: string, headers: Record<string, string> = {}): Promise<string> {
  const response = await patchWorker.fetch(new Request(`${ORIGIN}${path}`, { headers }), { ASSETS: patchAssets });
  return `${response.status} ${await response.text()}`;
}

async function main() {
  const person = await home(CHROME_UA);
  assert.equal(person.status, 302);
  assert.equal(person.headers.get("location"), `${ORIGIN}/en`);

  const crawler = await home(GOOGLEBOT_UA);
  assert.equal(crawler.status, 200, "crawlers keep the requested language page");
  assert.equal(crawler.headers.get("location"), null);

  const notFound = serviceMessages.en;
  assert.equal(NOT_FOUND_TITLE_EN, `${notFound.notFound.title} - ${notFound.brand}`);

  assert.equal(await patchPage("/patches/1"), "200 page");
  assert.equal(await patchPage("/patches/nope"), "404 not-found:ko");
  assert.equal(await patchPage("/ja/patches/nope"), "404 not-found:ja");
  assert.equal(await patchPage("/EN/patches/nope"), "404 not-found:en");
  assert.equal(await patchPage("/xx/patches/nope"), "404 not-found:ko");
  assert.equal(await patchPage("/patches/nope", { rsc: "1" }), "404 missing");
  assert.equal(await patchPage("/patches/nope?_rsc=abc"), "404 missing");
  assert.equal(await patchPage("/patches/nope.png"), "404 missing");
  assert.equal(await patchPage("/_patches/nope.js"), "404 missing");

  const latest = await patchWorker.fetch(new Request(`${ORIGIN}/patches/latest?ref=x`), { ASSETS: patchAssets });
  assert.equal(latest.status, 302);
  assert.equal(latest.headers.get("location"), "/patches/0.114.0?ref=x");
  const latestEn = await patchWorker.fetch(new Request(`${ORIGIN}/en/patches/latest/`), { ASSETS: patchAssets });
  assert.equal(latestEn.headers.get("location"), "/en/patches/0.114.0");
  assert.equal(await patchPage("/xx/patches/latest"), "404 not-found:ko");

  const legacy = `https://${LEGACY_WORKERS_DEV_HOST}`;
  const redirectEnv = { ASSETS: assets, LEGACY_HOST_REDIRECT: "https://new.test" };
  const botUa = { headers: { "user-agent": GOOGLEBOT_UA } };
  const moved = await mainWorker.fetch(new Request(`${legacy}/en/compendium/cards?q=a`, botUa), redirectEnv, ctx);
  assert.equal(moved.status, 301, "search engines move with a 301");
  assert.equal(moved.headers.get("location"), "https://new.test/en/compendium/cards?q=a");
  const apiRead = await mainWorker.fetch(new Request(`${legacy}/api/read/x`), redirectEnv, ctx);
  assert.equal(apiRead.status, 301, "cookieless API reads move");
  const apiOwner = await mainWorker.fetch(new Request(`${legacy}/api/read/x`, { headers: { cookie: "slseoun_id=signed" } }), redirectEnv, ctx);
  assert.notEqual(apiOwner.status, 301, "a page that stayed keeps its API calls here");

  // Cookieless browsers get the chooser: stored data keeps them here, none sends them on.
  const chooser = await mainWorker.fetch(
    new Request(`${legacy}/en/compendium/cards?q=a&b=1`, { headers: { accept: "text/html", "user-agent": CHROME_UA } }),
    redirectEnv,
    ctx,
  );
  assert.equal(chooser.status, 200);
  const html = await chooser.text();
  assert.ok(!/<a\b/i.test(html), "no links for crawlers to follow");
  assert.ok(html.includes('href="https://new.test/en/compendium/cards?q=a&amp;b=1"'));
  const script = /<script>([\s\S]*)<\/script>/.exec(html)?.[1] ?? "";
  async function runChooser(stored: { local: number; dbs: number; cookiesWork?: boolean }) {
    const seen = { cookie: "", reloaded: false, replaced: "" };
    const document = {
      get cookie() { return seen.cookie; },
      set cookie(value: string) { if (stored.cookiesWork !== false) seen.cookie = value.split(";")[0]; },
    };
    const location = { reload() { seen.reloaded = true; }, replace(to: string) { seen.replaced = to; } };
    const localStorage = { length: stored.local };
    const indexedDB = { databases: async () => Array.from({ length: stored.dbs }) };
    await new Function("document", "location", "localStorage", "indexedDB", `return (${script.replace(/^\(/, "").replace(/\)\(\)$/, "")})()`)(
      document, location, localStorage, indexedDB,
    );
    return seen;
  }
  assert.deepEqual(await runChooser({ local: 2, dbs: 0 }), { cookie: "slseoun_stay=1", reloaded: true, replaced: "" });
  assert.deepEqual(await runChooser({ local: 0, dbs: 1 }), { cookie: "slseoun_stay=1", reloaded: true, replaced: "" });
  assert.equal((await runChooser({ local: 0, dbs: 0 })).replaced, "https://new.test/en/compendium/cards?q=a&b=1");
  assert.equal((await runChooser({ local: 3, dbs: 0, cookiesWork: false })).replaced, "https://new.test/en/compendium/cards?q=a&b=1", "no reload loop without cookies");
  const stayed = await mainWorker.fetch(new Request(`${legacy}/`, { headers: { cookie: "slseoun_stay=1", "user-agent": GOOGLEBOT_UA } }), redirectEnv, ctx);
  assert.notEqual(stayed.status, 301);
  assert.ok(!(await stayed.text()).includes("location.replace"));
  const movedWrite = await mainWorker.fetch(new Request(`${legacy}/api/x`, { method: "POST" }), redirectEnv, ctx);
  assert.equal(movedWrite.status, 308);
  const otherHost = await mainWorker.fetch(new Request(`${ORIGIN}/`, { headers: { "user-agent": GOOGLEBOT_UA } }), redirectEnv, ctx);
  assert.notEqual(otherHost.status, 301);
  const returning = { headers: { cookie: "a=1; slseoun_idm=cookie", "user-agent": GOOGLEBOT_UA } };
  const kept = await mainWorker.fetch(new Request(`${legacy}/`, returning), redirectEnv, ctx);
  assert.notEqual(kept.status, 301);
  const movedAll = await mainWorker.fetch(
    new Request(`${legacy}/`, returning),
    { ...redirectEnv, LEGACY_HOST_REDIRECT_SCOPE: "all" },
    ctx,
  );
  assert.equal(movedAll.headers.get("location"), "https://new.test/");
  const www = await mainWorker.fetch(new Request("https://www.new.test/a?b=1", returning), redirectEnv, ctx);
  assert.equal(www.headers.get("location"), "https://new.test/a?b=1", "www always moves, cookie or not");
  const apex = await mainWorker.fetch(new Request("https://new.test/", { headers: { "user-agent": GOOGLEBOT_UA } }), redirectEnv, ctx);
  assert.equal(apex.headers.get("location"), null);
  const switchedOff = await mainWorker.fetch(new Request(`${legacy}/`, botUa), { ASSETS: assets }, ctx);
  assert.equal(switchedOff.headers.get("location"), null);
}

main().then(
  () => console.log("worker routing spec passed"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
