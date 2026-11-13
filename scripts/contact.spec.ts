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

const API_MARKER = { "X-Slseoun-Api": "1" };
const SAME_ORIGIN_API = /\/api\/(?:read|me|write)\//;

async function fulfillApi(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: API_MARKER,
    body: JSON.stringify(body),
  });
}

/**
 * The same-origin Worker API as the browser sees it (docs/supabase-exit/STEP6_PLAN.md WP-Q): no
 * Supabase. Every /api read and write this suite does not mock answers unavailable, and the claim
 * keeps a cookie identity for `userId` (created: false, no session to store). Routes added later
 * take precedence. Production sets slseoun_idm=cookie; clients from before step 6 WP-A read it.
 */
async function mockWorkerApi(page: Page, userId: string) {
  await page.route(/\.supabase\.co\//, (route) => route.abort("connectionfailed"));
  await page.route(SAME_ORIGIN_API, (route) => fulfillApi(route, { error: "unavailable" }, 503));
  await page.route("**/api/auth/claim", (route) => fulfillApi(route, { v: 1, uid: userId, created: false, session: null }));
  await page.route("**/api/me/mailbox", (route) => fulfillApi(route, { v: 1, env: "development", unseen: false }));
  await page.context().addCookies([{ name: "slseoun_idm", value: "cookie", url: BASE }]);
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
    let submittedAuthorization: string | undefined;
    await mockWorkerApi(page, userId);
    await page.route("**/api/write/contact-inquiries", async (route) => {
      submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
      submittedAuthorization = route.request().headers().authorization;
      // return=minimal on the Worker side: the browser gets no row back.
      await fulfillApi(route, {}, 201);
    });

    await page.goto(
      `${BASE}/contact?from=${encodeURIComponent("/patches/0.103.0?card=ignored")}`,
      { waitUntil: "domcontentloaded" },
    );
    await waitForContactReady(page);
    await expect(page.locator('input[name="contact-category"]:checked')).toHaveCount(0);
    await expect(page.getByText("(선택)", { exact: true })).toHaveCount(0);
    await page.getByLabel("문의 내용").fill("패치 화면에서 확인할 오류가 있습니다.");
    await page.getByRole("button", { name: "발송!" }).click();

    await expect(page.getByRole("heading", { name: "전송 성공! 감사합니다!" })).toBeVisible();
    expect(submittedPayload).toMatchObject({
      category: "other",
      message: "패치 화면에서 확인할 오류가 있습니다.",
      replyEmail: null,
      pagePath: "/patches/0.103.0",
      serviceLocale: "ko",
      gameLocale: "kor",
    });
    // The Worker fills the user id and env from the cookie identity (STEP1_DESIGN 9.3).
    expect(submittedPayload).not.toHaveProperty("status");
    expect(submittedPayload).not.toHaveProperty("userId");
    expect(submittedPayload).not.toHaveProperty("user_id");
    expect(submittedPayload).not.toHaveProperty("env");
    expect(submittedAuthorization).toBeUndefined();
  });
});

test.describe("Tiny Mailbox inquiry history", () => {
  test("shows the user's status and operator response on their profile", async ({ page }) => {
    await setKoreanLocale(page);

    const userId = "00000000-0000-4000-8000-000000000002";
    let profileReadUrl = "";
    await mockWorkerApi(page, userId);
    await page.route("**/api/write/contact-inquiries", (route) => fulfillApi(route, {}, 201));
    await page.route("**/api/write/profile/inquiries-seen", (route) => fulfillApi(route, {}));
    await page.route("**/api/me/profile/inquiries", async (route) => {
      profileReadUrl = route.request().url();
      await fulfillApi(route, {
        v: 1,
        env: "development",
        rows: [{
          id: "00000000-0000-4000-8000-000000000003",
          category: "feedback",
          message: "프로필에서 확인할 문의입니다.",
          env: "development",
          status: "done",
          admin_response: "운영자 답변입니다.",
          created_at: "2026-08-04T00:00:00.000Z",
        }],
      });
    });

    await page.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
    await waitForContactReady(page);
    await page.getByLabel("문의 내용").fill("프로필에서 확인할 문의입니다.");
    await page.getByRole("button", { name: "발송!" }).click();
    await expect(page.getByRole("heading", { name: "전송 성공! 감사합니다!" })).toBeVisible();

    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
    const history = page.locator("[data-profile-inquiries]");
    await expect(history.getByRole("heading", { name: "내 1:1 문의" })).toBeVisible();
    await expect(history.getByText("운영", { exact: true })).toHaveCount(0);
    await expect(history.getByText("개발", { exact: true })).toHaveCount(0);
    await expect(history.getByText("답변 완료", { exact: true })).toBeVisible();
    await expect(history.getByText("운영자 답변입니다.", { exact: true })).toBeVisible();
    expect(new URL(profileReadUrl).pathname).toBe("/api/me/profile/inquiries");
    expect(decodeURIComponent(profileReadUrl)).not.toContain("reply_email");
  });

  test("renders the dev admin mailbox", async ({ page }) => {
    await page.goto(`${BASE}/dev/admin?contactSave=saved`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "문의 우편함" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("저장했습니다.");
  });
});
