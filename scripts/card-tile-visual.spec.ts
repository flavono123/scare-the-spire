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

  test("Adroit toggle + hover tooltip", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${BASE}/codex/cards/abrasive`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    const adroit = page.locator('button[aria-pressed][title="숙련"]');
    await adroit.click();
    await page.waitForTimeout(200);
    await adroit.hover();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "/tmp/card-detail-abrasive-adroit.png",
      fullPage: true,
    });
  });

  test("TezcatarasEmber: cost 0 + 영구 키워드", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${BASE}/codex/cards/abrasive`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    const ember = page.locator('button[aria-pressed][title="테즈카타라의 잉걸불"]');
    await ember.click();
    await page.waitForTimeout(300);
    await ember.hover();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "/tmp/card-detail-abrasive-ember.png",
      fullPage: false,
    });
  });

  test("RoyallyApproved: 선천성 + 보존 분홍색", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${BASE}/codex/cards/aggression`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    // RoyallyApproved is for Attack/Skill — Aggression is a Power card, won't show.
    // Use anger (Attack) instead
    await page.goto(`${BASE}/codex/cards/anger`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    const royal = page.locator('button[aria-pressed][title="왕실 인증"]');
    if ((await royal.count()) === 0) test.skip();
    await royal.click();
    await page.waitForTimeout(300);
    await royal.hover();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "/tmp/card-detail-anger-royal.png",
      fullPage: false,
    });
  });

  test("amount 증가 — Adroit 3", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${BASE}/codex/cards/abrasive`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    await page.locator('button[aria-pressed][title="숙련"]').click();
    await page.waitForTimeout(200);
    const plus = page.getByRole("button", { name: "amount 증가" });
    await plus.click();
    await plus.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "/tmp/card-detail-abrasive-adroit-3.png",
      fullPage: false,
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
