/**
 * Visual snapshot for the new /history-course/[seed] shell.
 *
 * Run (dev server already on :3000):
 *   pnpm exec playwright test scripts/history-course-shell.spec.ts \
 *     --reporter=list --project=default
 *
 * Captures: default shell, debug drawer open, stats modal open, deck modal,
 * mid-playback (after a few node beats), and topbar close-up crops.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SEEDS = {
  silent: "PH19VCZ8LG", // silent A10 4보스
  ironclad: "EK7H343PSA", // ironclad A10 Win
  bootsDefect: "EQNAH97QTR", // winged-boots
};
const OUT_DIR = path.join("/tmp", "history-course-shots");

test("history-course index renders", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(OUT_DIR, "00-index.png"), fullPage: false });
});

test("history-course shell snapshots", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/${SEEDS.silent}`);
  expect(res?.status()).toBeLessThan(400);

  await page.waitForLoadState("networkidle");
  // Pause playback so screenshots are deterministic.
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);

  // Wait out the act intro (in + hold + out).
  await page.waitForTimeout(2800);
  await page.screenshot({ path: path.join(OUT_DIR, "01-default.png"), fullPage: false });

  // Topbar close-up — top 120px.
  await page.screenshot({
    path: path.join(OUT_DIR, "01b-topbar-default.png"),
    clip: { x: 0, y: 0, width: 1600, height: 130 },
  });

  await page.click('button[aria-label="런 정보 패널"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, "02-info-open.png"), fullPage: false });

  await page.click('button[aria-label="런 정보 패널"]');
  await page.waitForTimeout(300);

  await page.click('button[title="도전 이력"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, "03-stats-modal.png"), fullPage: false });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // Deck modal capture
  await page.click('button[title^="현재 덱"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "05-deck-modal.png"), fullPage: false });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // Mid-playback so we can confirm autoscroll / step movement and topbar updates.
  await page.click('button[aria-label="재생"]').catch(() => {});
  await page.waitForTimeout(4500);
  await page.screenshot({ path: path.join(OUT_DIR, "04-mid-playback.png"), fullPage: false });
  await page.screenshot({
    path: path.join(OUT_DIR, "04b-topbar-mid.png"),
    clip: { x: 0, y: 0, width: 1600, height: 130 },
  });
});

test("history-course winged-boots topbar (relics + flight)", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/${SEEDS.bootsDefect}`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Space");
  await page.waitForTimeout(2900);
  await page.screenshot({
    path: path.join(OUT_DIR, "06-boots-topbar.png"),
    clip: { x: 0, y: 0, width: 1600, height: 130 },
  });
});

test("history-course ironclad topbar (a10 act3)", async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 1600, height: 900 });
  const res = await page.goto(`${BASE}/history-course/${SEEDS.ironclad}`);
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Space");
  await page.waitForTimeout(2900);
  // Open info drawer to switch to act 3 (last) so we can see double boss.
  await page.click('button[aria-label="런 정보 패널"]');
  await page.waitForTimeout(300);
  const actButtons = page.locator('aside button:has-text("층")');
  const lastIdx = (await actButtons.count()) - 1;
  if (lastIdx >= 0) {
    await actButtons.nth(lastIdx).click();
    await page.waitForTimeout(2900);
  }
  await page.click('button[aria-label="런 정보 패널"]');
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(OUT_DIR, "07-ironclad-act3-topbar.png"),
    clip: { x: 0, y: 0, width: 1600, height: 130 },
  });
});
