import { expect, test } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function focusSearch(page: import("@playwright/test").Page, selector: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}${selector}`, { waitUntil: "networkidle" });
  const search = page.locator("input[id$='search']").first();
  await expect(search).toBeVisible();
  await search.focus();
}

test.describe("Codex filter search token hints", () => {
  test("event act search uses percent token, not at token", async ({ page }) => {
    await focusSearch(page, "/codex/events");

    await expect(page.getByRole("button", { name: "%", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "@", exact: true })).toHaveCount(0);
  });

  test("card search keeps bang for cost and dollar for rarity", async ({ page }) => {
    await focusSearch(page, "/codex/cards");

    await expect(page.getByRole("button", { name: "!", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "$", exact: true })).toBeVisible();
  });

  test("relic rarity search uses dollar token", async ({ page }) => {
    await focusSearch(page, "/codex/relics");

    await expect(page.getByRole("button", { name: "@", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "$", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "!", exact: true })).toHaveCount(0);
  });

  test("potion rarity search uses dollar token", async ({ page }) => {
    await focusSearch(page, "/codex/potions");

    await expect(page.getByRole("button", { name: "@", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "$", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "!", exact: true })).toHaveCount(0);
  });

  test("monster search separates type and act tokens", async ({ page }) => {
    await focusSearch(page, "/codex/monsters");

    await expect(page.getByRole("button", { name: "#", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "%", exact: true })).toBeVisible();
  });
});
