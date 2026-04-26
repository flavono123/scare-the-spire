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

  test("Anger + Ember (damage+3 분홍)", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${BASE}/codex/cards/anger`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    const ember = page.locator('button[aria-pressed][title="테즈카타라의 잉걸불"]');
    if ((await ember.count()) === 0) test.skip();
    await ember.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "/tmp/card-detail-anger-ember.png",
      fullPage: false,
    });
  });

  test("Sharp preset 2 ↔ 3", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`${BASE}/codex/cards/anger`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    const sharp = page.locator('button[aria-pressed][title="예리"]');
    if ((await sharp.count()) === 0) test.skip();
    await sharp.click();
    await page.waitForTimeout(200);
    // 프리셋 칩 [2, 3] 중 2 선택
    await page.getByRole("button", { name: "2", pressed: false }).click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "/tmp/card-detail-anger-sharp-2.png",
      fullPage: false,
    });
  });

  test("Sown (에너지 아이콘)", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    // sown은 일반 카드에 모두 가능
    await page.goto(`${BASE}/codex/cards/anger`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    const sown = page.locator('button[aria-pressed][title="발아"]');
    if ((await sown.count()) === 0) test.skip();
    await sown.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "/tmp/card-detail-anger-sown.png",
      fullPage: false,
    });
  });

  test("Spiral on basic strike (재사용 1 골드)", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    // 기본 strike 카드: 사일런트의 strike 같은 거
    await page.goto(`${BASE}/codex/cards/strike_red`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    const spiral = page.locator('button[aria-pressed][title="소용돌이"]');
    if ((await spiral.count()) === 0) test.skip();
    await spiral.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: "/tmp/card-detail-strike-spiral.png",
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
