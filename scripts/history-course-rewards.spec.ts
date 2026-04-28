/**
 * Capture frames around the node action stack — the unified slot-machine
 * sequencer that replaced the dual relic-fly + card-action overlays.
 *
 *   pnpm exec playwright test scripts/history-course-rewards.spec.ts \
 *     --reporter=list
 */

import { test, expect } from "@playwright/test";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join("/tmp", "history-course-shots");
const BOOTS_SEED = "EQNAH97QTR"; // winged-boots-eqnah-a10 — relic at step 1

async function waitForPhase(page: any, phase: string, timeout = 4000) {
  await page.waitForFunction(
    (p: string) =>
      Array.from(document.querySelectorAll('[data-testid="node-stack-item"]'))
        .some((el) => el.getAttribute("data-phase") === p),
    phase,
    { timeout },
  );
}

test("node action stack — boots run", async ({ page }) => {
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

  // Step 1 (Neow) grants winged_boots; stack mounts once intro fades.
  const stackItem = page.locator('[data-testid="node-stack-item"]');
  await stackItem.first().waitFor({ state: "attached", timeout: 8000 });
  await waitForPhase(page, "hold");
  await page.waitForTimeout(280);
  await page.screenshot({
    path: path.join(OUT_DIR, "08-stack-hold.png"),
    fullPage: false,
  });

  // text fade — label opacity drops while icon stays
  await waitForPhase(page, "textFade");
  await page.waitForTimeout(160);
  await page.screenshot({
    path: path.join(OUT_DIR, "09-stack-text-fade.png"),
    fullPage: false,
  });

  // post — icon flies (relic) or fades (cards)
  await waitForPhase(page, "post");
  await page.waitForTimeout(220);
  await page.screenshot({
    path: path.join(OUT_DIR, "10-stack-post.png"),
    fullPage: false,
  });

  expect(errors, errors.join("\n")).toEqual([]);
});

test("deck modal — sticky backdrop + 획득순", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });

  const res = await page.goto(`${BASE}/history-course/${BOOTS_SEED}`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  // Pause to keep things stable while we open the deck.
  await page.keyboard.press("Space").catch(() => {});
  await page.waitForTimeout(200);

  // Scrub a few steps in to grow the deck a bit so the modal scrolls.
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(300);

  // Open deck modal — click the deck chip (data-deck-target)
  await page.locator("[data-deck-target]").first().click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT_DIR, "20-deck-modal-top.png"),
    fullPage: false,
  });

  // Scroll modal content + verify backdrop still covers viewport.
  const scrollContainer = page.locator(".pointer-events-none.fixed.inset-0.z-50");
  await scrollContainer.evaluate((el) => el.scrollBy(0, 600));
  await page.waitForTimeout(220);
  await page.screenshot({
    path: path.join(OUT_DIR, "21-deck-modal-scrolled.png"),
    fullPage: false,
  });

  // Backdrop should still report a fixed full-viewport size.
  const backdropBox = await page
    .locator(".fixed.inset-0.z-40.bg-black\\/70")
    .first()
    .boundingBox();
  expect(backdropBox?.height).toBeGreaterThanOrEqual(880);
});
