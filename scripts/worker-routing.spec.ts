/**
 * Worker routing a browser or crawler sees, run against fake asset bindings.
 * Run: pnpm exec tsx scripts/worker-routing.spec.ts
 */
import assert from "node:assert/strict";

import mainWorker from "../workers/main-worker";

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

async function main() {
  const person = await home(CHROME_UA);
  assert.equal(person.status, 302);
  assert.equal(person.headers.get("location"), `${ORIGIN}/en`);

  const crawler = await home(GOOGLEBOT_UA);
  assert.equal(crawler.status, 200, "crawlers keep the requested language page");
  assert.equal(crawler.headers.get("location"), null);
}

main().then(
  () => console.log("worker routing spec passed"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
