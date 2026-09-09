/**
 * History Course playback must keep advancing after intro, and Play must
 * resume even after a floor jump. Covers the 검슝 쳐내기-class regression
 * where last-scene overlays / intro gating froze the ticker.
 *
 *   BASE_URL=http://localhost:3000 pnpm exec playwright test \
 *     scripts/history-course-playback.spec.ts --reporter=list
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SEED = "EQNAH97QTR";
const DONATED_RUN = "174nxe7x9zfpgm1t";

async function stageMs(page: Page) {
  return page.locator("[data-history-course-stage]").getAttribute("data-history-global-ms");
}

async function openPlayableRun(page: Page): Promise<string> {
  for (const runId of [DONATED_RUN, SEED]) {
    const res = await page.goto(`${BASE}/history-course/${runId}`);
    if (!res || res.status() >= 400) continue;
    await page.waitForLoadState("domcontentloaded");
    const stage = page.locator("[data-history-course-stage]");
    try {
      await stage.waitFor({ state: "visible", timeout: 8000 });
      return runId;
    } catch {
      // Missing local seed or donated run — try the next fixture.
    }
  }
  test.skip(true, "no playable History Course fixture is available");
  return "";
}

async function waitUntilPlaying(page: Page) {
  const stage = page.locator("[data-history-course-stage]");
  await expect(stage).toHaveAttribute("data-history-replay-ready", "true", {
    timeout: 15000,
  });
  if ((await stage.getAttribute("data-history-playing")) !== "true") {
    await page.locator("[data-history-play-toggle]").click();
  }
  await expect(stage).toHaveAttribute("data-history-playing", "true");
}

test("history-course playback advances and resumes after pause", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPlayableRun(page);

  const stage = page.locator("[data-history-course-stage]");
  await waitUntilPlaying(page);

  const play = page.locator("[data-history-play-toggle]");
  const box = await play.boundingBox();
  expect(box).toBeTruthy();
  const top = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el?.closest("button")?.getAttribute("aria-label") ?? el?.tagName ?? null;
  }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 });
  expect(top).toMatch(/일시정지|재생|Pause|Play/i);

  const before = Number(await stageMs(page));
  await page.waitForTimeout(900);
  const mid = Number(await stageMs(page));
  expect(mid).toBeGreaterThan(before);

  await play.click();
  await expect(stage).toHaveAttribute("data-history-playing", "false");
  const pausedAt = Number(await stageMs(page));
  await page.waitForTimeout(500);
  expect(Number(await stageMs(page))).toBe(pausedAt);

  await play.click();
  await expect(stage).toHaveAttribute("data-history-playing", "true");
  await expect(stage).toHaveAttribute("data-history-replay-ready", "true");
  await page.waitForTimeout(700);
  expect(Number(await stageMs(page))).toBeGreaterThan(pausedAt);
});

test("play resumes after a floor jump", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPlayableRun(page);

  const stage = page.locator("[data-history-course-stage]");
  await waitUntilPlaying(page);

  const marker = page.locator('[data-history-floor-marker="0:2"]');
  if (await marker.count()) {
    await marker.click({ force: true });
  } else {
    await page.locator("[data-history-floor-marker]").nth(1).click({ force: true });
  }
  await expect(stage).toHaveAttribute("data-history-playing", "false");

  await page.locator("[data-history-play-toggle]").click();
  await expect(stage).toHaveAttribute("data-history-playing", "true");
  await expect(stage).toHaveAttribute("data-history-replay-ready", "true");
  const afterJump = Number(await stageMs(page));
  await page.waitForTimeout(700);
  expect(Number(await stageMs(page))).toBeGreaterThan(afterJump);
});

test("donated 검슝 쳐내기 run plays when available", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/history-course/${DONATED_RUN}`);
  await page.waitForLoadState("networkidle");

  const missing = page.getByText(/찾을 수 없|missing|없어/i);
  if (await missing.count()) {
    test.skip(true, "donated 검슝 쳐내기 run is not available in this environment");
  }

  const stage = page.locator("[data-history-course-stage]");
  await stage.waitFor({ state: "visible", timeout: 20000 });
  await waitUntilPlaying(page);
  const before = Number(await stageMs(page));
  await page.waitForTimeout(900);
  expect(Number(await stageMs(page))).toBeGreaterThan(before);
});

test("treasure room spine loads from game chest actor", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/history-course/${DONATED_RUN}`);
  const missing = page.getByText(/찾을 수 없|missing|없어/i);
  if (await missing.count()) {
    test.skip(true, "donated 검슝 쳐내기 run is not available in this environment");
  }

  const stage = page.locator("[data-history-course-stage]");
  await stage.waitFor({ state: "visible", timeout: 20000 });
  await expect(stage).toHaveAttribute("data-history-replay-ready", "true", {
    timeout: 15000,
  });

  await page.locator('[data-history-floor-marker="0:10"]').click({ force: true });
  const scene = page.locator("[data-history-last-scene]");
  await expect(scene).toHaveAttribute("data-history-last-scene", "treasure", {
    timeout: 8000,
  });
  const probe = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 32;
    document.body.appendChild(c);
    const gl = c.getContext("webgl") ?? c.getContext("webgl2");
    c.remove();
    const treasureCanvas = document.querySelector("[data-history-treasure-room] canvas");
    return {
      dummyGl: Boolean(gl),
      treasureCanvas: Boolean(treasureCanvas),
      load: document.querySelector("[data-history-treasure-room]")?.getAttribute("data-history-treasure-load"),
    };
  });
  const treasure = page.locator("[data-history-treasure-room]");
  await expect(treasure).toBeVisible();
  if (!probe.dummyGl) return;
  await expect(treasure).toHaveAttribute("data-history-treasure-load", "ready", {
    timeout: 15000,
  });
  const canvas = treasure.locator("canvas");
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThan(400);
  expect(box!.height).toBeGreaterThan(200);
});

test("shop and card-reward tiles stay within the game scale", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/history-course/${DONATED_RUN}`);
  const missing = page.getByText(/찾을 수 없|missing|없어/i);
  if (await missing.count()) {
    test.skip(true, "donated 검슝 쳐내기 run is not available in this environment");
  }

  const stage = page.locator("[data-history-course-stage]");
  await stage.waitFor({ state: "visible", timeout: 20000 });
  await expect(stage).toHaveAttribute("data-history-replay-ready", "true", {
    timeout: 15000,
  });

  await page.locator('[data-history-floor-marker="1:3"]').click({ force: true });
  const shop = page.locator("[data-history-merchant-shop]");
  await expect(shop).toBeVisible({ timeout: 8000 });
  const shopRatio = await page.evaluate(() => {
    const stageEl = document.querySelector("[data-history-course-stage]");
    const card = document.querySelector("[data-history-merchant-shop] [data-history-last-scene-pick]");
    if (!stageEl || !card) return 0;
    return card.getBoundingClientRect().width / stageEl.getBoundingClientRect().width;
  });
  expect(shopRatio).toBeGreaterThan(0.06);
  expect(shopRatio).toBeLessThan(0.16);
});
