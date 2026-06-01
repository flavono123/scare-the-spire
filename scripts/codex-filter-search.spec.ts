import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TOKEN_HINT_NAMES = ["@", "#", "$", "!", "%"];

async function setKoreanServiceLocale(page: Page) {
  await page.context().addCookies([
    {
      name: "sts-game-locale",
      value: "kor",
      url: BASE,
    },
  ]);
}

async function openCompendium(page: Page, selector: string) {
  await setKoreanServiceLocale(page);
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
    await setKoreanServiceLocale(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/compendium/cards`, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /필터 열기|Open filters/ }).click();

    await expect(page.locator("aside input#codex-filter-search").first()).toBeVisible();
  });
});

test.describe("Unified topbar search", () => {
  test("keeps patch notes icon-only and groups global results", async ({ page }) => {
    await openCompendium(page, "/compendium/cards");

    const header = page.locator("header");
    await expect(header.locator('a[href$="/patches"]')).toHaveCount(1);
    await expect(header).not.toContainText("패치 노트");
    await expect(header.getByRole("button", { name: "통합 검색" })).toBeVisible();

    await header.getByRole("button", { name: "통합 검색" }).click();
    const search = page.locator('input[placeholder="통합 검색"]');
    await expect(search).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(search).toHaveCount(0);

    await header.getByRole("button", { name: "통합 검색" }).click();
    await search.fill("strike");
    await expect(page.getByText("카드", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("카드 · Strike")).toHaveCount(0);

    await page.mouse.click(20, 20);
    await expect(search).toHaveCount(0);

    await header.getByRole("button", { name: "통합 검색" }).click();
    await page.locator('input[placeholder="통합 검색"]').fill("0.106");
    await expect(page.getByText("패치 노트", { exact: true }).first()).toBeVisible();

    await page.locator('input[placeholder="통합 검색"]').fill("문을 만드는 자");
    await expect(page.getByText("슬서운 이야기", { exact: true }).first()).toBeVisible();
  });
});
