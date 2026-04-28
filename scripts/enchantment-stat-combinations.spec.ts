/**
 * 강화/인챈트 회귀 검증.
 *
 * Stat 합산 (강화 → 인챈트 순서):
 *  - BASH+ + Corrupted   → damage 15 (= 8+2 → ×1.5)
 *  - BASH+ + Sharp(2)    → damage 12 (= 10+2)
 *  - 수비+ + Adroit(3)   → block 11  (= 5+3 → +3)
 *
 * Hover 미리보기 amount 분리 (활성 인챈트의 amount 가 hovered 인챈트 description 에 새지 않아야 함):
 *  - 오염 활성 후 숙련 hover  → 숙련 자체 preset(3) 으로 표시
 *  - 활기(8) 활성 후 신속 hover → 신속 자체 preset(1) 으로 표시
 *  - 활기(8) 활성 후 발아 hover → 발아 자체 preset(1) 으로 표시 (energy icon 1개)
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

  await page.locator('button[title="오염"]').click();
  await page.waitForTimeout(150);
  expect(await cardText(page)).toContain("피해를 15");
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

test("BASH + Instinct = 16 damage (×2 multiplier)", async ({ page }) => {
  await page.goto(`${BASE}/codex/cards/bash`);
  await page.waitForLoadState("networkidle");
  await page.locator('button[title="본능"]').click();
  await page.waitForTimeout(150);
  // base damage 8 → ×2 = 16
  expect(await cardText(page)).toContain("피해를 16");
});

test("BASH+ + Instinct = 20 damage (upgrade then ×2)", async ({ page }) => {
  await page.goto(`${BASE}/codex/cards/bash`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "강화 보기" }).click();
  await page.locator('button[title="본능"]').click();
  await page.waitForTimeout(150);
  // base 8 → upgrade +2 = 10 → ×2 = 20
  expect(await cardText(page)).toContain("피해를 20");
});

test("hover preview uses hovered enchant's own preset, not active one (Corrupted → Adroit)", async ({ page }) => {
  await page.goto(`${BASE}/codex/cards/bash`);
  await page.waitForLoadState("networkidle");

  // amount 가 없는 오염 활성화
  await page.locator('button[title="오염"]').click();
  await page.waitForTimeout(100);

  // 숙련 hover. tooltip 은 hidden md:block 이므로 데스크탑 viewport 강제.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('button[title="숙련"]').hover();
  await page.waitForTimeout(150);

  // tooltip 영역 텍스트 — 숙련의 자체 preset[0] = 3
  const tip = page.getByRole("button", { name: "숙련", exact: true });
  void tip;
  // tooltip 은 카드 우측 absolute. 전체 페이지 텍스트로 확인.
  const text = await cardText(page);
  expect(text).toContain("방어도를 3");
  expect(text).not.toContain("방어도를 1");
});

test("hover preview keeps own preset when active enchant has different amount (Vigorous → Swift)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/codex/cards/bash`);
  await page.waitForLoadState("networkidle");

  // 활기 활성 — preset[0] = 8
  await page.locator('button[title="활기"]').click();
  await page.waitForTimeout(100);

  // 신속 hover — preset[0] = 1, 활기의 8 이 새면 안 됨
  await page.locator('button[title="신속"]').hover();
  await page.waitForTimeout(150);

  const text = await cardText(page);
  expect(text).toContain("카드를 1장 뽑습니다");
  expect(text).not.toContain("카드를 8장 뽑습니다");
});

test("hovering the card itself shows active enchant's tooltip", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/codex/cards/bash`);
  await page.waitForLoadState("networkidle");

  // 본능 적용 후 카드 hover → 본능 description 이 떠야 함
  await page.locator('button[title="본능"]').click();
  await page.waitForTimeout(100);
  // 캐러셀에서 마우스를 카드 영역으로 옮김
  await page.mouse.move(640, 400);
  await page.waitForTimeout(150);

  const text = await cardText(page);
  expect(text).toContain("이 카드의 공격 피해량이 2배가 됩니다");
});

test("clicking the in-card enchant slot removes the enchant", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/codex/cards/bash`);
  await page.waitForLoadState("networkidle");

  // 본능 적용 → 피해 16
  await page.locator('button[title="본능"]').click();
  await page.waitForTimeout(150);
  expect(await cardText(page)).toContain("피해를 16");

  // 카드 슬롯(role=button, label에 "본능 해제") 클릭 → 해제
  await page.getByRole("button", { name: /본능 해제/ }).click();
  await page.waitForTimeout(150);
  expect(await cardText(page)).toContain("피해를 8");
  expect(await cardText(page)).not.toContain("피해를 16");
});

test("hover preview keeps own amount when hovering active enchant", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/codex/cards/bash`);
  await page.waitForLoadState("networkidle");

  // 활기 활성 — preset[0] = 8. 이 상태로 활기 자기 자신을 hover 하면 8 그대로 보여야 함.
  await page.locator('button[title="활기"]').click();
  await page.waitForTimeout(100);
  await page.locator('button[title="활기"]').hover();
  await page.waitForTimeout(150);

  const text = await cardText(page);
  // 활기 description: "이 카드를 처음 사용 시, 추가로 피해를 X 줍니다" → 8
  expect(text).toContain("추가로 피해를 8");
});
