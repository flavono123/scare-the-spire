/**
 * Phase 4 visual smoke — captures the path-trail painting and the new
 * Bezier card/relic-fly arc on the boots fixture.
 *
 *   pnpm exec playwright test scripts/phase4-visual.spec.ts \
 *     --reporter=list
 */

import { test, expect } from "@playwright/test";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join("/tmp", "history-course-shots", "phase4");
const SEED = "EQNAH97QTR"; // winged-boots run — relic at step 1, cards later

const FLY_SELECTOR =
  '[data-testid="node-stack-item"][data-phase="post"][data-kind="card-gained"], ' +
  '[data-testid="node-stack-item"][data-phase="post"][data-kind="card-bought"], ' +
  '[data-testid="node-stack-item"][data-phase="post"][data-kind="relic-gained"]';

test("phase 4 — trail painting + bezier fly", async ({ page }) => {
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
  // Let the act-intro clear (fade-in 600 + hold 1500 + fade-out 500 +
  // 850ms map-scroll buffer ≈ 3.5s).
  await page.waitForTimeout(3_500);
  await page.screenshot({ path: path.join(OUT_DIR, "01-after-intro.png") });

  // ----- mid-transit screenshot -----
  // Pause and arrow forward into a fresh node so the transit window is
  // guaranteed to be 0 at unpause. 2× ArrowRight to clear Neow + first
  // monster.
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(120);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(120);
  await page.keyboard.press("Space"); // resume
  await page.waitForTimeout(900); // ~midway through 2500ms transit
  await page.screenshot({ path: path.join(OUT_DIR, "02-mid-transit.png") });

  // ----- bezier arc screenshot -----
  // Wait for any card / relic item to be in the post phase, then pause
  // and snap. The post phase is now 500ms (Phase 4) so we have a wider
  // capture window than before.
  await page.waitForSelector(FLY_SELECTOR, { timeout: 25_000 });
  await page.keyboard.press("Space"); // freeze the arc
  await page.screenshot({ path: path.join(OUT_DIR, "03-fly-frozen.png") });

  // Sample two more frames by un-pause / pause cycles around the same
  // item — confirms the arc travels rather than lerps linearly.
  await page.keyboard.press("Space");
  await page.waitForTimeout(80);
  await page.keyboard.press("Space");
  await page.screenshot({ path: path.join(OUT_DIR, "04-fly-mid.png") });

  await page.keyboard.press("Space");
  await page.waitForTimeout(80);
  await page.keyboard.press("Space");
  await page.screenshot({ path: path.join(OUT_DIR, "05-fly-late.png") });

  expect(errors, errors.join("\n")).toHaveLength(0);
});
