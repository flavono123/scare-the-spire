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

test("slot machine — next item visible at pose +1", async ({ page }) => {
  // Defect M598 seed: Neow grants 3 random cards + 1 relic = 4 stack
  // items (a real STS Neow option, not export pollution), perfect for
  // verifying the slot machine preroll.
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/M598491DD0`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  await page.locator('[data-testid="node-stack-item"]').first().waitFor({
    state: "attached",
    timeout: 8000,
  });
  // Pause so the per-item phase clock keeps the current item at "hold"
  // instead of racing through it (the rAF ticker would otherwise flip
  // currentIndex before we screenshot).
  await page.keyboard.press("Space").catch(() => {});
  await page.waitForTimeout(120);
  await waitForPhase(page, "hold");
  await page.waitForTimeout(120);
  await page.screenshot({
    path: path.join(OUT_DIR, "11-slot-multi-hold.png"),
    fullPage: false,
  });
  const cropRect = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="node-stack-item"][data-pose="0"]');
    const r = el?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
  });
  if (cropRect) {
    await page.screenshot({
      path: path.join(OUT_DIR, "11b-slot-multi-crop.png"),
      clip: {
        x: Math.max(0, cropRect.x - 80),
        y: Math.max(0, cropRect.y - 80),
        width: 540,
        height: 280,
      },
    });
  }

  // Verify pose=1 (next-up) element is rendered visible — this was the
  // queued-phase visibility bug fix.
  const poseOne = page.locator('[data-testid="node-stack-item"][data-pose="1"]').first();
  await expect(poseOne).toBeVisible({ timeout: 1500 });
  const poseOneOpacity = await poseOne.evaluate(
    (el) => parseFloat(window.getComputedStyle(el).opacity || "0"),
  );
  expect(poseOneOpacity).toBeGreaterThan(0.2);
});

test("Neow strips starter pollution to ≤1 card + ≤1 relic", async ({ page }) => {
  // APDC export dump bleeds class starters into Neow's cards_gained /
  // relic_choices. The shell sanitizes the entry before feeding both the
  // stack and the timeline so the user sees a sensible Neow node.
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/APDCAB0SMN`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  await page
    .locator('[data-testid="node-stack-item"]')
    .first()
    .waitFor({ state: "attached", timeout: 8000 });
  await page.keyboard.press("Space").catch(() => {});
  await page.waitForTimeout(120);

  const count = await page.locator('[data-testid="node-stack-item"]').count();
  // After sanitization: 0 cards (pollution detected) + 1 relic = 1 item.
  // Allow up to 2 in case the heuristic ever loosens for valid Neow gains.
  expect(count).toBeLessThanOrEqual(2);
  expect(count).toBeGreaterThanOrEqual(1);
});

test("pause freezes the stack mid-phase", async ({ page }) => {
  // With the new elapsedMs-derived stack, pausing the playback ticker
  // should also freeze every stack visual. Check that the active item's
  // transform/phase doesn't drift while paused.
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/APDCAB0SMN`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  await page
    .locator('[data-testid="node-stack-item"]')
    .first()
    .waitFor({ state: "attached", timeout: 8000 });
  await waitForPhase(page, "hold");
  await page.waitForTimeout(120);

  // Pause
  await page.keyboard.press("Space").catch(() => {});
  await page.waitForTimeout(80);

  const before = await page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="node-stack-item"][data-pose="0"]',
    );
    return el
      ? {
          phase: el.getAttribute("data-phase"),
          transform: (el as HTMLElement).style.transform,
        }
      : null;
  });

  // Wait — while paused, the stack should NOT advance.
  await page.waitForTimeout(800);

  const after = await page.evaluate(() => {
    const el = document.querySelector(
      '[data-testid="node-stack-item"][data-pose="0"]',
    );
    return el
      ? {
          phase: el.getAttribute("data-phase"),
          transform: (el as HTMLElement).style.transform,
        }
      : null;
  });

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(after!.phase).toBe(before!.phase);
  expect(after!.transform).toBe(before!.transform);
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
