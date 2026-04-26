/**
 * Visual snapshot for the new /history-course/[seed] shell.
 *
 * Run (dev server already on :3000):
 *   pnpm exec playwright test scripts/history-course-shell.spec.ts \
 *     --reporter=list --project=default
 *
 * Captures three states: default shell, debug drawer open, stats modal open.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SEED = "PH19VCZ8LG"; // silent A10 4보스 fixture
const OUT_DIR = path.join("/tmp", "history-course-shots");

test("history-course index renders", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(OUT_DIR, "00-index.png"), fullPage: false });
});

test("history-course shell snapshots", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/${SEED}`);
  expect(res?.status()).toBeLessThan(400);

  await page.waitForLoadState("networkidle");
  // Pause playback so screenshots are deterministic.
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);

  // Wait out the act intro (in + hold + out).
  await page.waitForTimeout(2800);
  await page.screenshot({ path: path.join(OUT_DIR, "01-default.png"), fullPage: false });

  await page.click('button[aria-label="런 정보 패널"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, "02-info-open.png"), fullPage: false });

  await page.click('button[aria-label="런 정보 패널"]');
  await page.waitForTimeout(300);

  await page.click('button:has-text("도전 이력")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "03-stats-modal.png"), fullPage: false });

  // Capture mid-playback so we can confirm autoscroll / step movement.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.click('button[aria-label="재생"]').catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT_DIR, "04-mid-playback.png"), fullPage: false });
});
