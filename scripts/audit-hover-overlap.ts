/**
 * Hover tips must never overlap what they explain. Opens pages in Chromium at 1440x900 and, by painted
 * bounds (an element plus every descendant drawn outside it):
 * - checks each always-on side tip stack against the card it belongs to,
 * - hovers every [data-hover-trigger] / [data-static-card-trigger] and checks each tip that appears against
 *   its trigger, and the tips of one stack against each other.
 *
 *   pnpm hover:audit [--base http://localhost:3005] [--pages cards,relics,potions,powers,enchantments,keywords,patches] [--limit N]
 *
 * Writes test-results/hover-overlap.json. Needs a running dev or built server; not part of any deploy.
 */
import fs from "node:fs";
import { chromium, type Page } from "@playwright/test";

const arg = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const base = arg("base", "http://localhost:3005");
const kinds = arg("pages", "cards,relics,potions,powers,enchantments,keywords,patches").split(",");
const limit = Number(arg("limit", "0"));
const workers = Number(arg("workers", "3"));

const ids = (file: string) => (JSON.parse(fs.readFileSync(`data/sts2/kor/${file}.json`, "utf-8")) as { id: string }[]).map((e) => e.id.toLowerCase());
const pagesFor: Record<string, () => string[]> = {
  cards: () => ids("cards").map((id) => `/compendium/cards/${id}`),
  relics: () => ids("relics").map((id) => `/compendium/relics/${id}`),
  potions: () => ids("potions").map((id) => `/compendium/potions/${id}`),
  powers: () => ids("powers").map((id) => `/compendium/powers/${id}`),
  enchantments: () => ids("enchantments").map((id) => `/compendium/enchantments/${id}`),
  keywords: () => (JSON.parse(fs.readFileSync("data/sts2/game-tips.json", "utf-8")) as { keywords: string[] }).keywords.map((id) => `/compendium/keywords/${id.toLowerCase()}`),
  patches: () => (JSON.parse(fs.readFileSync("data/sts2-patches.json", "utf-8")) as { version: string }[]).map((p) => `/patches/${p.version}`),
};

type Violation = { page: string; trigger: string; tip: string; overlap: string };
const stats = { hovers: 0, tipsSeen: 0, alwaysOn: 0 };

/** Runs in the page: painted bounds, visible tip layers, and hover checks. */
const PAGE_HELPERS = `
window.__drawn = (el) => { let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;
  for (const e of [el, ...el.querySelectorAll('*')]) { const x=e.getBoundingClientRect(); if (!x.width||!x.height) continue;
    l=Math.min(l,x.left); t=Math.min(t,x.top); r=Math.max(r,x.right); b=Math.max(b,x.bottom); }
  return l===Infinity ? null : {l,t,r,b}; };
window.__overlap = (a, b) => { const w=Math.min(a.r,b.r)-Math.max(a.l,b.l), h=Math.min(a.b,b.b)-Math.max(a.t,b.t); return w>0.5&&h>0.5 ? Math.round(w)+'x'+Math.round(h) : null; };
window.__layers = () => [...document.querySelectorAll('[data-hover-tip-layer],[data-card-side-tips],[data-static-card-preview]')]
  .filter((e) => !e.hidden && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none' && window.__drawn(e));
window.__stackOverlaps = (layer) => { const items=[...(layer.querySelector('.flex.flex-col')?.children ?? [])].map(window.__drawn).filter(Boolean); const out=[];
  for (let i=0;i<items.length;i++) for (let j=i+1;j<items.length;j++) { const o=window.__overlap(items[i],items[j]); if (o) out.push('tips '+i+'/'+j+' '+o); } return out; };
`;

async function auditPage(page: Page, path: string): Promise<Violation[]> {
  const out: Violation[] = [];
  await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 120_000 });
  // Some pages replace their URL after hydration; let that settle before measuring.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1200);

  // Always-on side tips (card detail): against every card on the page and within their own stack.
  const always = await page.evaluate(() => {
    const w = window as unknown as Record<string, (...a: unknown[]) => unknown>;
    const cards = [...document.querySelectorAll("[data-hover-trigger]")].filter((e) => e.querySelector(".group img"));
    return (w.__layers() as Element[]).flatMap((layer) => {
      const tip = w.__drawn(layer);
      return [
        ...cards.map((card) => w.__overlap(tip, w.__drawn(card))).filter(Boolean).map((o) => `side tips over card ${o}`),
        ...(w.__stackOverlaps(layer) as string[]),
      ];
    });
  });
  for (const overlap of always) out.push({ page: path, trigger: "(always-on)", tip: "side tips", overlap });
  stats.alwaysOn += await page.evaluate(() => ((window as unknown as Record<string, () => Element[]>).__layers()).length);

  const before = await page.evaluate(() => ((window as unknown as Record<string, () => Element[]>).__layers()).length);
  const count = await page.locator("[data-hover-trigger],[data-static-card-trigger]").count();
  for (let i = 0; i < count; i += 1) {
    const trigger = page.locator("[data-hover-trigger],[data-static-card-trigger]").nth(i);
    if (!(await trigger.isVisible().catch(() => false))) continue;
    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    const box = await trigger.boundingBox();
    if (!box) continue;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    stats.hovers += 1;
    stats.tipsSeen += await page.evaluate((skip) => Math.max(0, ((window as unknown as Record<string, () => Element[]>).__layers()).length - skip), before);
    const found = await trigger.evaluate((el, skip) => {
      const w = window as unknown as Record<string, (...a: unknown[]) => unknown>;
      const own = w.__drawn(el);
      return (w.__layers() as Element[]).slice(skip as number).flatMap((layer) => {
        const tip = w.__drawn(layer);
        const name = (layer.textContent ?? "").trim().slice(0, 40);
        return [
          ...(own ? [w.__overlap(tip, own)].filter(Boolean).map((o) => ({ name, overlap: `tip over trigger ${o}` })) : []),
          ...(w.__stackOverlaps(layer) as string[]).map((o) => ({ name, overlap: o })),
        ];
      }).map((v) => ({ ...v, trigger: (el.textContent ?? "").trim().slice(0, 30) }));
    }, before);
    for (const v of found) out.push({ page: path, trigger: v.trigger, tip: v.name, overlap: v.overlap });
    await page.mouse.move(2, 2);
    await page.waitForTimeout(80);
  }
  return out;
}

async function main() {
  let paths = kinds.flatMap((kind) => pagesFor[kind]?.() ?? []);
  if (limit) paths = paths.slice(0, limit);
  const browser = await chromium.launch();
  const violations: Violation[] = [];
  const failed: string[] = [];
  let done = 0;
  const queue = [...paths];
  await Promise.all(Array.from({ length: workers }, async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript({ content: PAGE_HELPERS });
    for (let path = queue.shift(); path; path = queue.shift()) {
      try {
        violations.push(...(await auditPage(page, path).catch(() => auditPage(page, path))));
      } catch (error) {
        failed.push(`${path}: ${(error as Error).message.split("\n")[0]}`);
      }
      done += 1;
      if (done % 50 === 0) console.log(`${done}/${paths.length} pages, ${violations.length} overlaps`);
    }
  }));
  await browser.close();
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync("test-results/hover-overlap.json", JSON.stringify({ base, pages: paths.length, ...stats, failed, violations }, null, 2));
  for (const v of violations.slice(0, 40)) console.log(`${v.page} | ${v.trigger} | ${v.tip} | ${v.overlap}`);
  console.log(`hover overlap audit: ${paths.length} pages, ${stats.hovers} hovers, ${stats.tipsSeen} tips shown, ${stats.alwaysOn} always-on stacks, ${violations.length} overlaps, ${failed.length} pages failed`);
  if (violations.length || failed.length) process.exitCode = 1;
}

main();
