import { expect, test } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

test.describe("mobile codex drawer", () => {
  test("keeps patch notes and the toy box reachable in the top nav", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/patches`, { waitUntil: "networkidle" });

    await expect(page.locator('header a[href$="/patches"]')).toBeVisible();
    await expect(page.locator('header a[href$="/chemical-x"]')).toHaveCount(0);

    const toyBox = page.locator('header button[title="장난감 상자"], header button[title="Toy Box"]').first();
    await expect(toyBox).toBeVisible();
    await toyBox.click();

    await expect(page.locator('header a[href$="/chemical-x"]').first()).toBeVisible();
    await expect(page.locator('header a[href$="/history-course"]').first()).toBeVisible();
  });

  test("locks background scroll while filters are open", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/compendium/cards`, { waitUntil: "networkidle" });

    const openFilters = page.getByRole("button", { name: /필터 열기|Open filters/ });
    await expect(openFilters).toBeVisible();
    await openFilters.click();

    await expect(page.getByRole("button", { name: /필터 닫기|Close filters/ })).toBeVisible();
    await expect(page.locator("aside input#codex-filter-search").first()).toBeVisible();
    await expect(page.getByText(/캐릭터|Character/).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.mouse.click(330, 120);

    await expect(page.getByRole("button", { name: /필터 열기|Open filters/ })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("");
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  });
});

test.describe("mobile patch note entity preview", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test("opens preview before navigating to entity detail", async ({ page }) => {
    await page.goto(`${BASE}/patches/0.103.0`, { waitUntil: "networkidle" });
    const startUrl = page.url();
    const entityLinks = page.locator('a[href*="not_yet"]');

    await entityLinks.first().click();

    await expect(page).toHaveURL(startUrl);
    await expect(page.getByRole("button", { name: "닫기", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "상세 보기" })).toHaveCount(0);
    await expect(entityLinks).toHaveCount(2);

    await page.mouse.click(16, 120);
    await expect(entityLinks).toHaveCount(1);

    await entityLinks.first().click();
    await expect(entityLinks).toHaveCount(2);
    await entityLinks.last().click();
    await expect(page).toHaveURL(/\/codex\/cards\?card=not_yet/);
  });
});
