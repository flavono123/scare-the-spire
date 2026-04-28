import { test, expect } from "@playwright/test";

test("perf probe: count DOM nodes and filtered elements", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("http://localhost:3000/history-course/EQNAH97QTR");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Space");
  await page.waitForTimeout(3700);
  const stats = await page.evaluate(() => {
    const all = document.querySelectorAll('*').length;
    const stage = document.querySelector('[class*="aspect"]');
    const stageAll = stage?.querySelectorAll('*').length ?? 0;
    const map = document.querySelector('[class*="overflow-y-auto"]');
    const mapAll = map?.querySelectorAll('*').length ?? 0;
    const filtered = Array.from(document.querySelectorAll('*')).filter((el) => {
      const cs = getComputedStyle(el);
      return cs.filter && cs.filter !== "none";
    }).length;
    const masked = Array.from(document.querySelectorAll('*')).filter((el) => {
      const cs = getComputedStyle(el);
      return cs.maskImage && cs.maskImage !== "none";
    }).length;
    const dropShadows = Array.from(document.querySelectorAll('*')).filter((el) => {
      const cs = getComputedStyle(el);
      return cs.filter?.includes("drop-shadow");
    }).length;
    const images = document.querySelectorAll('img').length;
    const willChange = Array.from(document.querySelectorAll('*')).filter((el) => {
      const cs = getComputedStyle(el);
      return cs.willChange && cs.willChange !== "auto";
    }).length;
    return { all, stageAll, mapAll, filtered, masked, dropShadows, images, willChange };
  });
  console.log("PERF STATS:", JSON.stringify(stats, null, 2));
  expect(stats.all).toBeGreaterThan(0);
});
