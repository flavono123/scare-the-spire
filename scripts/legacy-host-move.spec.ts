/**
 * Moving workers.dev visitors to the own domain with their profile (workers/legacy-host-move.ts).
 * Runs the two inline scripts against fake browser storage.
 * Run: pnpm exec tsx scripts/legacy-host-move.spec.ts
 */
import assert from "node:assert/strict";

import { signIdentityCookie, verifyIdentityCookie } from "../workers/api/identity/cookie";
import mainWorker from "../workers/main-worker";
import { LEGACY_WORKERS_DEV_HOST } from "../workers/legacy-host-move";

const SECRET = "s".repeat(40);
const UID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const LEGACY = `https://${LEGACY_WORKERS_DEV_HOST}`;
const env = {
  ASSETS: { fetch: async () => new Response("asset") },
  LEGACY_HOST_REDIRECT: "https://new.test",
  API_IDENTITY_SECRET: SECRET,
};
const ctx = { waitUntil() {} };
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CHROME = "Mozilla/5.0 (Macintosh) Chrome/130.0 Safari/537.36";

const call = (url: string, init: RequestInit = {}, e: Record<string, unknown> = env) =>
  mainWorker.fetch(new Request(url, init), e as never, ctx);

type Run = { runId: string; origin?: string; raw: string };

/** Just enough IndexedDB for the two scripts: one database holding the runs store. */
function fakeIndexedDb(runs: Run[] | null) {
  const db = {
    objectStoreNames: { contains: (name: string) => name === "runs" && runs !== null },
    createObjectStore() {
      runs = [];
      return { createIndex() {} };
    },
    transaction() {
      const tx: Record<string, unknown> = {
        objectStore: () => ({
          getAll() {
            const req: Record<string, unknown> = { result: [...(runs ?? [])] };
            setTimeout(() => (req.onsuccess as () => void)());
            return req;
          },
          put(run: Run) {
            runs = [...(runs ?? []).filter((r) => r.runId !== run.runId), run];
            setTimeout(() => (tx.oncomplete as () => void)());
          },
        }),
      };
      return tx;
    },
    close() {},
  };
  return {
    get runs() {
      return runs;
    },
    open() {
      const req: Record<string, unknown> = { result: db, transaction: { abort() {} } };
      setTimeout(() => {
        if (runs === null && req.onupgradeneeded) (req.onupgradeneeded as () => void)();
        (req.onsuccess as () => void)();
      });
      return req;
    },
  };
}

function fakeLocalStorage(initial: Record<string, string>) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  };
}

async function runScript(html: string, globals: Record<string, unknown>) {
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1] ?? "";
  const names = Object.keys(globals);
  await new Function(...names, `return ${code.replace(/\(\)$/, "")}()`)(...names.map((n) => globals[n]));
}

function browser(opts: { local?: Record<string, string>; runs?: Run[] | null; token?: string; dataHtml?: string }) {
  const seen = { replaced: "", submitted: null as null | { action: string; enctype: string; fields: Record<string, string> } };
  const localStorage = fakeLocalStorage(opts.local ?? {});
  const indexedDB = fakeIndexedDb(opts.runs ?? null);
  const form = { method: "", action: "", enctype: "", inputs: [] as { name: string; value: string }[] };
  const document = {
    body: { appendChild() {} },
    getElementById: (id: string) => ({ textContent: id === "d" ? /<script id="d"[^>]*>([^<]*)<\/script>/.exec(opts.dataHtml ?? "")?.[1] ?? "" : "" }),
    createElement(tag: string) {
      if (tag === "form") {
        return Object.assign(form, {
          appendChild: (i: { name: string; value: string }) => form.inputs.push(i),
          submit: () => {
            seen.submitted = {
              action: form.action,
              enctype: form.enctype,
              fields: Object.fromEntries(form.inputs.map((i) => [i.name, i.value])),
            };
          },
        });
      }
      return { type: "", name: "", value: "" };
    },
  };
  const location = { hash: "", replace: (to: string) => void (seen.replaced = to) };
  const fetch = async () => Response.json({ token: opts.token ?? "" });
  return { seen, localStorage, indexedDB, globals: { document, location, localStorage, indexedDB, fetch } };
}

async function main() {
  // Search engines, www and cookieless API requests move with a redirect.
  const bot = await call(`${LEGACY}/en/compendium/cards?q=a`, { headers: { "user-agent": GOOGLEBOT } });
  assert.equal(bot.status, 301);
  assert.equal(bot.headers.get("location"), "https://new.test/en/compendium/cards?q=a");
  assert.equal((await call("https://www.new.test/a?b=1")).headers.get("location"), "https://new.test/a?b=1");
  assert.equal((await call(`${LEGACY}/api/read/x`)).status, 301);
  assert.equal((await call(`${LEGACY}/api/write/x`, { method: "POST" })).status, 308);
  const openTab = await call(`${LEGACY}/api/read/x`, { headers: { cookie: "slseoun_id=v1.x" } });
  assert.notEqual(openTab.status, 301, "API calls of tabs still open on the old host keep working");
  assert.equal((await call(`${LEGACY}/`, {}, { ...env, LEGACY_HOST_REDIRECT: undefined })).headers.get("location"), null);
  assert.equal((await call("https://other.test/")).headers.get("location"), null);

  // Every browser page request, cookie or not, gets the linkless handoff page.
  const page = await call(`${LEGACY}/en/compendium/cards?q=a&b=1`, {
    headers: { accept: "text/html", "user-agent": CHROME, cookie: "slseoun_idm=cookie; slseoun_stay=1" },
  });
  assert.equal(page.status, 200);
  const pageHtml = await page.text();
  assert.ok(!/<a\b/i.test(pageHtml), "no links for crawlers to follow");
  assert.ok(pageHtml.includes('href="https://new.test/en/compendium/cards?q=a&amp;b=1"'));

  // Handoff token: the old host's identity as a cookie value good for two minutes.
  const cookie = await signIdentityCookie(SECRET, UID);
  const tokenBody = (await (await call(`${LEGACY}/api/auth/handoff`, { method: "POST", headers: { cookie: `slseoun_id=${cookie}` } })).json()) as { token: string };
  const check = await verifyIdentityCookie(SECRET, tokenBody.token);
  assert.ok(check.ok && check.uid === UID);
  const later = await verifyIdentityCookie(SECRET, tokenBody.token, Math.floor(Date.now() / 1000) + 180);
  assert.equal(later.ok, false, "the token is dead after two minutes");
  const anonymous = (await (await call(`${LEGACY}/api/auth/handoff`, { method: "POST" })).json()) as { token: string };
  assert.equal(anonymous.token, "");

  // Nothing stored: go straight to the new page.
  const empty = browser({});
  await runScript(pageHtml, empty.globals);
  assert.equal(empty.seen.replaced, "https://new.test/en/compendium/cards?q=a&b=1");
  assert.equal(empty.seen.submitted, null);

  // Already handed off once: never overwrite newer data on the new domain.
  const done = browser({ local: { "slseoun-handoff-done": "1", theme: "dark" }, token: tokenBody.token });
  await runScript(pageHtml, done.globals);
  assert.equal(done.seen.replaced, "https://new.test/en/compendium/cards?q=a&b=1");
  assert.equal(done.seen.submitted, null);

  // Stored data and identity: posted as a text/plain form; someone else's cached runs stay behind.
  const runs = [
    { runId: "own", raw: "한글 run", origin: "upload" },
    { runId: "shared", raw: "x", origin: "donation-cache" },
  ];
  const old = browser({ local: { "slseoun-identity": UID, theme: "dark" }, runs, token: tokenBody.token });
  await runScript(pageHtml, old.globals);
  const sent = old.seen.submitted;
  assert.ok(sent);
  assert.equal(sent.action, "https://new.test/__handoff");
  assert.equal(sent.enctype, "text/plain");
  assert.equal(sent.fields.t, tokenBody.token);
  assert.equal(sent.fields.p, "/en/compendium/cards?q=a&b=1");
  assert.equal(old.localStorage.getItem("slseoun-handoff-done"), "1");

  // The new domain takes it only from the old host's own page.
  const body = `t=${sent.fields.t}\r\np=${sent.fields.p}\r\nd=${sent.fields.d}\r\n`;
  const forged = await call("https://new.test/__handoff", { method: "POST", body, headers: { origin: "https://evil.test" } });
  assert.equal(forged.status, 303);
  assert.equal(forged.headers.get("set-cookie"), null);
  const received = await call("https://new.test/__handoff", {
    method: "POST",
    body,
    headers: { origin: LEGACY, "content-type": "text/plain" },
  });
  assert.equal(received.status, 200);
  const setCookie = received.headers.get("set-cookie") ?? "";
  const moved = await verifyIdentityCookie(SECRET, /slseoun_id=([^;]+)/.exec(setCookie)?.[1] ?? null);
  assert.ok(moved.ok && moved.uid === UID && !moved.renew, "a fresh full-length identity cookie on the new domain");
  assert.ok(setCookie.includes("HttpOnly") && setCookie.includes("Path=/api/"));

  // Its script restores storage over what the new domain had and opens the requested page.
  const receivedHtml = await received.text();
  const fresh = browser({ local: { theme: "light", other: "kept" }, runs: [], dataHtml: receivedHtml });
  await runScript(receivedHtml, fresh.globals);
  assert.equal(fresh.seen.replaced, "https://new.test/en/compendium/cards?q=a&b=1");
  assert.equal(fresh.localStorage.getItem("theme"), "dark");
  assert.equal(fresh.localStorage.getItem("slseoun-identity"), UID);
  assert.equal(fresh.localStorage.getItem("other"), "kept");
  assert.deepEqual(fresh.indexedDB.runs?.map((r) => [r.runId, r.raw]), [["own", "한글 run"]]);

  // A body that is not base64 restores nothing but still opens the page; a foreign path goes home.
  const bad = await call("https://new.test/__handoff", {
    method: "POST",
    body: "t=\r\np=//evil.test/x\r\nd=<script>alert(1)</script>\r\n",
    headers: { origin: LEGACY },
  });
  const badHtml = await bad.text();
  assert.ok(!badHtml.includes("alert(1)"));
  assert.ok(badHtml.includes('"https://new.test/"'));
}

main().then(
  () => console.log("legacy host move spec passed"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
