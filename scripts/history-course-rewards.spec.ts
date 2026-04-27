/**
 * Capture frames around reward overlays for the new node-side + fly-out
 * animations. Replaces the visual coverage of the old centered modal.
 *
 *   pnpm exec playwright test scripts/history-course-rewards.spec.ts \
 *     --reporter=list
 */

import { test, expect } from "@playwright/test";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join("/tmp", "history-course-shots");
const BOOTS_SEED = "EQNAH97QTR"; // winged-boots-eqnah-a10 — relic at step 1

test("relic fly-out + card action overlay (boots run)", async ({ page }) => {
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

  // Step 1 is the Neow ancient room which grants winged_boots — the relic
  // overlay should mount once intro fades. Wait for the hold phase so the
  // appear→hold opacity fade has completed.
  const relicOverlay = page.locator('[data-testid="relic-fly"]');
  await relicOverlay.waitFor({ state: "attached", timeout: 8000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="relic-fly"]')
        ?.getAttribute("data-phase") === "hold",
    null,
    { timeout: 4000 },
  );
  // Give the opacity transition (~220ms) time to finish.
  await page.waitForTimeout(260);
  await page.screenshot({
    path: path.join(OUT_DIR, "08-relic-appear.png"),
    fullPage: false,
  });

  // Wait until it transitions to fly, then capture mid-flight.
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="relic-fly"]')
        ?.getAttribute("data-phase") === "fly",
    null,
    { timeout: 4000 },
  );
  await page.waitForTimeout(280);
  await page.screenshot({
    path: path.join(OUT_DIR, "09-relic-flying.png"),
    fullPage: false,
  });

  // Once the relic finishes, advance forward to find a card-gain step.
  await relicOverlay.first().waitFor({ state: "detached", timeout: 4000 });
  // Pause and scrub forward.
  await page.keyboard.press("Space").catch(() => {});
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(120);
  }
  // Some monster steps gain a card; wait briefly for one to appear.
  const cardOverlay = page.locator('[data-testid="card-action"]');
  await cardOverlay.first().waitFor({ state: "attached", timeout: 8000 });
  await page.screenshot({
    path: path.join(OUT_DIR, "10-card-gained.png"),
    fullPage: false,
  });

  // The legacy full-screen modal had a black/55 backdrop covering the stage
  // — confirm nothing of that shape is rendering now.
  const overlay = await page
    .locator('div.bg-black\\/55')
    .filter({ hasText: /유물 획득|카드 획득/ })
    .count();
  expect(overlay).toBe(0);

  expect(errors, errors.join("\n")).toEqual([]);
});
