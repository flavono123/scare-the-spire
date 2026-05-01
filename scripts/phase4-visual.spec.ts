/**
 * Phase 4 visual smoke — captures the path-trail painting, the clockwise
 * ring sweep on the destination node, the character "pop" landing, and
 * the NCardFlyVfx-mirror card-fly arc on the boots fixture.
 *
 *   pnpm exec playwright test scripts/phase4-visual.spec.ts \
 *     --reporter=list
 */

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join("/tmp", "history-course-shots", "phase4");
const SEED = "EQNAH97QTR"; // winged-boots run

const FLY_SELECTOR_CARD =
  '[data-testid="node-stack-item"][data-phase="post"][data-kind="card-gained"], ' +
  '[data-testid="node-stack-item"][data-phase="post"][data-kind="card-bought"]';

const NODE_BASE_MS = 2500;
const TRAIL_END_MS = NODE_BASE_MS * 0.7;
const RING_END_MS = NODE_BASE_MS * 0.92;

async function scrubGlobal(page: Page, ms: number) {
  await page.evaluate((value: number) => {
    const input = document.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement | null;
    if (!input) throw new Error("range input not found");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, ms);
  await page.waitForTimeout(180);
}

test("act intro — game-style band + cyan tag + gold title", async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`${BASE}/history-course/${SEED}`);

  // Wait until ActIntro mounts (fade-in 600ms + hold 1500ms ≈ 2.0s window).
  await page.waitForSelector('[data-testid="act-intro"]', { timeout: 8_000 });
  // Mid-hold of the intro — band fully opaque, map should still show
  // through above and below the band.
  await page.waitForTimeout(1_300);
  await page.screenshot({
    path: path.join(OUT_DIR, "00-act-intro-hold.png"),
  });
});

test("phase 4 — trail / sweep / pop / card-fly mirror", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1600, height: 900 });

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const res = await page.goto(`${BASE}/history-course/${SEED}`);
  expect(res?.status()).toBe(200);

  await page.waitForSelector(
    '[data-testid="node-stack-item"], .ring-1',
    { timeout: 8_000 },
  );
  await page.waitForTimeout(3_500);
  await page.keyboard.press("Space");

  // Step 2 starts after Neow's stack: 1 relic + 1 card on this fixture
  // = 2500 transit + 2 × 2500 stack = 7500ms.
  const step2StartMs = 7500;

  await scrubGlobal(page, step2StartMs + Math.round(TRAIL_END_MS / 2));
  await page.screenshot({ path: path.join(OUT_DIR, "01-trail-mid.png") });

  await scrubGlobal(
    page,
    step2StartMs + Math.round((TRAIL_END_MS + RING_END_MS) / 2),
  );
  await page.screenshot({ path: path.join(OUT_DIR, "02-ring-sweep.png") });

  await scrubGlobal(page, step2StartMs + Math.round(RING_END_MS) - 30);
  await page.screenshot({ path: path.join(OUT_DIR, "03-pre-pop.png") });

  await scrubGlobal(page, step2StartMs + NODE_BASE_MS - 30);
  await page.screenshot({ path: path.join(OUT_DIR, "04-pop.png") });

  // ---- Card fly mirror — capture three points in the post (Bezier) phase ----
  // Resume to land on a card item's post phase, then pause and step
  // small windows. Card-fly post phase is 700ms total now (Phase 1 ~545ms
  // accelerating Bezier + Phase 2 ~155ms collapse).
  await page.keyboard.press("Space");
  await page.waitForSelector(FLY_SELECTOR_CARD, { timeout: 25_000 });
  await page.keyboard.press("Space");
  await page.screenshot({ path: path.join(OUT_DIR, "05-card-fly-1.png") });

  await page.keyboard.press("Space");
  await page.waitForTimeout(140);
  await page.keyboard.press("Space");
  await page.screenshot({ path: path.join(OUT_DIR, "06-card-fly-2.png") });

  await page.keyboard.press("Space");
  await page.waitForTimeout(140);
  await page.keyboard.press("Space");
  await page.screenshot({ path: path.join(OUT_DIR, "07-card-fly-3.png") });

  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("run summary — partial mid-run + auto-open at end + back button", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/${SEED}`);
  expect(res?.status()).toBe(200);
  await page.waitForSelector('[data-testid="node-stack-item"], .ring-1', {
    timeout: 8_000,
  });
  await page.waitForTimeout(3_500);
  await page.keyboard.press("Space"); // pause

  // ---- mid-run partial panel via topbar cog ----
  // Scrub a few step's worth into the run, then click the cog. Panel
  // should open with only act 1's traversed nodes — no future acts.
  await scrubGlobal(page, 8_000);
  // Cog button — has title "런 정보" and the settings png alt.
  await page.locator('button[title="런 정보"]').click();
  await page.waitForSelector('[data-testid="summary-panel"]', {
    timeout: 2_000,
  });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(OUT_DIR, "10-summary-mid-run.png"),
  });

  // Back button dismisses; cog can re-open.
  await page.locator('button[aria-label="리플레이로 돌아가기"]').click();
  await page.waitForTimeout(200);
  const stillOpen = await page
    .locator('[data-testid="summary-panel"]')
    .count();
  expect(stillOpen).toBe(0);

  // ---- end-of-run auto-open ----
  const totalMs = await page.evaluate(() => {
    const input = document.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement | null;
    return input ? Number(input.max) : 0;
  });
  expect(totalMs).toBeGreaterThan(0);
  await scrubGlobal(page, totalMs);
  await page.waitForSelector('[data-testid="summary-panel"]', {
    timeout: 3_000,
  });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(OUT_DIR, "11-summary-end.png"),
  });

  // Back button dismisses end-of-run panel too — user lands back on
  // playback at the final node.
  await page.locator('button[aria-label="리플레이로 돌아가기"]').click();
  await page.waitForTimeout(200);
  expect(
    await page.locator('[data-testid="summary-panel"]').count(),
  ).toBe(0);
});

test("relic fly stays linear (no Bezier)", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`${BASE}/history-course/${SEED}`);
  await page.waitForSelector('[data-testid="node-stack-item"], .ring-1', {
    timeout: 8_000,
  });
  await page.waitForTimeout(3_500);
  // Neow's relic is the first relic-gained item — pause and capture the
  // mid-fly frame. With Bezier removed it should travel a straight line.
  await page.keyboard.press("Space");
  // Ancient transit takes 2500ms; relic stack item starts at 2500..5000ms,
  // post phase last 700ms of that. Aim mid-post.
  await scrubGlobal(page, 2500 + 1300 + 200 + 60 + 350); // post mid
  await page.screenshot({
    path: path.join(OUT_DIR, "08-relic-fly-linear.png"),
  });
});
