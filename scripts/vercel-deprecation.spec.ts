import { expect, test } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const REDIRECT_TARGET =
  process.env.VERCEL_DEPRECATION_LOCAL_TARGET_ORIGIN ?? "http://127.0.0.1:3101";
const PRODUCTION_TARGET = "https://scare-the-spire.flavono123.workers.dev";

test.use({ locale: "ko-KR" });

test("redirects a known legacy page with its path and query intact", async ({ request }) => {
  const response = await request.get(`${BASE}/patches?version=0.108.0`, {
    headers: {
      "x-vercel-deprecation-local-test": "1",
      "x-vercel-deprecation-local-target-origin": REDIRECT_TARGET,
    },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe(
    `${REDIRECT_TARGET}/patches?version=0.108.0`,
  );
});

test("renders the Korean migration landing for an unknown path", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const response = await page.goto(`${BASE}/random`, { waitUntil: "networkidle" });

  expect(response?.status()).toBe(404);
  await expect(page.locator("[data-migration-not-found]")).toBeVisible();
  await expect(page.locator(".byrdispatch-floating-notice")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "슬서운이야기는 새 사이트로 이전했습니다" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "새 사이트로 이동" })).toHaveAttribute(
    "href",
    PRODUCTION_TARGET,
  );
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 375);
});

test("renders the English migration landing for an unknown localized path", async ({ page }) => {
  const response = await page.goto(`${BASE}/en/random`, { waitUntil: "networkidle" });

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Scare the Spire has moved" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to the new site" })).toHaveAttribute(
    "href",
    PRODUCTION_TARGET,
  );
});
