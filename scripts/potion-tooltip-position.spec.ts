/**
 * Verify potion tooltip positioning:
 * - Potions in the left half → tooltip appears to the RIGHT of the tile
 * - Potions in the right half → tooltip appears to the LEFT of the tile
 * - Tooltip must NOT overlap the hovered tile
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const TILE = "[data-potion-tile]";

async function waitForTooltip(page: import("@playwright/test").Page) {
  // Tooltip is a fixed-position div with pointer-events: none
  const tooltip = page.locator("div[style*='pointer-events: none']");
  await expect(tooltip).toBeVisible({ timeout: 3000 });
  return tooltip;
}

test.describe("Potion tooltip dynamic positioning", () => {
  test("tooltip appears right of tile for left-side potions", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/codex/potions`, { waitUntil: "networkidle" });

    const tiles = page.locator(TILE);
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);

    // Find a tile whose center is in the left third
    let leftTile = null;
    for (let i = 0; i < count; i++) {
      const box = await tiles.nth(i).boundingBox();
      if (box && box.x + box.width / 2 < 1280 / 3) {
        leftTile = tiles.nth(i);
        break;
      }
    }
    expect(leftTile).not.toBeNull();

    await leftTile!.hover();
    const tooltip = await waitForTooltip(page);

    const tileBox = await leftTile!.boundingBox();
    const tooltipBox = await tooltip.boundingBox();
    expect(tileBox).not.toBeNull();
    expect(tooltipBox).not.toBeNull();

    // Tooltip should be to the RIGHT of the tile (no overlap)
    expect(tooltipBox!.x).toBeGreaterThanOrEqual(tileBox!.x + tileBox!.width - 2);
  });

  test("tooltip appears left of tile for right-side potions", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/codex/potions`, { waitUntil: "networkidle" });

    const tiles = page.locator(TILE);
    const count = await tiles.count();

    // Find a tile whose center is in the right third
    let rightTile = null;
    for (let i = 0; i < count; i++) {
      const box = await tiles.nth(i).boundingBox();
      if (box && box.x + box.width / 2 > 1280 * 2 / 3) {
        rightTile = tiles.nth(i);
        break;
      }
    }
    expect(rightTile).not.toBeNull();

    await rightTile!.hover();
    const tooltip = await waitForTooltip(page);

    const tileBox = await rightTile!.boundingBox();
    const tooltipBox = await tooltip.boundingBox();
    expect(tileBox).not.toBeNull();
    expect(tooltipBox).not.toBeNull();

    // Tooltip should be to the LEFT of the tile (no overlap)
    expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(tileBox!.x + 2);
  });

  test("tooltip never overlaps hovered tile across viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/codex/potions`, { waitUntil: "networkidle" });

    const tiles = page.locator(TILE);
    const count = await tiles.count();

    // Sample tiles evenly
    const indices = [0, Math.floor(count / 4), Math.floor(count / 2), Math.floor(count * 3 / 4), count - 1];

    for (const idx of indices) {
      const tile = tiles.nth(idx);
      const tileBox = await tile.boundingBox();
      if (!tileBox) continue;

      await tile.hover();
      await page.waitForTimeout(200);

      const tooltip = page.locator("div[style*='pointer-events: none']");
      const isVisible = await tooltip.isVisible().catch(() => false);
      if (!isVisible) continue;

      const tooltipBox = await tooltip.boundingBox();
      if (!tooltipBox) continue;

      const overlapsH =
        tooltipBox.x < tileBox.x + tileBox.width &&
        tooltipBox.x + tooltipBox.width > tileBox.x;
      const overlapsV =
        tooltipBox.y < tileBox.y + tileBox.height &&
        tooltipBox.y + tooltipBox.height > tileBox.y;

      expect(
        overlapsH && overlapsV,
        `Tile idx=${idx} at x=${Math.round(tileBox.x)}: tooltip at x=${Math.round(tooltipBox.x)} w=${Math.round(tooltipBox.width)} overlaps`
      ).toBe(false);
    }
  });
});
