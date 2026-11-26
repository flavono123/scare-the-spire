/**
 * Worker routing a browser or crawler sees, run against fake asset bindings.
 * Run: pnpm exec tsx scripts/worker-routing.spec.ts
 */
import assert from "node:assert/strict";

import { serviceMessages } from "../src/messages/service";
import { NOT_FOUND_TITLE_EN } from "../workers/document-locale";
import mainWorker, { LEGACY_WORKERS_DEV_HOST } from "../workers/main-worker";
import patchWorker, { LATEST_PATCH_VERSION_ASSET } from "../workers/patch-worker";

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
  const moved = await mainWorker.fetch(new Request(`${legacy}/en/compendium/cards?q=a`), redirectEnv, ctx);
  assert.equal(moved.status, 301);
  assert.equal(moved.headers.get("location"), "https://new.test/en/compendium/cards?q=a");
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
  const switchedOff = await mainWorker.fetch(new Request(`${legacy}/`, { headers: { "user-agent": GOOGLEBOT_UA } }), { ASSETS: assets }, ctx);
  assert.equal(switchedOff.headers.get("location"), null);
}

main().then(
  () => console.log("worker routing spec passed"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
