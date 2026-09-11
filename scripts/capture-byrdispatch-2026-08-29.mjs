import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const OUT = new URL("../public/images/byrdispatch/2026-08-29/", import.meta.url).pathname;
const BOARD_TITLE = "네크공주님을석방하라";

async function shot(locator, path) {
  await locator.waitFor({ state: "visible", timeout: 30000 });
  const box = await locator.boundingBox();
  if (!box || box.width < 8 || box.height < 8) {
    throw new Error(`empty box for ${path}`);
  }
  await locator.screenshot({ path });
  console.log("wrote", path, Math.round(box.width), "x", Math.round(box.height));
}

async function shotClip(page, boxes, path, pad = 8) {
  const valid = boxes.filter((box) => box && box.width >= 8 && box.height >= 8);
  if (!valid.length) throw new Error(`empty clip for ${path}`);
  const viewport = page.viewportSize() ?? { width: 1440, height: 1100 };
  const left = Math.max(0, Math.min(...valid.map((box) => box.x)) - pad);
  const top = Math.max(0, Math.min(...valid.map((box) => box.y)) - pad);
  const right = Math.min(viewport.width, Math.max(...valid.map((box) => box.x + box.width)) + pad);
  const bottom = Math.min(viewport.height, Math.max(...valid.map((box) => box.y + box.height)) + pad);
  const clip = { x: left, y: top, width: right - left, height: bottom - top };
  if (clip.width < 8 || clip.height < 8) throw new Error(`empty clip for ${path}`);
  await page.screenshot({ path, clip });
  console.log("wrote", path, Math.round(clip.width), "x", Math.round(clip.height));
}

async function waitGone(page, text, timeout = 25000) {
  await page.getByText(text).waitFor({ state: "hidden", timeout }).catch(() => {});
}

async function ensureKorean(page) {
  const create = page.getByRole("button", { name: "티어 만들기" });
  if (await create.isVisible().catch(() => false)) return;
  const englishCreate = page.getByRole("button", { name: "Make tiers" });
  if (await englishCreate.isVisible().catch(() => false)) {
    const language = page.getByRole("button", { name: /English|영어|Language|언어/ }).first();
    if (await language.isVisible().catch(() => false)) {
      await language.click();
      const korean = page.getByRole("menuitem", { name: "한국어" })
        .or(page.getByRole("button", { name: "한국어" }))
        .or(page.getByText("한국어", { exact: true }));
      await korean.first().click();
      await page.getByRole("button", { name: "티어 만들기" }).waitFor({ timeout: 15000 });
    }
  }
}

async function findBoardTitle(page) {
  for (let i = 0; i < 16; i += 1) {
    const hit = page.getByText(BOARD_TITLE, { exact: false }).first();
    if (await hit.isVisible().catch(() => false)) return hit;
    const sentinel = page.locator("[data-feed-load-more]");
    if (await sentinel.count()) {
      await sentinel.scrollIntoViewIfNeeded().catch(() => {});
    } else {
      await page.mouse.wheel(0, 1400);
    }
    await page.waitForTimeout(700);
  }
  return null;
}

async function playUntilDone(page) {
  const play = page.locator("[data-favorite-tournament-play]");
  for (let i = 0; i < 24; i += 1) {
    if (!(await play.isVisible().catch(() => false))) return;
    const choice = play.locator("button[aria-label]").first();
    if (!(await choice.isVisible().catch(() => false))) {
      await page.waitForTimeout(400);
      continue;
    }
    await choice.click();
    await page.waitForTimeout(900);
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    locale: "ko-KR",
  });
  await context.addCookies([
    { name: "sts-service-locale", value: "ko", url: BASE },
    { name: "sts-game-locale", value: "kor", url: BASE },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const results = {};

  try {
    await page.goto(`${BASE}/decisions-decisions`, { waitUntil: "domcontentloaded" });
    await waitGone(page, "보드를 불러오는 중...");
    await waitGone(page, "불러오는 중");
    await ensureKorean(page);

    const create = page.getByRole("button", { name: "티어 만들기" });
    await create.waitFor({ state: "visible", timeout: 25000 });
    await create.click();
    const modal = page.locator("[data-decisions-decisions-composer-modal]");
    await modal.waitFor();
    await page.locator("[data-decisions-decisions-step=template]").waitFor();
    await page.locator("[data-decisions-decisions-presets]").waitFor();
    await page.waitForTimeout(400);
    await shot(modal, `${OUT}decisions-prepare.png`);
    results.prepare = true;
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});

    const titleHit = await findBoardTitle(page);
    if (!titleHit) throw new Error(`${BOARD_TITLE} not on decisions index`);
    await titleHit.click();
    await page.locator("[data-decisions-decisions-page=detail]").waitFor();
    const heading = page.getByRole("heading", { name: BOARD_TITLE });
    await heading.waitFor();
    await page.locator("[data-decisions-decisions-row]").first().waitFor();
    await page.waitForTimeout(400);
    const header = heading.locator("xpath=ancestor::header[1]");
    const rows = page.locator("[data-decisions-decisions-row]");
    const lastRow = rows.nth(await rows.count() - 1);
    await lastRow.scrollIntoViewIfNeeded().catch(() => {});
    await shotClip(page, [
      await header.boundingBox().catch(() => heading.boundingBox()),
      await heading.boundingBox(),
      await lastRow.boundingBox(),
      await rows.first().boundingBox(),
    ], `${OUT}decisions-free-the-nec-princess.png`);
    results.board = true;

    await page.goto(`${BASE}/this-or-that/tournament`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-favorite-tournament-index]").waitFor();
    if (await page.getByText("데이터베이스가 응답하지 않습니다").isVisible().catch(() => false)) {
      throw new Error("tournament storage unavailable");
    }
    await waitGone(page, "토너먼트를 불러오는 중...");
    await page.waitForTimeout(600);

    const cards = page.locator("article[role='link']");
    await cards.first().waitFor();
    const cardCount = await cards.count();
    let rankingOk = false;
    let voteHref = null;

    for (let i = 0; i < Math.min(cardCount, 10); i += 1) {
      await cards.nth(i).click();
      await page.getByRole("button", { name: "시작하기" }).waitFor();
      voteHref = page.url();
      const playCount = await page.evaluate(() => {
        const match = document.body.innerText.match(/(\d+)\s*회 플레이/);
        return match ? Number(match[1]) : 0;
      });
      if (playCount > 0) {
        await page.getByRole("button", { name: "랭킹 보기" }).click();
        await page.waitForTimeout(400);
        const table = page.locator("table").first();
        if (await table.isVisible().catch(() => false)) {
          const section = table.locator("xpath=ancestor::section[1]");
          await shot((await section.count()) ? section : table, `${OUT}tournament-ranking.png`);
          rankingOk = true;
          break;
        }
      }
      await page.goto(`${BASE}/this-or-that/tournament`, { waitUntil: "domcontentloaded" });
      await waitGone(page, "토너먼트를 불러오는 중...");
      await cards.first().waitFor();
    }
    results.ranking = rankingOk;

    if (!voteHref) {
      await cards.first().click();
      await page.getByRole("button", { name: "시작하기" }).waitFor();
    } else if (!page.url().includes("/this-or-that/tournament/")) {
      await page.goto(voteHref, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "시작하기" }).waitFor();
    }

    const four = page.getByRole("button", { name: "4강" });
    if (await four.isVisible().catch(() => false)) await four.click();
    await page.getByRole("button", { name: "시작하기" }).click();
    const play = page.locator("[data-favorite-tournament-play]");
    await play.waitFor();
    await page.waitForTimeout(800);
    await shot(play, `${OUT}tournament-vote.png`);
    results.vote = true;

    if (!rankingOk) {
      await playUntilDone(page);
      await page.getByRole("button", { name: "랭킹 보기" }).waitFor({ timeout: 20000 });
      await page.getByRole("button", { name: "랭킹 보기" }).click();
      await page.waitForTimeout(800);
      const table = page.locator("table").first();
      if (await table.isVisible().catch(() => false)) {
        const section = table.locator("xpath=ancestor::section[1]");
        await shot((await section.count()) ? section : table, `${OUT}tournament-ranking.png`);
        rankingOk = true;
      } else {
        console.log("skip ranking: no table after play");
      }
    }
    results.ranking = rankingOk;

    await page.goto(`${BASE}/compendium/cards`, { waitUntil: "domcontentloaded" });
    const mp = page.getByRole("button", { name: "멀티플레이 카드", exact: true });
    await mp.waitFor();
    await mp.click();
    const melted = page.getByRole("button", { name: "멀티플레이 카드만" });
    await melted.waitFor({ timeout: 8000 });
    await page.waitForTimeout(800);
    const index = page.locator("div.flex").filter({ has: melted }).filter({
      has: page.locator("main"),
    }).first();
    const fallback = page.locator("div").filter({ hasText: "카드 목록" }).locator(
      "xpath=ancestor::div[contains(@class,'100dvh')][1]",
    );
    const crop = (await index.count()) ? index : fallback;
    await shot(crop, `${OUT}cards-multiplayer-only.png`);
    results.cards = true;
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(results));
  const required = ["prepare", "board", "vote", "cards"];
  const missing = required.filter((key) => !results[key]);
  if (missing.length) {
    throw new Error(`missing required captures: ${missing.join(", ")}`);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
