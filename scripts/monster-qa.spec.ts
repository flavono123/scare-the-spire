import { test } from "@playwright/test";
const BASE = "http://localhost:3000";

test("monster list - boss token + sorted", async ({ page }) => {
  await page.goto(BASE + "/codex/monsters");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/monster-list-v2.png", fullPage: false });
});

test("monster detail - axebot sprite", async ({ page }) => {
  await page.goto(BASE + "/codex/monsters/axebot");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/monster-detail-axebot-v2.png", fullPage: true });
});

test("patch note - skulking colony hover", async ({ page }) => {
  await page.goto(BASE + "/patches/0.102.0");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/patch-monsters.png", fullPage: false });
});
