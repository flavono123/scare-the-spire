import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../public/images/byrdispatch/2026-09-06/", import.meta.url).pathname;

function chromeDefault() {
  return path.join(os.homedir(), "Library/Application Support/Google/Chrome/Default");
}

function copyChromeOriginData() {
  const dest = path.join(os.tmpdir(), "sts-byrdispatch-2026-09-06-recapture");
  rmSync(dest, { recursive: true, force: true });
  const src = chromeDefault();
  mkdirSync(path.join(dest, "Default"), { recursive: true });
  cpSync(
    path.join(src, "Local Storage"),
    path.join(dest, "Default/Local Storage"),
    { recursive: true, filter: (entry) => !entry.endsWith("LOCK") },
  );
  const idbSrc = path.join(src, "IndexedDB");
  const idbDest = path.join(dest, "Default/IndexedDB");
  mkdirSync(idbDest, { recursive: true });
  if (existsSync(idbSrc)) {
    for (const name of readdirSync(idbSrc)) {
      if (!name.includes("localhost_3000")) continue;
      cpSync(path.join(idbSrc, name), path.join(idbDest, name), {
        recursive: true,
        filter: (entry) => !entry.endsWith("LOCK"),
      });
    }
  }
  return dest;
}

async function shotClip(page, boxes, filePath, pad = 8) {
  const valid = boxes.filter((box) => box && box.width >= 8 && box.height >= 8);
  if (!valid.length) throw new Error(`empty clip for ${filePath}`);
  const viewport = page.viewportSize() ?? { width: 1440, height: 1400 };
  const left = Math.max(0, Math.min(...valid.map((box) => box.x)) - pad);
  const top = Math.max(0, Math.min(...valid.map((box) => box.y)) - pad);
  const right = Math.min(viewport.width, Math.max(...valid.map((box) => box.x + box.width)) + pad);
  const bottom = Math.min(viewport.height, Math.max(...valid.map((box) => box.y + box.height)) + pad);
  const clip = { x: left, y: top, width: right - left, height: bottom - top };
  if (clip.width < 8 || clip.height < 8) throw new Error(`empty clip for ${filePath}`);
  await page.screenshot({ path: filePath, clip });
  console.log("wrote", filePath, Math.round(clip.width), "x", Math.round(clip.height));
}

async function shot(locator, filePath) {
  await locator.waitFor({ state: "visible", timeout: 30000 });
  const box = await locator.boundingBox();
  if (!box || box.width < 8 || box.height < 8) throw new Error(`empty box for ${filePath}`);
  await locator.screenshot({ path: filePath });
  console.log("wrote", filePath, Math.round(box.width), "x", Math.round(box.height));
}

async function waitGone(page, text, timeout = 25000) {
  await page.getByText(text).waitFor({ state: "hidden", timeout }).catch(() => {});
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const userDataDir = copyChromeOriginData();
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1400 },
    locale: "ko-KR",
  });
  await context.addCookies([
    { name: "sts-service-locale", value: "ko", url: BASE },
    { name: "sts-game-locale", value: "kor", url: BASE },
  ]);
  const page = context.pages()[0] ?? await context.newPage();
  page.setDefaultTimeout(40000);

  try {
    await page.goto(`${BASE}/history-course`, { waitUntil: "domcontentloaded" });
    await waitGone(page, "런을 불러오는 중...");
    await page.locator(".toybox-video-lockup").first().waitFor({ timeout: 25000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      for (const article of document.querySelectorAll("article.toybox-video-lockup")) {
        const random = article.querySelector(".random-pick-glow")
          || /무작위/.test(article.textContent ?? "");
        if (random) article.closest("li")?.remove();
      }
    });
    const lockups = page.locator("article.toybox-video-lockup");
    await page.waitForFunction(() => {
      const cards = [...document.querySelectorAll("article.toybox-video-lockup")]
        .filter((el) => !el.querySelector(".random-pick-glow"));
      return cards.length >= 6;
    }, { timeout: 20000 }).catch(() => {});
    const count = await lockups.count();
    console.log("run lockups after hiding random", count);
    if (count < 6) {
      throw new Error(`need 6 run cards for 3x2, got ${count}`);
    }
    const firstSix = [];
    for (let i = 0; i < 6; i += 1) {
      const card = lockups.nth(i);
      await card.scrollIntoViewIfNeeded();
      firstSix.push(await card.boundingBox());
    }
    await shotClip(page, firstSix, `${OUT}history-course-index.png`, 12);

    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
    const hero = page.locator("[data-profile-hero]");
    await hero.waitFor();
    await page.locator("[data-profile-render]").waitFor();
    await page.waitForTimeout(1200);
    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem("sts-user-profile");
      return raw ? JSON.parse(raw) : null;
    });
    console.log("stored profile", stored);
    await shot(hero, `${OUT}profile-boss-token.png`);

    await page.goto(`${BASE}/dev/character-palette`, { waitUntil: "networkidle" });
    await page.locator("[data-dev-character-palette]").waitFor();
    await page.waitForTimeout(800);
    const kind = stored?.avatarKind === "boss" ? "boss" : "character";
    const subjectId = stored?.avatarId ?? stored?.characterId ?? "NECROBINDER";
    await page.locator(`[data-palette-kind-tab="${kind}"]`).click({ force: true });
    await page.waitForFunction(
      (nextKind) => document.querySelector("[data-dev-character-palette]")?.getAttribute("data-palette-kind") === nextKind,
      kind,
    );
    const subject = page.locator(`[data-palette-subject-id="${subjectId}"]`);
    await subject.scrollIntoViewIfNeeded();
    await subject.click({ force: true });
    if (stored?.paletteId) {
      await page.locator(`[data-palette-id="${stored.paletteId}"]`).click({ force: true });
      if (stored.paletteSwapped) {
        await page.getByRole("button", { name: "색 스왑" }).click({ force: true });
      }
    }
    await page.waitForTimeout(400);
    const commentSurface = page.locator('[data-nickname-surface="comment"]');
    const postSurface = page.locator('[data-nickname-surface="chemical-card"]');
    await commentSurface.scrollIntoViewIfNeeded();
    await shotClip(page, [
      await commentSurface.boundingBox(),
      await postSurface.boundingBox(),
    ], `${OUT}profile-nickname-surfaces.png`, 16);
  } finally {
    await context.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
