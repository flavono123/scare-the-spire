/**
 * Visual regression checks for scare-the-spire.
 *
 * Run:  pnpm exec playwright test scripts/visual-check.spec.ts
 *
 * Checks:
 *  1. Font: body uses game fonts (gc-batang for Korean, Kreon for Latin)
 *  2. Patch h4: #### headings render as <h4>, not raw text
 *  3. Patch i18n: game terms use official Korean translations
 *  4. Page renders: key pages load without errors
 */

import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// 1. Font application
// ---------------------------------------------------------------------------

test.describe("Font", () => {
  test("body uses game font (gc-batang), not system default", async ({ page }) => {
    await page.goto(BASE);
    const fontFamily = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily,
    );
    // gc-batang is loaded via Next.js localFont with a generated class name.
    // The computed value should NOT contain the Tailwind default fallback.
    expect(fontFamily).not.toContain("ui-sans-serif");
    expect(fontFamily).not.toContain("system-ui");
    // Should contain serif (our stack ends with serif)
    expect(fontFamily.toLowerCase()).toContain("serif");
  });

  test("patch page text uses game font", async ({ page }) => {
    await page.goto(`${BASE}/patches/0.101.0`);
    await page.waitForSelector("h2");
    const fontFamily = await page.evaluate(() => {
      const h2 = document.querySelector("h2");
      return h2 ? getComputedStyle(h2).fontFamily : "";
    });
    expect(fontFamily).not.toContain("ui-sans-serif");
  });

  test("codex page uses game font", async ({ page }) => {
    await page.goto(`${BASE}/codex`);
    await page.waitForSelector("body");
    const fontFamily = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily,
    );
    expect(fontFamily).not.toContain("ui-sans-serif");
  });
});

// ---------------------------------------------------------------------------
// 2. Patch note heading rendering
// ---------------------------------------------------------------------------

test.describe("Patch headings", () => {
  test("h4 (####) renders as <h4> element, not raw text", async ({ page }) => {
    await page.goto(`${BASE}/patches/0.101.0`);
    // The patch has #### headings for character names (Silent, Necrobinder, Regent)
    const h4s = await page.locator("h4").count();
    expect(h4s).toBeGreaterThanOrEqual(3);
  });

  test("no raw #### visible in rendered content", async ({ page }) => {
    await page.goto(`${BASE}/patches/0.101.0`);
    // Check only visible article/main content, not RSC payloads in script tags
    const mainText = await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.querySelector("[class*='max-w']") ?? document.body;
      // Get only visible text nodes, excluding script/style elements
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let text = "";
      while (walker.nextNode()) text += walker.currentNode.textContent;
      return text;
    });
    expect(mainText).not.toContain("####");
  });

  test("h2 and h3 headings still render correctly", async ({ page }) => {
    await page.goto(`${BASE}/patches/0.101.0`);
    const h2s = await page.locator("h2").count();
    const h3s = await page.locator("h3").count();
    expect(h2s).toBeGreaterThanOrEqual(2);
    expect(h3s).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Game i18n correctness
// ---------------------------------------------------------------------------

test.describe("Game i18n", () => {
  test("Gloom ascension uses official translation 비관", async ({ page }) => {
    await page.goto(`${BASE}/patches/0.101.0`);
    const bodyText = await page.locator("body").textContent();
    // Should use official game translation
    expect(bodyText).toContain("비관");
    // Should NOT use arbitrary translation
    expect(bodyText).not.toContain("음침함");
  });

  test("uses 승천 not 어센션 for ascension", async ({ page }) => {
    await page.goto(`${BASE}/patches/0.101.0`);
    // Use main content area to avoid RSC payload noise
    const text = await page.evaluate(() => {
      const el = document.querySelector("section") ?? document.querySelector("article") ?? document.body;
      return el.innerText;
    });
    expect(text).toContain("승천");
    expect(text).not.toContain("어센션");
  });

  test("uses 휴식 장소 not 휴식지 for Rest Sites", async ({ page }) => {
    await page.goto(`${BASE}/patches/0.101.0`);
    const text = await page.evaluate(() => {
      const el = document.querySelector("section") ?? document.querySelector("article") ?? document.body;
      return el.innerText;
    });
    expect(text).toContain("휴식 장소");
    expect(text).not.toContain("휴식지");
  });
});

// ---------------------------------------------------------------------------
// 4. Page renders (smoke tests)
// ---------------------------------------------------------------------------

test.describe("Page smoke tests", () => {
  const pages = [
    { path: "/", name: "Home" },
    { path: "/patches", name: "Patch index" },
    { path: "/patches/0.101.0", name: "Patch v0.101.0" },
    { path: "/codex", name: "Codex hub" },
    { path: "/codex/cards", name: "Card library" },
    { path: "/codex/relics", name: "Relic library" },
    { path: "/codex/potions", name: "Potion library" },
    { path: "/dev/reference", name: "Dev reference" },
  ];

  for (const { path, name } of pages) {
    test(`${name} (${path}) loads with HTTP 2xx`, async ({ page }) => {
      const res = await page.goto(`${BASE}${path}`);
      expect(res?.status()).toBeLessThan(400);
    });
  }
});
