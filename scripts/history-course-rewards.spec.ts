/**
 * History Course last-scene loop — map transit, then that node's result
 * overlay. The slot-machine stack stays hidden while a dedicated scene is up.
 *
 *   pnpm exec playwright test scripts/history-course-rewards.spec.ts \
 *     --reporter=list
 */

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join("/tmp", "history-course-shots");
const BOOTS_SEED = "EQNAH97QTR"; // winged-boots-eqnah-a10 — relic at step 1
const TRANSIT_MS = 2500;
const LAST_SCENE_STEP_MS = 500;
const PICK_REVEAL_MS = TRANSIT_MS + 2 * LAST_SCENE_STEP_MS;

async function scrubTo(page: Page, value: number) {
  await page.evaluate((ms: number) => {
    const input = document.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement | null;
    if (!input) throw new Error("range input not found");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, String(ms));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test("last scene after transit — boots run", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  const res = await page.goto(`${BASE}/history-course/${BOOTS_SEED}`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  const lastScene = page.locator("[data-history-last-scene]");
  await lastScene.first().waitFor({ state: "attached", timeout: 12000 });
  await page.waitForTimeout(280);
  await page.screenshot({
    path: path.join(OUT_DIR, "08-last-scene.png"),
    fullPage: false,
  });

  await expect(page.locator('[data-testid="node-stack-item"]')).toHaveCount(0);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("last scene picks reveal after transit", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/M598491DD0`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  await page.locator("[data-history-last-scene]").first().waitFor({
    state: "attached",
    timeout: 12000,
  });
  await page.keyboard.press("Space").catch(() => {});
  await page.waitForTimeout(120);
  await scrubTo(page, PICK_REVEAL_MS + 200);
  await page.waitForTimeout(120);
  await page.screenshot({
    path: path.join(OUT_DIR, "11-last-scene-picks.png"),
    fullPage: false,
  });
  await expect(
    page.locator("[data-history-last-scene-pick]").first(),
  ).toBeVisible({ timeout: 1500 });
});

test("Neow last scene keeps non-starter picks", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/APDCAB0SMN`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  await page.locator("[data-history-last-scene]").first().waitFor({
    state: "attached",
    timeout: 12000,
  });
  await page.keyboard.press("Space").catch(() => {});
  await page.waitForTimeout(120);
  await scrubTo(page, PICK_REVEAL_MS + 400);
  await page.waitForTimeout(80);

  const pickIds = await page
    .locator("[data-history-last-scene-pick]")
    .evaluateAll((els) =>
      els
        .map((el) => el.getAttribute("data-history-last-scene-pick") ?? "")
        .filter(Boolean),
    );
  await page.screenshot({
    path: path.join(OUT_DIR, "12-apdc-neow-last-scene.png"),
    fullPage: false,
  });
  expect(pickIds.length).toBeGreaterThanOrEqual(4);
  expect(pickIds.join(" ")).not.toMatch(/STRIKE_NECRO|DEFEND_NECRO|BOUND_PHYLACTERY/i);
});

test("topbar relic row hidden until last scene reveals picks", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/APDCAB0SMN`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  await page.locator("[data-history-last-scene]").first().waitFor({
    state: "attached",
    timeout: 12000,
  });
  await page.keyboard.press("Space").catch(() => {});
  await page.waitForTimeout(100);

  await scrubTo(page, TRANSIT_MS + 200);
  await page.waitForTimeout(80);
  const hiddenBefore = await page
    .locator("[data-relic-target]")
    .evaluateAll((els) =>
      els.map((el) => Number((el as HTMLElement).style.opacity || "1")),
    )
    .then((opacities) => opacities.filter((o) => o < 0.5).length);
  expect(hiddenBefore).toBeGreaterThanOrEqual(4);

  await scrubTo(page, PICK_REVEAL_MS + 200);
  await page.waitForTimeout(80);
  const hiddenAfter = await page
    .locator("[data-relic-target]")
    .evaluateAll((els) =>
      els.map((el) => Number((el as HTMLElement).style.opacity || "1")),
    )
    .then((opacities) => opacities.filter((o) => o < 0.5).length);
  expect(hiddenAfter).toBeLessThan(hiddenBefore);
});

test("pause freezes the last scene mid-progress", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/APDCAB0SMN`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  const scene = page.locator("[data-history-last-scene]").first();
  await scene.waitFor({ state: "attached", timeout: 12000 });
  await page.waitForTimeout(120);

  await page.keyboard.press("Space").catch(() => {});
  await page.waitForTimeout(80);

  const before = await scene.getAttribute("data-progress");
  await page.waitForTimeout(800);
  const after = await scene.getAttribute("data-progress");
  expect(before).not.toBeNull();
  expect(after).toBe(before);
});

test("deck modal — sticky backdrop + 획득순", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });

  const res = await page.goto(`${BASE}/history-course/${BOOTS_SEED}`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  await page.keyboard.press("Space").catch(() => {});
  await page.waitForTimeout(200);

  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(300);

  await page.locator("[data-deck-target]").first().click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT_DIR, "20-deck-modal-top.png"),
    fullPage: false,
  });

  const scrollContainer = page.locator(".pointer-events-none.fixed.inset-0.z-50");
  await scrollContainer.evaluate((el) => el.scrollBy(0, 600));
  await page.waitForTimeout(220);
  await page.screenshot({
    path: path.join(OUT_DIR, "21-deck-modal-scrolled.png"),
    fullPage: false,
  });

  const backdropBox = await page
    .locator(".fixed.inset-0.z-40.bg-black\\/70")
    .first()
    .boundingBox();
  expect(backdropBox?.height).toBeGreaterThanOrEqual(880);
});
