import { expect, test, type Page } from "@playwright/test";
import { getSiteOrigin } from "../src/lib/site-origin";

const BASE_URL = (process.env.CF_PHASE4_ORIGIN ?? process.env.BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const CANONICAL_ORIGIN = (process.env.CF_PHASE4_CANONICAL_ORIGIN ?? getSiteOrigin()).replace(/\/$/, "");
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const LOCAL_RUN_ID = "1phase4localrun";
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

function absolute(path: string) {
  return `${BASE_URL}${path}`;
}

function canonical(path: string) {
  return `${CANONICAL_ORIGIN}${path}`;
}

async function blockSupabase(page: Page) {
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, (route) => route.abort("connectionfailed"));
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

test("redirect and canonical metadata match the public locale URL", async ({ request, page }) => {
  const redirect = await request.get(absolute("/"), {
    headers: { Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(302);
  expect(new URL(redirect.headers().location).pathname).toBe("/en");

  for (const path of [
    "/compendium/powers/painful_stabs",
    "/en/compendium/powers/painful_stabs",
  ]) {
    const response = await page.goto(absolute(path), { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical(path));
  }
});

test("dynamic service routes refresh directly and invalid nesting fails closed", async ({ request }) => {
  const validShapes = [
    `/chemical-x/${MISSING_UUID}`,
    `/c-c-c-combo/${MISSING_UUID}`,
    `/this-or-that/${MISSING_UUID}`,
    "/history-course/1phase4missingrun",
  ];
  for (const path of validShapes) {
    const response = await request.get(absolute(path), { headers: { Accept: "text/html" } });
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain("text/html");
  }

  for (const path of validShapes.map((value) => `${value}/extra`)) {
    const response = await request.get(absolute(path), { headers: { Accept: "text/html" } });
    expect(response.status(), path).toBe(404);
  }
});

test("History Course invalid detail returns to its index with client navigation", async ({ page }) => {
  const response = await page.goto(absolute("/history-course/not_valid"), {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/올바르지|invalid/i);

  await page.locator('a[href="/history-course"]').click();
  await expect(page).toHaveURL(absolute("/history-course"));
  await expect(page.locator("#history-course-run-search")).toBeVisible();
});

test("Supabase failure uses the shared unavailable state", async ({ page }) => {
  await blockSupabase(page);
  await page.goto(absolute(`/c-c-c-combo/${MISSING_UUID}`), { waitUntil: "domcontentloaded" });

  await expect(
    page.locator('img[src*="battleworn_dummy_time_limit_power.webp"]'),
  ).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText(/데이터베이스가 응답하지 않습니다|No responses from database/)).toBeVisible();
});

test("History Course loads an IndexedDB-only run while Supabase is unavailable", async ({ page }) => {
  await blockSupabase(page);
  await page.addInitScript(
    async ({ runId, raw }) => {
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
          transaction.objectStore("runs").put({
            runId,
            raw,
            savedAt: Date.now(),
            origin: "upload",
            noteBlocks: null,
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    },
    { runId: LOCAL_RUN_ID, raw: LOCAL_RUN_RAW },
  );

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
