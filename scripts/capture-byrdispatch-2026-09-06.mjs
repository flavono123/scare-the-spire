import { cpSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../public/images/byrdispatch/2026-09-06/", import.meta.url).pathname;
const POST_ID = "5bfe139a-98af-4cc2-ba6e-1ef1a4bbff65";
const POST_TITLE = "사일이 강하다구요?";
const RUN_ID = "174nxe7x9zfpgm1t";
const RUN_TITLE = "검슝 쳐내기";
const BOSS_ID = "QUEEN_BOSS";
const PALETTE_ID = "orange-teal";
const PROFILE = {
  nickname: "네바",
  nicknameLocked: false,
  characterId: "NECROBINDER",
  avatarKind: "boss",
  avatarId: BOSS_ID,
  paletteId: PALETTE_ID,
  paletteSwapped: false,
  petId: "OSTY",
  petSkinId: null,
  ancientId: "OROBAS",
};

function chromeLocalStorageSrc() {
  return path.join(
    os.homedir(),
    "Library/Application Support/Google/Chrome/Default/Local Storage",
  );
}

function copyChromeProfile() {
  const dest = path.join(os.tmpdir(), "sts-byrdispatch-2026-09-06-profile");
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(path.join(dest, "Default"), { recursive: true });
  cpSync(chromeLocalStorageSrc(), path.join(dest, "Default/Local Storage"), {
    recursive: true,
    filter: (src) => !src.endsWith("LOCK"),
  });
  return dest;
}

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

async function shotVisible(page, locator, filePath, maxHeight = 860) {
  await locator.waitFor({ state: "visible", timeout: 30000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`empty box for ${filePath}`);
  const viewport = page.viewportSize() ?? { width: 1440, height: 1200 };
  const clip = {
    x: Math.max(0, box.x),
    y: Math.max(0, box.y),
    width: Math.min(box.width, viewport.width - Math.max(0, box.x)),
    height: Math.min(box.height, maxHeight, viewport.height - Math.max(0, box.y)),
  };
  if (clip.width < 8 || clip.height < 8) throw new Error(`empty visible clip for ${filePath}`);
  await page.screenshot({ path: filePath, clip });
  console.log("wrote", filePath, Math.round(clip.width), "x", Math.round(clip.height));
}

async function waitGone(page, text, timeout = 25000) {
  await page.getByText(text).waitFor({ state: "hidden", timeout }).catch(() => {});
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const userDataDir = copyChromeProfile();
  const browserType = chromium;
  let context;
  try {
    context = await browserType.launchPersistentContext(userDataDir, {
      channel: "chrome",
      headless: true,
      viewport: { width: 1440, height: 1200 },
      locale: "ko-KR",
    });
  } catch (error) {
    console.warn("chrome persistent context failed, falling back", error.message);
    const browser = await browserType.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      locale: "ko-KR",
    });
  }

  await context.addCookies([
    { name: "sts-service-locale", value: "ko", url: BASE },
    { name: "sts-game-locale", value: "kor", url: BASE },
  ]);
  await context.addInitScript((profile) => {
    window.localStorage.setItem("sts-user-profile", JSON.stringify(profile));
  }, PROFILE);

  const page = context.pages()[0] ?? await context.newPage();
  page.setDefaultTimeout(30000);
  const results = {};

  try {
    await page.goto(`${BASE}/pagestorm/${POST_ID}`, { waitUntil: "domcontentloaded" });
    await waitGone(page, "서류를 불러오는 중...");
    const detail = page.locator('[data-pagestorm-page="detail"]');
    await detail.waitFor();
    const heading = page.getByRole("heading", { name: POST_TITLE });
    await heading.waitFor({ timeout: 25000 });
    await page.waitForTimeout(500);
    const detailShell = detail.locator(".max-w-6xl").first();
    await shotVisible(page, detailShell, `${OUT}pagestorm-silent-strong-detail.png`, 900);
    results.pagestormDetail = true;

    const edit = page.getByRole("button", { name: "수정" });
    if (await edit.isVisible().catch(() => false)) {
      await edit.click();
      const toolbar = page.locator("[data-pagestorm-sticky-toolbar]");
      await toolbar.waitFor({ timeout: 15000 });
      await page.waitForTimeout(400);
      const titleInput = page.locator(`input[value="${POST_TITLE}"]`).first();
      await shotClip(page, [
        await titleInput.boundingBox().catch(() => null),
        await heading.boundingBox().catch(() => null),
        await toolbar.boundingBox(),
      ], `${OUT}pagestorm-silent-strong-editor.png`);
      results.pagestormEditor = true;
    } else {
      console.log("skip pagestorm editor: 수정 not visible");
    }

    await page.goto(`${BASE}/history-course`, { waitUntil: "domcontentloaded" });
    await waitGone(page, "런을 불러오는 중...");
    const lockup = page.locator(".toybox-video-lockup").first();
    await lockup.waitFor({ timeout: 25000 });
    await page.getByText(RUN_TITLE, { exact: false }).first().waitFor({ timeout: 25000 });
    const indexSection = page.locator("section").filter({ has: page.locator(".toybox-video-lockup") }).first();
    await page.waitForTimeout(400);
    await shot(indexSection, `${OUT}history-course-index.png`);
    results.historyIndex = true;

    await page.goto(`${BASE}/history-course/${RUN_ID}`, { waitUntil: "domcontentloaded" });
    await waitGone(page, "런을 불러오는 중…");
    const comments = page.locator("[data-history-course-comments]");
    await comments.waitFor({ timeout: 40000 });
    await page.getByText("해본다").first().waitFor({ timeout: 20000 });
    await comments.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const editor = comments.locator(".ProseMirror").first();
    await editor.click();
    await page.keyboard.type("#");
    const floorPopup = page.locator('[data-rich-editor-suggestion-popup="history-floor"]');
    await floorPopup.waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);
    await shotClip(page, [
      await comments.boundingBox(),
      await floorPopup.boundingBox(),
    ], `${OUT}history-course-floor-comments.png`, 12);
    results.historyComments = true;

    await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
    const hero = page.locator("[data-profile-hero]");
    await hero.waitFor();
    await page.locator(`[data-profile-choice-type="boss"][data-profile-choice-id="${BOSS_ID}"]`).waitFor();
    const render = page.locator("[data-profile-render]");
    await render.waitFor();
    await page.waitForTimeout(1200);
    await shot(hero, `${OUT}profile-boss-token.png`);
    results.profile = true;

    await page.goto(`${BASE}/dev/character-palette`, { waitUntil: "networkidle" });
    await page.locator("[data-dev-character-palette]").waitFor();
    await page.waitForTimeout(800);
    await page.locator('[data-palette-kind-tab="boss"]').click({ force: true });
    await page.waitForFunction(
      () => document.querySelector("[data-dev-character-palette]")?.getAttribute("data-palette-kind") === "boss",
    );
    await page.locator(`[data-palette-subject-id="${BOSS_ID}"]`).click({ force: true });
    await page.locator(`[data-palette-id="${PALETTE_ID}"]`).click({ force: true });
    await page.waitForTimeout(400);
    const commentSurface = page.locator('[data-nickname-surface="comment"]');
    const postSurface = page.locator('[data-nickname-surface="chemical-card"]');
    await commentSurface.waitFor();
    await postSurface.waitFor();
    await commentSurface.scrollIntoViewIfNeeded();
    await shotClip(page, [
      await commentSurface.boundingBox(),
      await postSurface.boundingBox(),
    ], `${OUT}profile-nickname-surfaces.png`, 16);
    results.nicknameSurfaces = true;
  } finally {
    await context.close();
  }

  console.log(JSON.stringify(results));
  const required = [
    "pagestormDetail",
    "pagestormEditor",
    "historyIndex",
    "historyComments",
    "profile",
    "nicknameSurfaces",
  ];
  const missing = required.filter((key) => !results[key]);
  if (missing.length) {
    throw new Error(`missing required captures: ${missing.join(", ")}`);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
