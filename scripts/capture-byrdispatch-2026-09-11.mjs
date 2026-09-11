import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../public/images/byrdispatch/2026-09-11/", import.meta.url).pathname;
const RUN_ID = "174nxe7x9zfpgm1t";

async function shot(locator, filePath) {
  await locator.waitFor({ state: "visible", timeout: 30000 });
  const box = await locator.boundingBox();
  if (!box || box.width < 8 || box.height < 8) {
    throw new Error(`empty box for ${filePath}`);
  }
  await locator.screenshot({ path: filePath });
  console.log("wrote", filePath, Math.round(box.width), "x", Math.round(box.height));
}

async function shotClip(page, boxes, filePath, pad = 8) {
  const valid = boxes.filter((box) => box && box.width >= 8 && box.height >= 8);
  if (!valid.length) throw new Error(`empty clip for ${filePath}`);
  const viewport = page.viewportSize() ?? { width: 1440, height: 1200 };
  const left = Math.max(0, Math.min(...valid.map((box) => box.x)) - pad);
  const top = Math.max(0, Math.min(...valid.map((box) => box.y)) - pad);
  const right = Math.min(
    viewport.width,
    Math.max(...valid.map((box) => box.x + box.width)) + pad,
  );
  const bottom = Math.min(
    viewport.height,
    Math.max(...valid.map((box) => box.y + box.height)) + pad,
  );
  const clip = { x: left, y: top, width: right - left, height: bottom - top };
  if (clip.width < 8 || clip.height < 8) throw new Error(`empty clip for ${filePath}`);
  await page.screenshot({ path: filePath, clip });
  console.log("wrote", filePath, Math.round(clip.width), "x", Math.round(clip.height));
}

async function waitGone(page, text, timeout = 25000) {
  await page.getByText(text).waitFor({ state: "hidden", timeout }).catch(() => {});
}

async function captureHistoryLastScene(page) {
  await page.goto(`${BASE}/history-course/${RUN_ID}`, { waitUntil: "domcontentloaded" });
  await waitGone(page, "런을 불러오는 중");
  const missing = page.getByText(/찾을 수 없|missing|없어/i);
  if (await missing.count()) {
    throw new Error("검슝 쳐내기 run is not available");
  }
  const stage = page.locator("[data-history-course-stage]");
  await stage.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForFunction(
    () => document.querySelector("[data-history-course-stage]")?.getAttribute("data-history-replay-ready") === "true",
    { timeout: 20000 },
  );

  const markers = page.locator("[data-history-floor-marker]");
  const count = await markers.count();
  const play = page.locator("[data-history-play-toggle]");
  let lootFound = false;

  for (let i = 0; i < Math.min(count, 24); i += 1) {
    await markers.nth(i).click({ force: true });
    await page.waitForTimeout(250);
    if ((await stage.getAttribute("data-history-playing")) !== "true") {
      await play.click({ force: true }).catch(() => {});
    }
    const loot = page.locator("[data-history-combat-loot]");
    try {
      await loot.waitFor({ state: "visible", timeout: 7000 });
      lootFound = true;
      break;
    } catch {
      const scene = page.locator("[data-history-last-scene]");
      const kind = await scene.getAttribute("data-history-last-scene").catch(() => null);
      if (kind && kind !== "stack") {
        // Keep scanning for combat loot; remember a fallback scene.
        if (!lootFound && i === Math.min(count, 24) - 1) break;
      }
    }
  }

  if (!lootFound) {
    const scene = page.locator("[data-history-last-scene]");
    await scene.waitFor({ state: "visible", timeout: 8000 });
  }

  if ((await stage.getAttribute("data-history-playing")) === "true") {
    await play.click({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(400);
  await shot(stage, `${OUT}history-course-loot.png`);
}

async function captureWorldCupPreview(page) {
  await page.goto(`${BASE}/this-or-that/tournament`, { waitUntil: "domcontentloaded" });
  await waitGone(page, "불러오는 중");
  const index = page.locator("[data-favorite-tournament-index]");
  await index.waitFor({ timeout: 25000 });
  const card = page.locator("article.favorite-tournament-lockup").first();
  await card.waitFor({ timeout: 25000 });
  await card.click();
  const preview = page.locator("[data-favorite-tournament-preview]");
  await preview.waitFor({ timeout: 25000 });
  const matchup = page.locator("[data-favorite-tournament-matchup]");
  await matchup.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-favorite-tournament-matchup]");
    if (!el) return false;
    const opacity = Number(getComputedStyle(el).opacity);
    return opacity > 0.9;
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  await shot(preview, `${OUT}worldcup-matchup-preview.png`);
}

async function captureTransfigureAttributes(page) {
  await page.goto(`${BASE}/transfigure`, { waitUntil: "domcontentloaded" });
  await waitGone(page, "불러오는 중");
  const create = page.getByRole("button", { name: "변형하기" });
  await create.waitFor({ timeout: 20000 });
  await create.click();
  const picker = page.locator("[data-transfigure-resource-picker] input[type=\"search\"]");
  await picker.waitFor({ timeout: 15000 });
  await picker.fill("타격");
  await page.waitForTimeout(400);
  const result = page.locator("#transfigure-resource-picker-panel [role='list'] button").first();
  await result.waitFor({ timeout: 10000 });
  await result.click();
  const attrs = page.locator("[data-transfigure-card-attributes]");
  await attrs.waitFor({ timeout: 15000 });

  for (const kind of ["star-cost", "color", "type", "rarity"]) {
    const add = page.locator(`[data-transfigure-card-attribute-add="${kind}"]`);
    if (await add.count()) {
      await add.click();
      await page.waitForTimeout(150);
    }
  }

  const colorSummary = page.locator('[data-transfigure-card-attribute="color"] summary');
  await colorSummary.waitFor({ timeout: 8000 });
  await colorSummary.click();
  const menu = page.locator('[data-transfigure-card-attribute="color"] [role="menu"]');
  await menu.waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(250);
  await shotClip(page, [
    await attrs.boundingBox(),
    await menu.boundingBox(),
  ], `${OUT}transfigure-card-attributes.png`, 12);
}

async function captureSts1CardLibrary(page) {
  await page.goto(`${BASE}/compendium/sts1/cards`, { waitUntil: "domcontentloaded" });
  await waitGone(page, "상세 정보를 불러오는 중입니다.");
  await page.waitForFunction(() => {
    const portraits = [...document.querySelectorAll('img[src*="/images/sts1/cards/"]')];
    const ready = portraits.filter((img) => img.complete && img.naturalWidth > 40);
    return ready.length >= 8;
  }, { timeout: 40000 });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(800);
  const library = page.locator("body > div").locator("div.flex.overflow-hidden").first();
  const layout = page.locator("h1").filter({ hasText: "카드 모음집" }).locator("xpath=ancestor::div[contains(@class,'overflow-hidden')][1]");
  if (await layout.count()) {
    await shot(layout, `${OUT}sts1-card-library.png`);
    return;
  }
  if (await library.count()) {
    await shot(library, `${OUT}sts1-card-library.png`);
    return;
  }
  await shotClip(page, [
    await page.locator("main").first().boundingBox(),
  ], `${OUT}sts1-card-library.png`, 0);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch (error) {
    console.warn("chrome channel failed, falling back", error.message);
    browser = await chromium.launch({ headless: true });
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
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
    await captureHistoryLastScene(page);
    results.historyLoot = true;
  } catch (error) {
    console.error("history loot capture failed:", error.message);
  }

  try {
    await captureWorldCupPreview(page);
    results.worldcup = true;
  } catch (error) {
    console.error("worldcup capture failed:", error.message);
  }

  try {
    await captureTransfigureAttributes(page);
    results.transfigure = true;
  } catch (error) {
    console.error("transfigure capture failed:", error.message);
  }

  try {
    await captureSts1CardLibrary(page);
    results.sts1 = true;
  } catch (error) {
    console.error("sts1 capture failed:", error.message);
  }

  await context.close();
  await browser.close();
  console.log(JSON.stringify(results));
  const required = ["historyLoot", "worldcup", "transfigure", "sts1"];
  const missing = required.filter((key) => !results[key]);
  if (missing.length) {
    throw new Error(`missing required captures: ${missing.join(", ")}`);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
