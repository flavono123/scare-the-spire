import { test } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const SAMPLES = [
  { id: "anger", label: "Anger (common ironclad)" },
  { id: "backstab", label: "Backstab (uncommon silent)" },
  { id: "aggression", label: "Aggression (rare ironclad)" },
  { id: "abrasive", label: "Abrasive (rare silent power)" },
];

test.describe("Card detail visual", () => {
  test.setTimeout(60_000);

  for (const c of SAMPLES) {
    test(`detail: ${c.label}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${BASE}/codex/cards/${c.id}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(700);
      await page.screenshot({
        path: `/tmp/card-detail-${c.id}.png`,
        fullPage: false,
      });
    });

    test(`upgraded: ${c.label}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${BASE}/codex/cards/${c.id}`);
      await page.waitForLoadState("networkidle");
      const upgradeBtn = page.getByRole("button", { name: /강화 보기/ });
      const hasUpgrade = (await upgradeBtn.count()) > 0;
      if (!hasUpgrade) test.skip();
      await upgradeBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `/tmp/card-detail-${c.id}-upgraded.png`,
        fullPage: false,
      });
    });
  }

  test("enchant toggle + hover tooltip", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${BASE}/codex/cards/abrasive`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    const firstChip = page.locator("button[aria-pressed]").first();
    await firstChip.click();
    await page.waitForTimeout(200);
    await firstChip.hover();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "/tmp/card-detail-abrasive-enchant.png",
      fullPage: true,
    });
  });

  test("library grid sample", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${BASE}/codex/cards`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: "/tmp/codex-cards-grid.png",
      fullPage: false,
    });
  });
});
