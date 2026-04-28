/**
 * 강화 + 인챈트 합산 회귀 검증.
 *  - BASH+ + Corrupted   → damage 15 (= 8+2 → ×1.5)
 *  - BASH+ + Sharp(2)    → damage 12 (= 10+2)
 *  - 수비+ + Adroit(3)   → block 11  (= 5+3 → +3)
 */
import { test, expect, Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const cardText = (page: Page) => page.locator("body").innerText();

test("BASH+ + Corrupted = 15 damage", async ({ page }) => {
  await page.goto(`${BASE}/codex/cards/bash`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "강화 보기" }).click();
  await page.waitForTimeout(150);
  expect(await cardText(page)).toContain("피해를 10");

  await page.getByRole("button", { name: /오염|Corrupted/i }).click();
  await page.waitForTimeout(150);
  expect(await cardText(page)).toContain("피해를 15");

  await page.screenshot({ path: "/tmp/bash-upgrade-corrupted.png", fullPage: true });
});

test("BASH+ + Sharp(2) = 12 damage", async ({ page }) => {
  await page.goto(`${BASE}/codex/cards/bash`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "강화 보기" }).click();
  await page.locator('button[title="예리"]').click();
  await page.waitForTimeout(150);
  expect(await cardText(page)).toContain("피해를 12");
});

test("DEFEND+ + Adroit(3) = 11 block", async ({ page }) => {
  await page.goto(`${BASE}/codex/cards/defend_ironclad`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "강화 보기" }).click();
  await page.locator('button[title="숙련"]').click();
  await page.waitForTimeout(150);
  expect(await cardText(page)).toContain("방어도를 11");
});
