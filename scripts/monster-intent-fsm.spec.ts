import { expect, test, type Locator } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

test.use({ locale: "ko-KR" });

const CASES = [
  { id: "GAS_BOMB", slug: "gas_bomb", nodeCount: 1, edgeCount: 2, hasEnd: true },
  { id: "AEONGLASS", slug: "aeonglass", nodeCount: 3, edgeCount: 4, hasEnd: false },
  { id: "SOUL_NEXUS", slug: "soul_nexus", nodeCount: 3, edgeCount: 2, hasEnd: false },
  { id: "FABRICATOR", slug: "fabricator", nodeCount: 3, edgeCount: 2, hasEnd: false },
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
    await expect(diagram.locator('[data-pattern-entry="start"]')).toBeVisible();
    await expect(diagram.locator('[data-pattern-entry="end"]')).toHaveCount(sample.hasEnd ? 1 : 0);

    const nodes = diagram.locator('[data-pattern-node="true"]');
    await expect(nodes).toHaveCount(sample.nodeCount);
    await expect(diagram.locator("svg path")).toHaveCount(sample.edgeCount);
    await expectNoNodeOverlap(nodes);

    await diagram.screenshot({ path: `test-results/monster-intent-fsm-${sample.slug}.png` });
  });
}
