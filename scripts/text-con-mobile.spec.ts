import { expect, test } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

test.describe("mobile text-con editor expansion", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 375, height: 812 },
  });

  test("expands editing sheet inline securing vertical height on 375px viewport", async ({ page }) => {
    await page.goto(`${BASE}/chemical-x`, { waitUntil: "networkidle" });

    const trigger = page.locator("[data-text-con-trigger]").first();
    await expect(trigger).toBeVisible();

    const editorSurface = page.locator('[data-rich-editor-surface="default"]').first();
    const initialBox = await editorSurface.boundingBox();
    expect(initialBox).toBeTruthy();

    // Tap the trigger to open
    await trigger.click();

    // Verify the inline sheet is visible
    const sheet = page.locator("[data-text-con-sheet]").first();
    await expect(sheet).toBeVisible();

    // Verify vertical height expanded significantly
    const expandedBox = await editorSurface.boundingBox();
    expect(expandedBox).toBeTruthy();
    expect(expandedBox!.height).toBeGreaterThan(initialBox!.height + 200);

    // Verify no horizontal overflow in 375px viewport
    const sheetBox = await sheet.boundingBox();
    expect(sheetBox).toBeTruthy();
    expect(sheetBox!.x).toBeGreaterThanOrEqual(0);
    expect(sheetBox!.x + sheetBox!.width).toBeLessThanOrEqual(375 + 1);

    // Type text and verify live chip updates
    const textarea = sheet.locator("textarea").first();
    await textarea.fill("테스트\n글자콘");

    const chip = sheet.locator("[data-text-con]").first();
    await expect(chip).toContainText("테스트");
    await expect(chip).toContainText("글자콘");

    // Click submit button
    const submitBtn = sheet.getByRole("button", { name: "등록" });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify sheet collapses
    await expect(sheet).toHaveCount(0);

    // Verify text-con chip was inserted into the editor
    const insertedCon = editorSurface.locator("[data-text-con]").first();
    await expect(insertedCon).toBeVisible();
    await expect(insertedCon).toContainText("테스트");
  });

  test("collapses editing sheet when close button is clicked or toggled", async ({ page }) => {
    await page.goto(`${BASE}/chemical-x`, { waitUntil: "networkidle" });

    const trigger = page.locator("[data-text-con-trigger]").first();
    await expect(trigger).toBeVisible();

    // Tap trigger to open
    await trigger.click();
    const sheet = page.locator("[data-text-con-sheet]").first();
    await expect(sheet).toBeVisible();

    // Click close button
    const closeBtn = sheet.getByRole("button", { name: "닫기" });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Verify sheet collapses
    await expect(sheet).toHaveCount(0);

    // Tap trigger again to open
    await trigger.click();
    await expect(sheet).toBeVisible();

    // Tap trigger again to toggle close
    await trigger.click();
    await expect(sheet).toHaveCount(0);
  });
});
