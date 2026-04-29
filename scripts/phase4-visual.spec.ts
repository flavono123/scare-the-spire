/**
 * Phase 4 visual smoke — captures the path-trail painting, the clockwise
 * ring sweep on the destination node, the character "pop" landing on the
 * new node, and the new Bezier card-fly arc on the boots fixture.
 *
 *   pnpm exec playwright test scripts/phase4-visual.spec.ts \
 *     --reporter=list
 */

import { test, expect } from "@playwright/test";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join("/tmp", "history-course-shots", "phase4");
const SEED = "EQNAH97QTR"; // winged-boots run

const FLY_SELECTOR =
  '[data-testid="node-stack-item"][data-phase="post"][data-kind="card-gained"], ' +
  '[data-testid="node-stack-item"][data-phase="post"][data-kind="card-bought"], ' +
  '[data-testid="node-stack-item"][data-phase="post"][data-kind="relic-gained"]';

// Sub-window thresholds in `node-action-stack` / `SeededMapView` —
// keep in sync with TRAIL_END / RING_END there.
const NODE_BASE_MS = 2500;
const TRAIL_END_MS = NODE_BASE_MS * 0.7; // 1750
const RING_END_MS = NODE_BASE_MS * 0.92; // 2300

async function scrubGlobal(page: any, ms: number) {
  // The slider is rendered with opacity 0 (visual cue is the marker
  // floating above), so locator.fill won't accept it. Drive the value
  // and React's onChange handler directly via the input's native setter.
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

test("phase 4 — trail / sweep / character pop / bezier fly", async ({ page }) => {
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
  await page.keyboard.press("Space"); // pause

  // Step 2 starts at globalMs ≈ duration of step 1. We don't know its
  // exact length, so jump the slider to a safe range past Neow's stack
  // (~14s on the boots fixture has 1 card + 1 relic = 2 stack items =
  // 2500 transit + 2 × 2500 stack = 7500ms total). Step 2 globalMs
  // start = 7500.
  const step2StartMs = 7500;

  // ---- 01: mid-trail (trail painting only) ----
  await scrubGlobal(page, step2StartMs + Math.round(TRAIL_END_MS / 2));
  await page.screenshot({ path: path.join(OUT_DIR, "01-trail-mid.png") });

  // ---- 02: ring sweep mid (trail done, sweep painting) ----
  await scrubGlobal(
    page,
    step2StartMs + Math.round((TRAIL_END_MS + RING_END_MS) / 2),
  );
  await page.screenshot({ path: path.join(OUT_DIR, "02-ring-sweep.png") });

  // ---- 03: just before character pop (sweep done) ----
  await scrubGlobal(page, step2StartMs + Math.round(RING_END_MS) - 30);
  await page.screenshot({ path: path.join(OUT_DIR, "03-pre-pop.png") });

  // ---- 04: character popped (post-RING_END) ----
  await scrubGlobal(page, step2StartMs + NODE_BASE_MS - 30);
  await page.screenshot({ path: path.join(OUT_DIR, "04-pop.png") });

  // ---- 05: bezier card-fly during stack ----
  // Resume so the stack runs forward into a fly post phase, then pause
  // to capture mid-arc.
  await page.keyboard.press("Space");
  await page.waitForSelector(FLY_SELECTOR, { timeout: 25_000 });
  await page.keyboard.press("Space");
  await page.screenshot({ path: path.join(OUT_DIR, "05-fly.png") });

  expect(errors, errors.join("\n")).toHaveLength(0);
});
