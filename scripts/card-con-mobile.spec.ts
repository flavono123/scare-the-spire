import { expect, test } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

test.describe("mobile card-con on the shared editor", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 375, height: 812 },
  });

  test("chemical-x composer and a comment box both expose the card-con trigger", async ({ page }) => {
    await page.goto(`${BASE}/chemical-x`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-card-con-trigger]").first()).toBeVisible();
    await expect(page.locator("[data-text-con-trigger]").first()).toBeVisible();

    await page.goto(`${BASE}/compendium/cards/strike_ironclad`, { waitUntil: "domcontentloaded" });
    const commentTrigger = page.locator("[data-card-con-trigger]").first();
    await commentTrigger.scrollIntoViewIfNeeded();
    await expect(commentTrigger).toBeVisible();
  });

  test("expands the card search sheet inside the chemical-x editor on 375px", async ({ page }) => {
    await page.goto(`${BASE}/chemical-x`, { waitUntil: "domcontentloaded" });

    const trigger = page.locator("[data-card-con-trigger]").first();
    await expect(trigger).toBeVisible();

    const editorSurface = page.locator('[data-rich-editor-surface="default"]').first();
    const initialBox = await editorSurface.boundingBox();
    expect(initialBox).toBeTruthy();

    await trigger.click();

    const sheet = page.locator("[data-card-con-sheet]").first();
    await expect(sheet).toBeVisible();
    await expect(page.locator("[data-card-con-popup]")).toHaveCount(0);

    const expandedBox = await editorSurface.boundingBox();
    expect(expandedBox).toBeTruthy();
    expect(expandedBox!.height).toBeGreaterThan(initialBox!.height + 160);

    const sheetBox = await sheet.boundingBox();
    expect(sheetBox).toBeTruthy();
    expect(sheetBox!.x).toBeGreaterThanOrEqual(0);
    expect(sheetBox!.x + sheetBox!.width).toBeLessThanOrEqual(375 + 1);

    const search = sheet.locator("input");
    await search.fill("타격");
    const result = sheet.locator("[data-card-con-result]").first();
    await expect(result).toBeVisible();
    await result.click();

    await expect(sheet).toHaveCount(0);
    const inserted = editorSurface.locator("[data-card-con]").first();
    await expect(inserted).toBeVisible();
    const insertedBox = await inserted.boundingBox();
    expect(insertedBox).toBeTruthy();
    expect(insertedBox!.width).toBeLessThanOrEqual(120);
    expect(insertedBox!.x).toBeGreaterThanOrEqual(0);
    expect(insertedBox!.x + insertedBox!.width).toBeLessThanOrEqual(375 + 1);
  });

  test("collapses the sheet from close and from the trigger", async ({ page }) => {
    await page.goto(`${BASE}/chemical-x`, { waitUntil: "domcontentloaded" });

    const trigger = page.locator("[data-card-con-trigger]").first();
    await trigger.click();
    const sheet = page.locator("[data-card-con-sheet]").first();
    await expect(sheet).toBeVisible();

    await sheet.locator("[data-card-con-close]").click();
    await expect(sheet).toHaveCount(0);

    await trigger.click();
    await expect(sheet).toBeVisible();
    await trigger.click();
    await expect(sheet).toHaveCount(0);
  });
});
