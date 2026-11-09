/**
 * Keeps the header policy in one piece: `public/_headers` must equal
 * workers/security-headers.ts, and every path through either Worker must send it.
 *
 * Usage: tsx scripts/security-headers.spec.ts [built asset directory ...]
 * A named directory (.cloudflare/assets, .patch-worker/assets) must hold the same
 * `_headers` rule, so a build cannot ship a stale copy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import mainWorker from "../workers/main-worker";
import patchWorker from "../workers/patch-worker";
import { SECURITY_HEADERS, withSecurityHeaders } from "../workers/security-headers";
import { globalHeaders, PUBLIC_HEADERS_FILE } from "./security-headers-file.mjs";

// Limits Cloudflare documents for a `_headers` file.
const MAX_RULES = 100;
const MAX_LINE_LENGTH = 2000;

const ORIGIN = "https://smoke.test";
const ctx = { waitUntil() {} };

function assertSecured(response: Response, label: string) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(response.headers.get(name), value, `${label}: ${name}`);
  }
}

function assertHeadersFile(file: string) {
  const text = readFileSync(file, "utf8");
  assert.deepEqual(
    Object.fromEntries(globalHeaders(text)),
    { ...SECURITY_HEADERS },
    `${file} differs from workers/security-headers.ts`,
  );

  const lines = text.split("\n");
  assert.ok(lines.filter((line) => /^\S/.test(line)).length <= MAX_RULES, `${file}: too many rules`);
  for (const line of lines) {
    assert.ok(line.length <= MAX_LINE_LENGTH, `${file}: line over ${MAX_LINE_LENGTH} characters`);
  }
}

function fakeAssets(respond: (pathname: string) => Response) {
  return {
    fetch: async (request: Request) => respond(new URL(request.url).pathname),
  };
}

const html = () => new Response("<html></html>", { headers: { "content-type": "text/html" } });
const missing = () => new Response(null, { status: 404 });

/** Step 6 (docs/supabase-exit/STEP6_PLAN.md 1.2): the browser connects to no Supabase host. */
function assertConnectSources() {
  const policy = SECURITY_HEADERS["Content-Security-Policy-Report-Only"];
  const connect = policy.split("; ").find((directive) => directive.startsWith("connect-src "));
  assert.equal(connect, "connect-src 'self' https://cloudflareinsights.com https://www.youtube.com");
  assert.doesNotMatch(policy, /supabase/i, "no Supabase host in the policy");
}

async function main() {
  assertConnectSources();
  assertHeadersFile(PUBLIC_HEADERS_FILE);
  for (const directory of process.argv.slice(2)) {
    assertHeadersFile(path.join(directory, "_headers"));
  }

  const redirect = withSecurityHeaders(Response.redirect(`${ORIGIN}/en`, 302));
  assertSecured(redirect, "immutable redirect");
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), `${ORIGIN}/en`);

  const body = withSecurityHeaders(new Response("body", { status: 418, statusText: "Teapot" }));
  assert.equal(await body.text(), "body");
  assert.equal(body.status, 418);
  assert.equal(body.statusText, "Teapot");

  assertSecured(withSecurityHeaders(new Response(null, { status: 304 })), "not modified");

  const env = {
    ASSETS: fakeAssets((pathname) => (pathname.includes("/_cf_static_pages/index.") ? html() : missing())),
    PATCH_WORKER: { fetch: async () => Response.redirect(`${ORIGIN}/patches/1`, 307) },
  };
  const paths: [string, RequestInit, number][] = [
    ["/", {}, 200],
    ["/", { headers: { accept: "text/html", "accept-language": "en" } }, 302],
    ["/ko", {}, 308],
    ["/does-not-exist/", {}, 308],
    ["/compendium/powers?power=strength", { headers: { accept: "text/html" } }, 308],
    ["/does-not-exist", {}, 404],
    ["/patches/1", {}, 307],
    ["/api/link-preview?url=http%3A%2F%2F127.0.0.1%2F", {}, 400],
    ["/api/link-preview", { method: "OPTIONS" }, 204],
    ["/api/link-preview", { method: "POST" }, 405],
  ];
  for (const [pathname, init, status] of paths) {
    const response = await mainWorker.fetch(new Request(`${ORIGIN}${pathname}`, init), env, ctx);
    assert.equal(response.status, status, pathname);
    assertSecured(response, `main Worker ${pathname}`);
  }

  const unavailable = await mainWorker.fetch(new Request(`${ORIGIN}/patches`), { ASSETS: env.ASSETS }, ctx);
  assert.equal(unavailable.status, 503);
  assertSecured(unavailable, "main Worker without the patch binding");

  for (const [pathname, respond, status] of [
    ["/patches/1", html, 200],
    ["/missing", missing, 404],
  ] as const) {
    const response = await patchWorker.fetch(new Request(`${ORIGIN}${pathname}`), { ASSETS: fakeAssets(respond) });
    assert.equal(response.status, status, pathname);
    assertSecured(response, `patch Worker ${pathname}`);
  }
}

main().then(
  () => console.log("security-headers.spec.ts ok"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
