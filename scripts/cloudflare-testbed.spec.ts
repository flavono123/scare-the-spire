import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { HISTORY_RUN_ENGAGEMENT_IDS, isRunId } from "../src/lib/history-runs-api-rules";
import { getSiteOrigin } from "../src/lib/site-origin";

const BASE_URL = (process.env.CF_TESTBED_ORIGIN ?? process.env.BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
// The stack answers /api with data (the testbed, or a local Worker on a seeded D1). The runner sets
// 0 for a local Worker without API vars, where every /api route is 409 by design.
const STACK_HAS_DATA = process.env.CF_TESTBED_DATA !== "0";
const CANONICAL_ORIGIN = (process.env.CF_TESTBED_CANONICAL_ORIGIN ?? getSiteOrigin()).replace(/\/$/, "");
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const LOCAL_RUN_ID = "1testbedlocalrun";
const LOCAL_RUN_RAW = JSON.stringify({
  seed: "42",
  build_id: "v0.109.0",
  ascension: 0,
  game_mode: "standard",
  win: false,
  acts: ["ACT.OVERGROWTH"],
  players: [
    {
      id: 0,
      character: "CHARACTER.IRONCLAD",
      deck: [],
      relics: [],
      potions: [],
      badges: [],
    },
  ],
  modifiers: [],
  map_point_history: [
    [
      {
        map_point_type: "ancient",
        rooms: [{ room_type: "event", model_id: "EVENT.NEOW", turns_taken: 0 }],
        current_hp: 80,
        max_hp: 80,
        current_gold: 99,
      },
      {
        map_point_type: "monster",
        rooms: [{ room_type: "monster", model_id: "ENCOUNTER.CULTIST", turns_taken: 3 }],
        current_hp: 76,
        max_hp: 80,
        current_gold: 112,
      },
    ],
  ],
});

test.use({ locale: "ko-KR" });

// A Report-Only policy fires the same event as an enforced one, so every page
// this suite opens also counts policy violations.
type CspViolation = { directive: string; blocked: string; source: string };
let cspViolations: CspViolation[] = [];

test.beforeEach(async ({ page }) => {
  cspViolations = [];
  await page.exposeFunction("__reportCspViolation", (violation: CspViolation) => {
    cspViolations.push(violation);
  });
  await page.addInitScript(() => {
    // An embed's own policy is not ours to count.
    if (window !== window.top) return;
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = (window as unknown as { __reportCspViolation: (violation: CspViolation) => void })
        .__reportCspViolation;
      report({ directive: event.effectiveDirective, blocked: event.blockedURI, source: event.sourceFile });
    });
  });
});

test.afterEach(() => {
  expect(cspViolations).toEqual([]);
});

function absolute(path: string) {
  return `${BASE_URL}${path}`;
}

function canonical(path: string) {
  return `${CANONICAL_ORIGIN}${path}`;
}

const SUPABASE_HOST = /^https?:\/\/[^/]+\.supabase\.co(?:[:/]|$)/;

/** Cuts the browser off Supabase. Screens read the Worker's same-origin /api, which answers from D1. */
async function blockSupabase(page: Page) {
  await page.route(SUPABASE_HOST, (route) => route.abort("connectionfailed"));
}

/**
 * The Worker's legacy answer: with the QA cookie every /api route is 409 surface_legacy
 * (workers/api/flag-cookie.ts), which the step 6 browser shows as its unavailable state.
 */
async function forceApiLegacyAnswer(page: Page) {
  await page.context().addCookies([{ name: "slseoun_qa", value: "no-supabase", url: BASE_URL }]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("locale matrix keeps static route ownership and service language", async ({ page }) => {
  const routes = [
    { path: "/", owner: "home" },
    { path: "/en", owner: "home" },
    { path: "/zh", owner: "home" },
    { path: "/c-c-c-combo", owner: "service", title: "코오오옴보" },
    { path: "/en/c-c-c-combo", owner: "service", title: "C-c-c-Combo" },
    { path: "/zh/c-c-c-combo", owner: "service", title: "C-c-c-Combo" },
  ];

  for (const route of routes) {
    const response = await page.goto(absolute(route.path), { waitUntil: "domcontentloaded" });
    expect(response?.status(), route.path).toBe(200);
    expect(response?.headers()["x-cf-static-page"], route.path).toBe(route.owner);
    if (route.title) {
      await expect(page.getByRole("heading", { level: 1, name: route.title })).toBeVisible();
    }
  }
});

test("patch index exposes resource change history", async ({ page }) => {
  const indexResponse = await page.goto(absolute("/patches"), { waitUntil: "domcontentloaded" });
  expect(indexResponse?.status()).toBe(200);

  const changesTab = page.getByRole("link", { name: "슬서운 변경" });
  await expect(changesTab).toBeVisible();
  await changesTab.click();

  await expect(page).toHaveURL(absolute("/patches/changes"));
  await expect(page.getByRole("heading", { level: 1, name: "슬서운 변경" })).toBeVisible();
  await expect(page.locator("[data-resource-patch-line]").first()).toBeVisible();
});

test("redirect and canonical metadata match the public locale URL", async ({ request, page }) => {
  const redirect = await request.get(absolute("/"), {
    headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(302);
  expect(new URL(redirect.headers().location).pathname).toBe("/en");

  for (const [legacyPath, canonicalPath] of [
    ["/compendium/relics?relic=fishing_rod&beta=true", "/compendium/relics/fishing_rod"],
    ["/en/compendium/cards?card=dowsing", "/en/compendium/cards/dowsing"],
  ]) {
    const legacyRedirect = await request.get(absolute(legacyPath), {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    });
    expect(legacyRedirect.status(), legacyPath).toBe(308);
    const location = new URL(legacyRedirect.headers().location);
    expect(location.pathname, legacyPath).toBe(canonicalPath);
    expect(location.search, legacyPath).toBe("");
  }

  const gameLocaleModal = await request.get(
    absolute("/zh/compendium/relics?relic=fishing_rod"),
    { headers: { Accept: "text/html" }, maxRedirects: 0 },
  );
  expect(gameLocaleModal.status()).toBe(200);
  expect(gameLocaleModal.headers()["x-cf-static-page"]).toBe("compendium");

  // ko and en are each self-canonical with reciprocal ko/en/x-default alternates.
  // Modifier and ascension details share the same policy as other detail types.
  for (const basePath of [
    "/compendium/powers/painful_stabs",
    "/compendium/modifiers/murderous",
    "/compendium/ascensions/level_08",
  ]) {
    for (const [path, lang] of [
      [basePath, "ko"],
      [`/en${basePath}`, "en"],
    ]) {
      const response = await request.get(absolute(path), { headers: { Accept: "text/html" } });
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      expect(html, path).toMatch(new RegExp(`<html[^>]* lang="${lang}"`));

      await page.goto(absolute(path), { waitUntil: "domcontentloaded" });
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical(path));
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", canonical(path));
      for (const [hrefLang, alternatePath] of [
        ["ko", basePath],
        ["en", `/en${basePath}`],
        ["x-default", `/en${basePath}`],
      ]) {
        await expect(page.locator(`link[rel="alternate"][hreflang="${hrefLang}"]`)).toHaveAttribute(
          "href",
          canonical(alternatePath),
        );
      }
    }
  }
});

test.describe("crawler on an en-US browser", () => {
  test.use({
    locale: "en-US",
    userAgent: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.137 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  });

  test("Googlebot keeps the ko page and its ko canonical after hydration", async ({ page }) => {
    const path = "/compendium/cards/bash";
    const response = await page.goto(absolute(path), { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    // A human en-US visitor is soft-navigated to /en here; a crawler is not.
    await page.waitForTimeout(1_000);
    expect(new URL(page.url()).pathname).toBe(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical(path));
  });
});

test("compendium detail keeps its view on the canonical detail URL", async ({ page }) => {
  // Before hydration the tile is a plain link to the detail page; wait for the
  // client handler that opens the modal.
  await page.goto(absolute("/compendium/relics"), { waitUntil: "networkidle" });

  // Relic tiles preventDefault and open an in-page modal while pushing the
  // canonical detail path. Avoid Playwright's navigation auto-wait so the
  // client click handler owns the transition.
  await page.locator('a[href="/compendium/relics/fishing_rod"]').first().click({
    noWaitAfter: true,
  });

  await expect(page).toHaveURL(absolute("/compendium/relics/fishing_rod"));
  const modal = page.locator(".fixed.inset-0.z-50");
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await expect(modal.getByText("낚싯대").first()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(absolute("/compendium/relics"));
  await expect(modal).toHaveCount(0);
});

test("dynamic service routes refresh directly and invalid nesting fails closed", async ({ request }) => {
  const validShapes = [
    `/chemical-x/${MISSING_UUID}`,
    `/c-c-c-combo/${MISSING_UUID}`,
    `/defragment/${MISSING_UUID}`,
    `/defragment/combo/${MISSING_UUID}`,
    `/defragment/transfigure/${MISSING_UUID}`,
    `/defragment/pagestorm/${MISSING_UUID}`,
    `/defragment/history_course/1testbedmissingrun`,
    `/this-or-that/${MISSING_UUID}`,
    `/this-or-that/tournament/${MISSING_UUID}`,
    `/transfigure/${MISSING_UUID}`,
    `/decisions-decisions/${MISSING_UUID}`,
    `/pagestorm/${MISSING_UUID}`,
    "/history-course/1testbedmissingrun",
  ];
  for (const path of validShapes) {
    const response = await request.get(absolute(path), { headers: { Accept: "text/html" } });
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain("text/html");
    expect(response.headers()["x-cf-static-page"], path).toBe("shell");
  }

  const worldcupRedirect = await request.get(
    absolute(`/this-or-that/worldcup/${MISSING_UUID}`),
    { headers: { Accept: "text/html" }, maxRedirects: 0 },
  );
  expect(worldcupRedirect.status()).toBe(308);
  expect(new URL(worldcupRedirect.headers()["location"], "http://smoke.local").pathname)
    .toBe(`/this-or-that/tournament/${MISSING_UUID}`);

  for (const path of [
    ...validShapes.map((value) => `${value}/extra`),
    `/this-or-that/worldcup/${MISSING_UUID}/extra`,
  ]) {
    const response = await request.get(absolute(path), { headers: { Accept: "text/html" } });
    expect(response.status(), path).toBe(404);
  }
});

test("static fallback keeps the former Next responses", async ({ request }) => {
  for (const [path, owner] of [
    ["/decisions-decisions", "service"],
    ["/en/decisions-decisions", "service"],
    ["/this-or-that/tournament", "service"],
    ["/zh/this-or-that/tournament", "service"],
  ]) {
    for (const rsc of [false, true]) {
      const response = await request.get(absolute(rsc ? `${path}?_rsc=testbed` : path), {
        headers: rsc ? { RSC: "1" } : { Accept: "text/html" },
        maxRedirects: 0,
      });
      expect(response.status(), path).toBe(200);
      expect(response.headers()["x-cf-static-page"], path).toBe(owner);
      expect(response.headers()["content-type"], path).toContain(rsc ? "text/x-component" : "text/html");
      expect(response.headers()["vary"], path).toContain("rsc");
    }
  }

  // An RSC redirect keeps `_rsc`, so the browser never caches the RSC target
  // under the document URL.
  const worldcupRsc = await request.get(absolute("/en/this-or-that/worldcup?_rsc=testbed"), {
    headers: { RSC: "1" },
    maxRedirects: 0,
  });
  expect(worldcupRsc.status()).toBe(308);
  const worldcupRscLocation = new URL(worldcupRsc.headers().location, "http://smoke.local");
  expect(worldcupRscLocation.pathname).toBe("/en/this-or-that/tournament");
  expect(worldcupRscLocation.search).toBe("?_rsc=testbed");

  for (const [path, location] of [
    ["/ko", "/"],
    ["/kor/compendium/cards", "/compendium/cards"],
    ["/this-or-that/worldcup", "/this-or-that/tournament"],
    ["/en/this-or-that/worldcup", "/en/this-or-that/tournament"],
    ["/does-not-exist/", "/does-not-exist"],
    ["/EN/this-or-that/tournament", "/en/this-or-that/tournament"],
  ]) {
    const response = await request.get(absolute(path), {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    });
    expect(response.status(), path).toBe(308);
    expect(new URL(response.headers().location, "http://smoke.local").pathname, path).toBe(location);
  }

  for (const [path, lang] of [
    ["/does-not-exist", "ko"],
    ["/en/does-not-exist", "en"],
  ]) {
    const response = await request.get(absolute(path), { headers: { Accept: "text/html" } });
    expect(response.status(), path).toBe(404);
    expect(response.headers()["x-cf-static-page"], path).toBe("not-found");
    expect(response.headers()["content-type"], path).toContain("text/html");
    expect(await response.text(), path).toMatch(new RegExp(`<html[^>]* lang="${lang}"`));
  }

  const notFoundRsc = await request.get(absolute("/does-not-exist?_rsc=testbed"), {
    headers: { RSC: "1" },
  });
  expect(notFoundRsc.status()).toBe(404);
  expect(notFoundRsc.headers()["x-cf-static-page"]).toBe("not-found");
  expect(notFoundRsc.headers()["content-type"]).toContain("text/x-component");

  const privatePreview = await request.get(
    absolute(`/api/link-preview?url=${encodeURIComponent("http://127.0.0.1/")}`),
  );
  expect(privatePreview.status()).toBe(400);
  expect(await privatePreview.json()).toEqual({ message: "unsupported url" });

  const post = await request.post(absolute("/compendium/cards"), { maxRedirects: 0 });
  expect(post.status()).toBe(405);
  expect(post.headers().allow).toBe("GET, HEAD");

  // A detail path with no page is a 404 for every method, as for GET.
  const missingPost = await request.post(absolute("/compendium/cards/does-not-exist"), {
    maxRedirects: 0,
  });
  expect(missingPost.status()).toBe(404);
});

test("record shells keep exactly one policy canonical set after hydration", async ({ page }) => {
  await blockSupabase(page);
  // A missing record also covers the worker's failed-lookup path: the search
  // tags come from the request path alone. The worker uses the request origin.
  for (const [path, canonicalPath] of [
    [`/this-or-that/${MISSING_UUID}`, `/this-or-that/${MISSING_UUID}`],
    [`/ja/this-or-that/${MISSING_UUID}`, `/en/this-or-that/${MISSING_UUID}`],
  ]) {
    const response = await page.goto(absolute(path), { waitUntil: "networkidle" });
    expect(response?.status(), path).toBe(200);
    expect(response?.headers()["x-cf-static-page"], path).toBe("shell");
    await expect(page.locator('[data-static-detail-shell="pending"]')).toHaveCount(0);
    await page.waitForTimeout(1_000);

    const head = await page.evaluate(() => {
      const pathOf = (value: string | null) => new URL(value ?? "", location.href).pathname;
      return {
        canonicals: [...document.querySelectorAll('link[rel="canonical"]')]
          .map((link) => pathOf(link.getAttribute("href"))),
        hrefLangs: [...document.querySelectorAll('link[rel="alternate"][hreflang]')]
          .map((link) => `${link.getAttribute("hreflang")} ${pathOf(link.getAttribute("href"))}`)
          .sort(),
        ogUrls: [...document.querySelectorAll('meta[property="og:url"]')]
          .map((meta) => pathOf(meta.getAttribute("content"))),
      };
    });
    expect(head.canonicals, path).toEqual([canonicalPath]);
    expect(head.ogUrls, path).toEqual([canonicalPath]);
    expect(head.hrefLangs, path).toEqual([
      `en /en/this-or-that/${MISSING_UUID}`,
      `ko /this-or-that/${MISSING_UUID}`,
      `x-default /en/this-or-that/${MISSING_UUID}`,
    ]);
  }
});

test("History Course invalid detail returns to its index with client navigation", async ({ page }) => {
  const response = await page.goto(absolute("/history-course/not_valid"), {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/올바르지|invalid/i);

  await page.getByRole("link", { name: /역사 강의서 처음으로|Back to History Course/i }).click();
  await expect(page).toHaveURL(absolute("/history-course"));
  await expect(
    page.getByRole("heading", { level: 2, name: /도전 이력 다시 보기|View run history again/ }),
  ).toBeVisible();
});

test("Supabase failure uses the shared unavailable state", async ({ page }) => {
  await blockSupabase(page);
  // The browser has no Supabase path to fail; the Worker's 409 stands in for a data outage.
  await forceApiLegacyAnswer(page);
  await page.goto(absolute(`/c-c-c-combo/${MISSING_UUID}`), { waitUntil: "domcontentloaded" });

  await expect(
    page.locator('img[src*="battleworn_dummy_time_limit_power.webp"]'),
  ).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText(/데이터베이스가 응답하지 않습니다|No responses from database/)).toBeVisible();
});

/** Puts uploaded runs in this browser's IndexedDB before any page script runs. */
async function seedLocalRuns(page: Page, runIds: string[]) {
  await page.addInitScript(
    async ({ ids, raw }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("scare-the-spire", 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("runs")) {
            const store = database.createObjectStore("runs", { keyPath: "runId" });
            store.createIndex("savedAt", "savedAt");
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("runs", "readwrite");
          for (const runId of ids) {
            transaction.objectStore("runs").put({
              runId,
              raw,
              savedAt: Date.now(),
              origin: "upload",
              noteBlocks: null,
            });
          }
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    },
    { ids: runIds, raw: LOCAL_RUN_RAW },
  );
}

test("History Course loads an IndexedDB-only run while Supabase is unavailable", async ({ page }) => {
  await blockSupabase(page);
  await seedLocalRuns(page, [LOCAL_RUN_ID]);

  const response = await page.goto(absolute(`/history-course/${LOCAL_RUN_ID}`), {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("button", { name: /재생|일시정지|Play|Pause/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/런을 찾을 수|Run not found/i)).toHaveCount(0);
});


test("Combo mobile index keeps its primary interaction in the viewport", async ({ page }) => {
  await blockSupabase(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto(absolute("/c-c-c-combo"), { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.locator('[data-combo-page="index"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const search = page.locator('header button[aria-label*="검색"], header button[aria-label*="Search"]').first();
  const box = await search.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(36);
  await search.click();
  const searchInput = page.getByRole("textbox", { name: /통합 검색|Unified search/i });
  await expect(searchInput).toBeVisible();
  await expect(searchInput).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(searchInput).not.toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(searchInput).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(searchInput).toBeHidden();
});

test("beta art card filters stay pressable on the narrowest phone", async ({ page }) => {
  // 2026-11-04: the wrapped checkbox fell out of a fixed-height row and under the art.
  await blockSupabase(page);
  await page.setViewportSize({ width: 320, height: 568 });
  const response = await page.goto(absolute("/vexing-puzzlebox/beta-art"), { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  const row = page.locator("[data-beta-art-card-filters]");
  // Retry the type token until hydration has wired it up.
  await expect(async () => {
    await page.locator("[data-beta-art-filters] button:has(img)").first().click();
    await expect(row).toHaveAttribute("data-beta-art-card-filters", "", { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await expectNoHorizontalOverflow(page);
  const controls = row.locator(":scope > button, :scope > span button");
  expect(await controls.count()).toBeGreaterThan(1);
  for (const control of await controls.all()) {
    const covered = await control.evaluate((element) => {
      element.scrollIntoView({ block: "center" });
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit && !element.contains(hit) ? `${element.textContent?.trim() || element.getAttribute("aria-label")} under ${hit.tagName}` : null;
    });
    expect(covered).toBeNull();
  }
});

// --- Step 6 (docs/supabase-exit/STEP6_PLAN.md WP-Q): the browser's data goes to the same-origin
// /api only. These read real rows and one test writes (and deletes) a comment, so they need a stack
// whose /api answers: the testbed, or a local Worker on a D1 seeded by scripts/d1-local-seed.ts.

const UNAVAILABLE_TEXT = /데이터베이스가 응답하지 않습니다|No responses from database/;
const SUPABASE_URL = /^(?:https?|wss?):\/\/[^/]+\.supabase\.co(?:[:/?]|$)/;

type Traffic = {
  /** Any request or socket to a Supabase host (blocked at DNS, so it fails, but it is still made). */
  supabase: string[];
  /** Same-origin /api answers 409: the Worker's legacy answer, an outage for the step 6 browser. */
  legacy: string[];
  /** Same-origin /api requests that carried an Authorization header (identity is the cookie). */
  bearer: string[];
};

function withoutQuery(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

function watchTraffic(page: Page): Traffic {
  const traffic: Traffic = { supabase: [], legacy: [], bearer: [] };
  const apiPrefix = `${new URL(BASE_URL).origin}/api/`;
  page.on("request", (request) => {
    const url = request.url();
    if (SUPABASE_URL.test(url)) traffic.supabase.push(`${request.method()} ${withoutQuery(url)}`);
    if (url.startsWith(apiPrefix) && request.headers().authorization) {
      traffic.bearer.push(`${request.method()} ${withoutQuery(url)}`);
    }
  });
  page.on("websocket", (socket) => {
    if (SUPABASE_URL.test(socket.url())) traffic.supabase.push(`WS ${withoutQuery(socket.url())}`);
  });
  page.on("response", (response) => {
    if (response.url().startsWith(apiPrefix) && response.status() === 409) {
      traffic.legacy.push(`${response.request().method()} ${withoutQuery(response.url())}`);
    }
  });
  return traffic;
}

function latestPatchPath(): string {
  const patches = JSON.parse(readFileSync("data/sts2-patches.json", "utf8")) as { version: string; date: string }[];
  patches.sort((left, right) => right.date.localeCompare(left.date));
  return `/patches/${patches[0].version}`;
}

/** Opens `path` and lets its data reads settle, then checks it shows no "database is not answering". */
async function visitSettled(page: Page, path: string) {
  const response = await page.goto(absolute(path), { waitUntil: "load", timeout: 45_000 });
  expect(response?.status(), path).toBe(200);
  // Best effort: an embed may keep the network busy; the data reads finish well within this.
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1_500);
  await expect(page.getByText(UNAVAILABLE_TEXT).filter({ visible: true }), path).toHaveCount(0);
}

test.describe("step 6 browser data path", () => {
  test.skip(!STACK_HAS_DATA, "needs a stack whose /api answers (CF_TESTBED_DATA=0)");

  test("pages read the same-origin /api only and get no legacy answer", async ({ page }) => {
    test.setTimeout(180_000);
    await blockSupabase(page);
    const traffic = watchTraffic(page);

    for (const path of ["/", "/compendium/cards/abrasive", latestPatchPath(), "/c-c-c-combo"]) {
      await visitSettled(page, path);
    }
    // A post from the feed the page just showed; the missing-record shell when the feed is empty.
    const detail = await page.locator('a[href^="/c-c-c-combo/"]').evaluateAll((links) =>
      links
        .map((link) => link.getAttribute("href") ?? "")
        .find((href) => /^\/c-c-c-combo\/[0-9a-f-]{36}$/i.test(href)) ?? null,
    );
    await visitSettled(page, detail ?? `/c-c-c-combo/${MISSING_UUID}`);

    expect(traffic.supabase).toEqual([]);
    expect(traffic.legacy).toEqual([]);
    expect(traffic.bearer).toEqual([]);
  });

  test("a new browser claims once, keeps the Supabase session, and writes without a bearer token", async ({ page }) => {
    test.setTimeout(120_000);
    await blockSupabase(page);
    const traffic = watchTraffic(page);
    const claims: { status: number; body: Record<string, unknown> | null }[] = [];
    page.on("response", async (response) => {
      if (new URL(response.url()).pathname !== "/api/auth/claim") return;
      claims.push({ status: response.status(), body: await response.json().catch(() => null) });
    });

    await visitSettled(page, "/compendium/cards/abrasive");
    const editor = page.locator('[contenteditable="true"][aria-placeholder="댓글을 입력하세요"]').first();
    await expect(editor).toBeVisible({ timeout: 30_000 });
    const text = `cf testbed QA ${Date.now()}`;
    await editor.click();
    await page.keyboard.type(text);
    // The submit button of this editor's own composer (the nearest block holding both).
    const composer = editor.locator('xpath=ancestor::div[.//button[normalize-space(.)="작성"]][1]');
    await composer.getByRole("button", { name: "작성", exact: true }).click();

    const entry = page.locator("li[id^='history-comment-']").filter({ hasText: text });
    await expect(entry).toHaveCount(1, { timeout: 30_000 });

    // useAuth's ensureUser signed this browser up through the Worker and kept the session it got.
    expect(claims.map((claim) => claim.status), "one claim, then the cookie").toEqual([200]);
    const claimed = claims[0]?.body ?? null;
    expect(claimed).toMatchObject({ v: 1, created: true });
    const uid = String(claimed?.uid ?? "");
    expect(uid).toMatch(/^[0-9a-f-]{36}$/);
    const stored = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((name) => /^sb-[a-z0-9]+-auth-token$/.test(name)) ?? null;
      const session = key ? (JSON.parse(localStorage.getItem(key) ?? "null") as Record<string, unknown> | null) : null;
      const marker = JSON.parse(localStorage.getItem("slseoun-identity") ?? "null") as { uid?: unknown } | null;
      return {
        key,
        hasAccessToken: typeof session?.access_token === "string" && session.access_token.length > 0,
        hasRefreshToken: typeof session?.refresh_token === "string" && session.refresh_token.length > 0,
        userId: (session?.user as { id?: unknown } | undefined)?.id ?? null,
        markerUid: marker?.uid ?? null,
      };
    });
    expect(stored.key, "sb-<ref>-auth-token is stored").not.toBeNull();
    expect(stored).toMatchObject({ hasAccessToken: true, hasRefreshToken: true, userId: uid, markerUid: uid });

    await entry.getByRole("button", { name: "삭제" }).click();
    await expect(entry).toHaveCount(0, { timeout: 30_000 });

    expect(traffic.supabase).toEqual([]);
    expect(traffic.legacy).toEqual([]);
    expect(traffic.bearer).toEqual([]);
  });

  test("History Course counts every listed run past 100, 100 ids per request", async ({ page }) => {
    test.setTimeout(120_000);
    await blockSupabase(page);
    // The shared list stops at 100 (RECENT_DONATED_RUNS_LIMIT); uploads kept only in this browser
    // join it, so the index holds more than one request's worth of runs.
    const localIds = ["1testbedindexrun01", "1testbedindexrun02"];
    await seedLocalRuns(page, localIds);
    const origin = new URL(BASE_URL).origin;
    const listed = new Set<string>();
    const asked: string[][] = [];
    const failed: string[] = [];
    const comments = new Map<string, number>();
    page.on("response", async (response) => {
      const url = new URL(response.url());
      if (url.origin !== origin) return;
      if (url.pathname === "/api/read/history-runs" && url.searchParams.get("view") === "recent") {
        const body = (await response.json().catch(() => null)) as { rows?: { id?: unknown }[] } | null;
        for (const row of body?.rows ?? []) if (typeof row.id === "string") listed.add(row.id);
        return;
      }
      if (url.pathname !== "/api/read/history-runs/engagement") return;
      asked.push((url.searchParams.get("ids") ?? "").split(",").filter(Boolean));
      const body = (await response.json().catch(() => null)) as { v?: unknown; comments?: Record<string, number> } | null;
      if (!response.ok() || body?.v !== 1 || !body.comments) {
        failed.push(`${response.status()} ${url.pathname}`);
        return;
      }
      for (const [runId, count] of Object.entries(body.comments)) comments.set(runId, count);
    });

    const response = await page.goto(absolute("/history-course"), { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    const expected = () => [...new Set([...listed, ...localIds])].filter(isRunId);
    const missing = () => {
      const seen = new Set(asked.flat());
      return expected().filter((runId) => !seen.has(runId));
    };
    await expect.poll(() => listed.size, { timeout: 45_000 }).toBeGreaterThan(0);
    await expect.poll(missing, { timeout: 45_000 }).toEqual([]);

    expect(expected().length, "the index holds more runs than one request takes").toBeGreaterThan(HISTORY_RUN_ENGAGEMENT_IDS);
    for (const ids of asked) {
      expect(ids.length).toBeLessThanOrEqual(HISTORY_RUN_ENGAGEMENT_IDS);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(failed).toEqual([]);

    // Every card shows its run's count from the merged answers, past the 100th run too.
    await page.waitForLoadState("networkidle");
    const labels = await page.locator('a[href*="/history-course/"][aria-label]').evaluateAll((links) =>
      links.map((link) => ({ href: link.getAttribute("href") ?? "", label: link.getAttribute("aria-label") ?? "" })),
    );
    const labelOf = (runId: string) => labels.find((link) => link.href.includes(`/history-course/${encodeURIComponent(runId)}#`))?.label;
    for (const runId of expected()) {
      const count = comments.get(runId) ?? 0;
      expect(labelOf(runId), runId).toBe(count > 0 ? `${count}개의 댓글` : "첫 댓글 쓰기");
    }
  });
});
