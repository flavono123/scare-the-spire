import { expect, test, type Locator } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

test.use({ locale: "ko-KR" });

const CASES = [
  {
    id: "GAS_BOMB",
    slug: "gas_bomb",
    monsterNameKo: "가스 폭탄",
    monsterNameEn: "Gas Bomb",
    moveNames: [{ ko: "폭발", en: "Explode" }],
    nodeCount: 1,
    branchNodeCount: 0,
    edgeCount: 2,
    hasEnd: true,
  },
  {
    id: "AEONGLASS",
    slug: "aeonglass",
    monsterNameKo: "영겁의 모래시계",
    monsterNameEn: "Aeonglass",
    moveNames: [
      { ko: "감쇠", en: "Ebb" },
      { ko: "눈 레이저", en: "Eye Lasers" },
      { ko: "강도 증가", en: "Increasing Intensity" },
    ],
    nodeCount: 3,
    branchNodeCount: 0,
    edgeCount: 4,
    hasEnd: false,
  },
  {
    id: "SOUL_NEXUS",
    slug: "soul_nexus",
    monsterNameKo: "영혼 결합체",
    monsterNameEn: "Soul Nexus",
    moveNames: [
      { ko: "영혼 연소", en: "Soul Burn" },
      { ko: "대재앙", en: "Maelstrom" },
      { ko: "생명 흡수", en: "Drain Life" },
    ],
    nodeCount: 3,
    branchNodeCount: 0,
    edgeCount: 7,
    hasEnd: false,
  },
  {
    id: "FABRICATOR",
    slug: "fabricator",
    monsterNameKo: "조립 전문가",
    monsterNameEn: "Fabricator",
    moveNames: [
      { ko: "조립", en: "Fabricate" },
      { ko: "조립 타격", en: "Fabricating Strike" },
      { ko: "해체", en: "Disintegrate" },
    ],
    nodeCount: 3,
    branchNodeCount: 2,
    edgeCount: 8,
    hasEnd: false,
  },
] as const;

const MOBILE_PRESETS = [
  { name: "iphone-13-mini", width: 375, height: 812, dpr: 3 },
  { name: "iphone-mainstream", width: 390, height: 844, dpr: 3 },
  { name: "iphone-pro-max", width: 430, height: 932, dpr: 3 },
  { name: "android-compact", width: 360, height: 800, dpr: 3 },
  { name: "pixel-mainstream", width: 412, height: 915, dpr: 2.625 },
  { name: "android-large", width: 432, height: 960, dpr: 3 },
  { name: "android-xl", width: 480, height: 1040, dpr: 2.75 },
] as const;

async function expectNoNodeOverlap(nodes: Locator) {
  const boxes = await nodes.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));

  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const left = boxes[leftIndex];
      const right = boxes[rightIndex];
      const overlapWidth = Math.min(left.right, right.right) - Math.max(left.left, right.left);
      const overlapHeight = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
      expect(overlapWidth <= 0 || overlapHeight <= 0).toBe(true);
    }
  }
}

for (const sample of CASES) {
  test(`monster intent FSM — ${sample.id}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${BASE}/compendium/monsters/${sample.slug}`);

    const diagram = page.locator(`[data-monster-pattern-diagram="${sample.id}"]`);
    await expect(diagram).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: sample.monsterNameKo })).toBeVisible();
    await expect(page.getByText(sample.monsterNameEn, { exact: true }).first()).toBeVisible();
    await expect(diagram.locator('[data-pattern-entry="start"]')).toBeVisible();
    await expect(diagram.locator('[data-pattern-entry="end"]')).toHaveCount(sample.hasEnd ? 1 : 0);

    const nodes = diagram.locator('[data-pattern-node="true"]');
    await expect(nodes).toHaveCount(sample.nodeCount);
    await expect(diagram.locator("[data-pattern-branch-node]")).toHaveCount(sample.branchNodeCount);
    const edges = diagram.locator("svg > path[data-pattern-edge-from]");
    await expect(edges).toHaveCount(sample.edgeCount);
    await expect(diagram.locator("[data-pattern-edge-label]")).toHaveCount(sample.edgeCount);
    const edgeStyles = await edges.evaluateAll((elements) => elements.map((element) => ({
      stroke: element.getAttribute("stroke"),
      markerEnd: element.getAttribute("marker-end"),
    })));
    expect(edgeStyles.every((style) => style.stroke === "#efc851")).toBe(true);
    expect(edgeStyles.every((style) => style.markerEnd?.includes("arrow-normal"))).toBe(true);
    await expect(diagram.locator('marker[id$="-arrow-normal"] path')).toHaveAttribute("fill", "#efc851");
    await expectNoNodeOverlap(diagram.locator('[data-pattern-node="true"], [data-pattern-branch-node]'));
    for (const moveName of sample.moveNames) {
      await expect(diagram.getByText(moveName.ko, { exact: true })).toBeVisible();
      await expect(diagram.getByText(moveName.en, { exact: true })).toBeVisible();
    }
    if (sample.id === "SOUL_NEXUS") {
      const transitionPairs = await edges.evaluateAll((elements) => elements.map((element) => ({
        from: element.getAttribute("data-pattern-edge-from"),
        to: element.getAttribute("data-pattern-edge-to"),
      })));
      expect(transitionPairs.filter((edge) => edge.from !== "__START__").every((edge) => edge.from !== edge.to)).toBe(true);
      await expect(diagram.getByText("50%", { exact: true })).toHaveCount(6);
    }

    await diagram.screenshot({ path: `test-results/monster-intent-fsm-${sample.slug}.png` });
  });
}

test("representative monster intent FSMs — mobile viewports", async ({ browser }) => {
  test.setTimeout(180_000);

  for (const preset of MOBILE_PRESETS) {
    const context = await browser.newContext({
      locale: "ko-KR",
      viewport: { width: preset.width, height: preset.height },
      deviceScaleFactor: preset.dpr,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();

    for (const sample of CASES) {
      await page.goto(`${BASE}/compendium/monsters/${sample.slug}`);
      const diagram = page.locator(`[data-monster-pattern-diagram="${sample.id}"]`);
      await expect(diagram).toBeVisible();
      await diagram.evaluate((element) => element.scrollIntoView({ block: "center" }));

      const layout = await diagram.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const visibleWidth = Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left));
        const visibleHeight = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
        return {
          bodyWidth: document.body.scrollWidth,
          documentWidth: document.documentElement.scrollWidth,
          rectWidth: rect.width,
          rectHeight: rect.height,
          visibleWidth,
          visibleHeight,
        };
      });

      expect(layout.documentWidth).toBeLessThanOrEqual(preset.width + 2);
      expect(layout.bodyWidth).toBeLessThanOrEqual(preset.width + 2);
      expect(layout.rectWidth).toBeLessThanOrEqual(preset.width);
      expect(layout.visibleWidth).toBeGreaterThanOrEqual(Math.min(300, preset.width * 0.78));
      expect(layout.visibleHeight).toBeGreaterThanOrEqual(Math.min(240, layout.rectHeight));
      await expectNoNodeOverlap(diagram.locator('[data-pattern-node="true"]'));

      if (sample.id === "FABRICATOR") {
        await diagram.screenshot({
          path: `test-results/monster-intent-fsm-mobile-${preset.name}.png`,
        });
        const canvas = diagram.locator(":scope > div").first();
        const beforeDrag = await canvas.getAttribute("style");
        const box = await diagram.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          const y = box.y + box.height / 2;
          await page.mouse.move(box.x + box.width - 32, y);
          await page.mouse.down();
          await page.mouse.move(box.x + 40, y, { steps: 5 });
          await page.mouse.up();
        }
        await expect(canvas).not.toHaveAttribute("style", beforeDrag ?? "");
      }
    }

    await context.close();
  }
});
