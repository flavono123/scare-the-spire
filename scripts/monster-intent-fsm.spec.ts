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
    edgeCount: 2,
    edgeLabelCount: 0,
    chanceLabelCount: 0,
    conditionalEdgeCount: 0,
    phaseCount: 0,
    phaseConnectorCount: 0,
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
    edgeCount: 4,
    edgeLabelCount: 0,
    chanceLabelCount: 0,
    conditionalEdgeCount: 0,
    phaseCount: 0,
    phaseConnectorCount: 0,
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
    edgeCount: 7,
    edgeLabelCount: 6,
    chanceLabelCount: 0,
    conditionalEdgeCount: 0,
    phaseCount: 0,
    phaseConnectorCount: 0,
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
    edgeCount: 9,
    edgeLabelCount: 2,
    chanceLabelCount: 6,
    conditionalEdgeCount: 2,
    phaseCount: 2,
    phaseConnectorCount: 0,
    hasEnd: false,
  },
  {
    id: "TEST_SUBJECT",
    slug: "test_subject",
    monsterNameKo: "실험체 #C{Count}",
    monsterNameEn: "Test Subject #C{Count}",
    moveNames: [
      { ko: "물기", en: "Bite" },
      { ko: "두개골 강타", en: "Skull Bash" },
      { ko: "발톱 연타", en: "Multi-Claw" },
      { ko: "찢어발기기", en: "Lacerate" },
      { ko: "거센 덮치기", en: "Big Pounce" },
      { ko: "타오르는 포효", en: "Burning Growl" },
    ],
    nodeCount: 6,
    edgeCount: 7,
    edgeLabelCount: 0,
    chanceLabelCount: 0,
    conditionalEdgeCount: 0,
    phaseCount: 3,
    phaseConnectorCount: 2,
    hasEnd: false,
  },
  {
    id: "CORPSE_SLUG",
    slug: "corpse_slug",
    monsterNameKo: "시체 민달팽이",
    monsterNameEn: "Corpse Slug",
    moveNames: [
      { ko: "휘둘러 치기", en: "Whip Slap" },
      { ko: "안기기", en: "Glomp" },
      { ko: "들러붙기", en: "Goop" },
    ],
    nodeCount: 3,
    edgeCount: 6,
    edgeLabelCount: 3,
    chanceLabelCount: 0,
    conditionalEdgeCount: 3,
    phaseCount: 0,
    phaseConnectorCount: 0,
    hasEnd: false,
  },
  {
    id: "DECIMILLIPEDE_SEGMENT",
    slug: "decimillipede_segment",
    monsterNameKo: "만각지네",
    monsterNameEn: "Decimillipede",
    moveNames: [
      { ko: "몸부림", en: "Writhe" },
      { ko: "수축", en: "Constrict" },
      { ko: "커지기", en: "Bulk" },
      { ko: "죽음", en: "Dead" },
      { ko: "재연결", en: "Reattach" },
    ],
    nodeCount: 5,
    edgeCount: 13,
    edgeLabelCount: 9,
    chanceLabelCount: 0,
    conditionalEdgeCount: 6,
    phaseCount: 0,
    phaseConnectorCount: 0,
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
    await expect(diagram.locator('[data-pattern-entry="start"]')).toHaveCount(1);
    await expect(diagram.locator('[data-pattern-entry="end"]')).toHaveCount(sample.hasEnd ? 1 : 0);
    await expect(diagram.locator("[data-pattern-phase]")).toHaveCount(sample.phaseCount);
    await expect(diagram.locator("[data-pattern-phase-connector]")).toHaveCount(sample.phaseConnectorCount);

    const nodes = diagram.locator('[data-pattern-node="true"]');
    await expect(nodes).toHaveCount(sample.nodeCount);
    await expect(diagram.locator("[data-pattern-branch-node]")).toHaveCount(0);
    const edges = diagram.locator("svg > path[data-pattern-edge-from]");
    await expect(edges).toHaveCount(sample.edgeCount);
    await expect(diagram.locator("[data-pattern-edge-label]")).toHaveCount(sample.edgeLabelCount);
    await expect(diagram.locator("[data-pattern-edge-chance-label]")).toHaveCount(sample.chanceLabelCount);
    await expect(diagram.getByText("100%", { exact: true })).toHaveCount(0);
    const edgeStyles = await edges.evaluateAll((elements) => elements.map((element) => ({
      stroke: element.getAttribute("stroke"),
      markerEnd: element.getAttribute("marker-end"),
      path: element.getAttribute("d"),
    })));
    expect(edgeStyles.every((style) => style.stroke === "#efc851" || style.stroke === "#ff4545")).toBe(true);
    expect(edgeStyles.filter((style) => style.stroke === "#ff4545")).toHaveLength(sample.conditionalEdgeCount);
    expect(edgeStyles.every((style) => (
      style.stroke === "#ff4545"
        ? style.markerEnd?.includes("arrow-conditional")
        : style.markerEnd?.includes("arrow-normal")
    ))).toBe(true);
    expect(edgeStyles.every((style) => style.path?.includes(" C "))).toBe(true);
    expect(edgeStyles.every((style) => !/[HV]/.test(style.path ?? ""))).toBe(true);
    await expect(diagram.locator('marker[id$="-arrow-normal"] path')).toHaveAttribute("fill", "#efc851");
    await expect(diagram.locator('marker[id$="-arrow-conditional"] path')).toHaveAttribute("fill", "#ff4545");
    await expectNoNodeOverlap(diagram.locator('[data-pattern-node="true"]'));
    for (const moveName of sample.moveNames) {
      await expect(diagram.getByText(moveName.ko, { exact: true })).toBeVisible();
      await expect(diagram.getByText(moveName.en, { exact: true })).toBeVisible();
    }
    if (sample.id === "SOUL_NEXUS") {
      const transitions = await edges.evaluateAll((elements) => elements.map((element) => ({
        from: element.getAttribute("data-pattern-edge-from"),
        to: element.getAttribute("data-pattern-edge-to"),
        path: element.getAttribute("d"),
      })));
      expect(transitions.filter((edge) => edge.from !== "__START__").every((edge) => edge.from !== edge.to)).toBe(true);
      expectEveryBranchToShareItsOrigin(transitions.filter((edge) => edge.from !== "__START__"));
      await expect(diagram.getByText("50%", { exact: true })).toHaveCount(6);
    }
    if (sample.id === "FABRICATOR") {
      const transitions = await edges.evaluateAll((elements) => elements.map((element) => ({
        from: element.getAttribute("data-pattern-edge-from"),
        to: element.getAttribute("data-pattern-edge-to"),
        path: element.getAttribute("d"),
      })));
      expectEveryBranchToShareItsOrigin(transitions.filter((edge) => edge.from === "__START__"));
      expect(transitions.filter((edge) => edge.from === "__START__")).toHaveLength(2);
      expect(transitions.filter((edge) => edge.from === edge.to)).toHaveLength(3);
      expect(transitions.filter((edge) => edge.from?.startsWith("__PHASE_") && edge.to?.startsWith("__PHASE_"))).toHaveLength(2);
      await expect(diagram.locator('[data-pattern-edge-label]', { hasText: "제작 가능" })).toHaveCount(1);
      await expect(diagram.getByText("50%", { exact: true })).toHaveCount(6);
      await expect(diagram.locator('[data-pattern-edge-label]', { hasText: "제작 불가" })).toHaveCount(1);
      await expect(diagram.getByText("제작 가능?", { exact: true })).toHaveCount(0);
      await expect(diagram.getByText("무작위", { exact: true })).toHaveCount(0);
      await expect(diagram.locator('[data-pattern-edge-label][title*="살아 있는 적이 4명 미만"]')).toHaveCount(1);
      await expect(diagram.locator('[data-pattern-edge-label][title*="살아 있는 적이 4명 이상"]')).toHaveCount(1);

      const phaseRects = await diagram.locator("[data-pattern-phase]").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { id: element.getAttribute("data-pattern-phase"), top: rect.top, centerX: rect.left + rect.width / 2 };
      }));
      const canPhase = phaseRects.find((phase) => phase.id === "can");
      const cannotPhase = phaseRects.find((phase) => phase.id === "cannot");
      expect(canPhase).toBeDefined();
      expect(cannotPhase).toBeDefined();
      expect(canPhase!.top).toBeLessThan(cannotPhase!.top);
      expect(Math.abs(canPhase!.centerX - cannotPhase!.centerX)).toBeLessThanOrEqual(1);
    }
    if (sample.id === "CORPSE_SLUG" || sample.id === "DECIMILLIPEDE_SEGMENT") {
      const startTransitions = await edges.evaluateAll((elements) => elements
        .filter((element) => element.getAttribute("data-pattern-edge-from") === "__START__")
        .map((element) => ({
          from: element.getAttribute("data-pattern-edge-from"),
          path: element.getAttribute("d"),
        })));
      expectEveryBranchToShareItsOrigin(startTransitions);
      await expect(diagram.getByText("시작 순서 1", { exact: true })).toHaveCount(1);
      await expect(diagram.getByText("시작 순서 2", { exact: true })).toHaveCount(1);
      await expect(diagram.getByText("시작 순서 3", { exact: true })).toHaveCount(1);
    }
    if (sample.id === "TEST_SUBJECT") {
      const phaseRects = await diagram.locator("[data-pattern-phase]").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }));
      expect(phaseRects).toHaveLength(3);
      expect(phaseRects[0].right).toBeLessThan(phaseRects[1].left);
      expect(phaseRects[1].right).toBeLessThan(phaseRects[2].left);
      await expect(diagram.getByText("체력 0 → 부활", { exact: true })).toHaveCount(2);

      const phaseThreeOrder = await Promise.all([
        diagram.getByRole("button", { name: "찢어발기기 / Lacerate" }).boundingBox(),
        diagram.getByRole("button", { name: "거센 덮치기 / Big Pounce" }).boundingBox(),
        diagram.getByRole("button", { name: "타오르는 포효 / Burning Growl" }).boundingBox(),
      ]);
      expect(phaseThreeOrder.every(Boolean)).toBe(true);
      expect(phaseThreeOrder[0]!.y).toBeLessThan(phaseThreeOrder[1]!.y);
      expect(phaseThreeOrder[1]!.y).toBeLessThan(phaseThreeOrder[2]!.y);

      const phaseConnectorPaths = await diagram.locator("[data-pattern-phase-connector]").evaluateAll((elements) => (
        elements.map((element) => element.getAttribute("d"))
      ));
      expect(phaseConnectorPaths.every((path) => path?.includes(" C "))).toBe(true);
      expect(phaseConnectorPaths.every((path) => !/[HV]/.test(path ?? ""))).toBe(true);
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

      if (sample.id === "FABRICATOR" || sample.id === "TEST_SUBJECT") {
        await diagram.screenshot({
          path: `test-results/monster-intent-fsm-mobile-${sample.slug}-${preset.name}.png`,
        });
      }
      if (sample.id === "FABRICATOR") {
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

function expectEveryBranchToShareItsOrigin(
  transitions: Array<{ from: string | null; path: string | null }>,
) {
  const originsBySource = new Map<string, Set<string>>();
  transitions.forEach((transition) => {
    if (!transition.from || !transition.path) return;
    const origin = transition.path.match(/^M\s+(-?[\d.]+)\s+(-?[\d.]+)/)?.slice(1).join(",");
    if (!origin) return;
    const origins = originsBySource.get(transition.from) ?? new Set<string>();
    origins.add(origin);
    originsBySource.set(transition.from, origins);
  });

  originsBySource.forEach((origins) => expect(origins.size).toBe(1));
}
