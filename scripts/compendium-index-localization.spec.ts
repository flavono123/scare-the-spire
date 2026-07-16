import { expect, test } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

const CASES = [
  { path: "/compendium/bestiary", localizedName: "잉클릿", englishName: "Inklet" },
  { path: "/compendium/bestiary?view=encounters", localizedName: "루비 습격자", englishName: "Ruby Raiders" },
  { path: "/compendium/ancients", localizedName: "다브", englishName: "Darv" },
  { path: "/compendium/events", localizedName: "심연의 욕탕", englishName: "Abyssal Baths" },
  { path: "/compendium/epochs", localizedName: "프리온", englishName: "Preon" },
  { path: "/zh/compendium/bestiary", localizedName: "墨宝", englishName: "Inklet" },
  { path: "/zh/compendium/bestiary?view=encounters", localizedName: "红宝石劫掠者", englishName: "Ruby Raiders" },
  { path: "/zh/compendium/ancients", localizedName: "达弗", englishName: "Darv" },
  { path: "/zh/compendium/events", localizedName: "深渊浴场", englishName: "Abyssal Baths" },
  { path: "/zh/compendium/epochs", localizedName: "先子星", englishName: "Preon" },
] as const;

for (const sample of CASES) {
  test(`compendium index hides English subtitle but still matches it — ${sample.path}`, async ({ page }) => {
    await page.goto(`${BASE}${sample.path}`);

    const localizedName = page.getByText(sample.localizedName, { exact: true }).first();
    await expect(localizedName).toBeVisible();
    await expect(page.getByText(sample.englishName, { exact: true })).toHaveCount(0);

    await page.locator("#codex-filter-search").fill(sample.englishName);

    await expect(localizedName).toBeVisible();
    await expect(page.getByText(sample.englishName, { exact: true })).toHaveCount(0);
  });
}

test("localized detail rail retains the English name", async ({ page }) => {
  await page.goto(`${BASE}/zh/compendium/ancients`);
  await page.locator("#codex-filter-search").fill("Darv");
  await page.getByText("达弗", { exact: true }).first().click();

  await expect(page.getByText("English name", { exact: true })).toBeVisible();
  await expect(page.getByText("Darv", { exact: true })).toBeVisible();
});
