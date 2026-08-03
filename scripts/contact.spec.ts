import { expect, test, type Page, type Route } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function setKoreanLocale(page: Page) {
  await page.context().addCookies([
    {
      name: "sts-game-locale",
      value: "kor",
      url: BASE,
    },
  ]);
}

async function waitForContactReady(page: Page) {
  await expect(page.locator("[data-contact-page]")).toHaveAttribute("data-auth-ready", "true");
}

function mockAnonymousSession(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: userId,
    aud: "authenticated",
    role: "authenticated",
    is_anonymous: true,
    iat: now,
    exp: now + 3600,
  })}.test-signature`;
  const timestamp = new Date(now * 1000).toISOString();

  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "test-refresh-token",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "",
      phone: "",
      app_metadata: { provider: "anonymous", providers: ["anonymous"] },
      user_metadata: {},
      identities: [],
      created_at: timestamp,
      updated_at: timestamp,
      is_anonymous: true,
    },
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.describe("Tiny Mailbox contact entry points", () => {
  test("uses a separated topbar utility on wide screens", async ({ page }) => {
    await setKoreanLocale(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

    const desktopContact = page.locator('header a[href*="/contact?from="]').filter({
      has: page.locator('img[src*="tiny_mailbox"]'),
    });
    await expect(desktopContact).toBeVisible();
    await expect(page.locator('[data-contact-launcher="mobile"]')).toBeHidden();
  });

  test("keeps contact reachable without crowding the mobile topbar", async ({ page }) => {
    await setKoreanLocale(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

    const launcher = page.locator('[data-contact-launcher="mobile"]');
    await expect(launcher).toBeVisible();
    await expect(page.locator('header a[href*="/contact?from="]')).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await launcher.click();
    await expect(page).toHaveURL(/\/contact\?from=%2F$/);
    await expect(page.getByRole("heading", { name: "작은 우편함" })).toBeVisible();
    await expect(page.locator('[data-contact-launcher="mobile"]')).toHaveCount(0);
  });
});

test.describe("Tiny Mailbox contact form", () => {
  test("requires a reply address for partnership inquiries", async ({ page }) => {
    await setKoreanLocale(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/contact?from=%2Fpatches%2F0.103.0`, { waitUntil: "domcontentloaded" });
    await waitForContactReady(page);

    const submit = page.getByRole("button", { name: "발송!" });
    await expect(submit).toBeDisabled();
    await page.getByText("협업·제휴", { exact: true }).click();
    await page.getByLabel("문의 내용").fill("함께 만들 콘텐츠에 관해 제안드리고 싶습니다.");
    await expect(submit).toBeDisabled();

    const email = page.getByLabel("답변받을 이메일");
    await expect(email).toHaveAttribute("required", "");
    await email.fill("partner@example.com");
    await expect(submit).toBeEnabled();
  });

  test("submits a private inquiry without requesting a readable row", async ({ page }) => {
    await setKoreanLocale(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const userId = "00000000-0000-4000-8000-000000000001";
    let submittedPayload: Record<string, unknown> | null = null;
    await page.route("**/auth/v1/signup", (route) => fulfillJson(route, mockAnonymousSession(userId)));
    await page.route("**/rest/v1/contact_inquiries**", async (route) => {
      submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, body: "" });
    });

    await page.goto(
      `${BASE}/contact?from=${encodeURIComponent("/patches/0.103.0?card=ignored")}`,
      { waitUntil: "domcontentloaded" },
    );
    await waitForContactReady(page);
    await page.getByLabel("문의 내용").fill("패치 화면에서 확인할 오류가 있습니다.");
    await page.getByRole("button", { name: "발송!" }).click();

    await expect(page.getByRole("heading", { name: "전송 성공! 감사합니다!" })).toBeVisible();
    expect(submittedPayload).toMatchObject({
      user_id: userId,
      category: "feedback",
      message: "패치 화면에서 확인할 오류가 있습니다.",
      reply_email: null,
      page_path: "/patches/0.103.0",
      service_locale: "ko",
      game_locale: "kor",
    });
    expect(submittedPayload).not.toHaveProperty("status");
  });
});
