import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TOKEN_HINT_NAMES = ["@", "#", "$", "!", "%"];

async function openCompendium(page: Page, selector: string) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${BASE}${selector}`, { waitUntil: "networkidle" });
}

async function sidebarSearch(page: Page) {
  const search = page.locator("aside input#codex-filter-search").first();
  await expect(search).toBeVisible();
  return search;
}

test.describe("Codex sidebar search", () => {
  test("uses a plain game-style search field without token hint controls", async ({ page }) => {
    await openCompendium(page, "/compendium/cards");
    const search = await sidebarSearch(page);

    await expect(search).toHaveAttribute("placeholder", /검색|Search/);
    await search.focus();
    for (const tokenName of TOKEN_HINT_NAMES) {
      await expect(page.getByRole("button", { name: tokenName, exact: true })).toHaveCount(0);
    }
  });

  test("matches Korean card titles by English title while service locale is Korean", async ({ page }) => {
    await openCompendium(page, "/compendium/cards");
    const search = await sidebarSearch(page);

    await search.fill("strike");

    await expect(page.getByText("타격", { exact: true }).first()).toBeVisible();
  });

  test("matches card body text as well as card titles", async ({ page }) => {
    await openCompendium(page, "/compendium/cards");
    const search = await sidebarSearch(page);

    await search.fill("gain block");

    await expect(page.getByText("수비", { exact: true }).first()).toBeVisible();
  });

  test("keeps sidebar search available in the mobile filter drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/compendium/cards`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /필터 열기|Open filters/ }).click();

    await expect(page.locator("aside input#codex-filter-search").first()).toBeVisible();
  });
});
