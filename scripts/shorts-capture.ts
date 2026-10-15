/**
 * Capture site renders as PNG plates for the slseoun-shorts repo.
 *
 * It drives the running dev server and clicks the same image download button a
 * person would, so the PNG is the site's own html-to-image render. Device scale
 * is fixed, so every plate from one run has the same pixel ratio.
 *
 *   pnpm shorts:capture --target cards/SPLASH@0.110.0 --out ~/P/slseoun-shorts/kdenlive/stills/x/SPLASH-as-is.png
 *   pnpm shorts:capture --target cards/SPLASH@0.111.0 --out SPLASH-to-be.png --mark "1장"
 *   pnpm shorts:capture --target relics/AKABEKO --replace "8=>12" --out akabeko.png
 *   pnpm shorts:capture --url "/transfigure/abc123" --out post.png
 *   pnpm shorts:capture --batch shots.json
 *
 * A batch file is { base?, outDir?, locale?, shots: Shot[] } where each Shot has
 * `target` or `url`, `out`, and optional `mark`, `replace`, `selector`, `locale`.
 * A mark or replace phrase must occur exactly once in the description.
 * Relative paths resolve from the directory pnpm was invoked in.
 *
 * Every PNG gets a sidecar `<out>.json`: requested and final URL, version and
 * locale stamped on the rendered tile, edits, pixel ratio, image size, and the
 * painted bbox (non-transparent pixels), so an assembler can match scales.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { TEXT_GOLD, TEXT_GREEN } from "../src/lib/sts2-card-style";

const DEFAULT_BASE = process.env.SHORTS_CAPTURE_BASE_URL ?? "http://localhost:3000";
const DEVICE_SCALE = 3;
const CAPTURE_SELECTOR = "[data-card-tile], [data-relic-inspect-slab]";
const DOWNLOAD_SELECTOR = "[data-compendium-download-image]";

/** Same colors the card tile uses for its BBCode spans. */
const MARK_COLORS: Record<string, { color: string; bold: boolean }> = {
  red: { color: "#FF5555", bold: false },
  gold: { color: TEXT_GOLD, bold: true },
  green: { color: TEXT_GREEN, bold: true },
  blue: { color: "#87CEEB", bold: true },
  purple: { color: "#EE82EE", bold: true },
};

interface Mark {
  text: string;
  color?: string;
}

interface Replace {
  from: string;
  to: string;
}

interface Shot {
  target?: string;
  url?: string;
  out: string;
  locale?: "kor" | "eng";
  mark?: (string | Mark)[];
  replace?: (string | Replace)[];
  /** Node to capture when the page has no download button. */
  selector?: string;
}

interface Batch {
  base?: string;
  outDir?: string;
  locale?: "kor" | "eng";
  shots: Shot[];
}

interface EditResult {
  op: "mark" | "replace";
  text: string;
  found: boolean | "ambiguous";
}

const invokedFrom = process.env.INIT_CWD ?? process.cwd();

function resolvePath(value: string, from = invokedFrom): string {
  const expanded = value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
  return path.resolve(from, expanded);
}

/** `cards/SPLASH@0.111.0` -> `/compendium/cards/splash?version=0.111.0`. */
function targetPath(target: string, locale: "kor" | "eng"): string {
  const match = target.match(/^([a-z-]+)\/([^@]+)(?:@v?(.+))?$/);
  if (!match) throw new Error(`target must look like cards/ID@version: ${target}`);
  const [, type, id, version] = match;
  const prefix = locale === "eng" ? "/en" : "";
  const query = version ? `?version=${encodeURIComponent(version)}` : "";
  return `${prefix}/compendium/${type}/${encodeURIComponent(id.toLowerCase())}${query}`;
}

function parseReplace(value: string | Replace): Replace {
  if (typeof value !== "string") return value;
  const split = value.indexOf("=>");
  if (split < 0) throw new Error(`replace must look like "old=>new": ${value}`);
  return { from: value.slice(0, split), to: value.slice(split + 2) };
}

function parseMark(value: string | Mark): Mark {
  return typeof value === "string" ? { text: value } : value;
}

/**
 * Rewrite text inside the capture node. A phrase may cross the spans of a
 * keyword, so matching runs over the concatenated text nodes.
 */
async function applyEdits(
  page: Page,
  selector: string,
  marks: Mark[],
  replaces: Replace[],
): Promise<EditResult[]> {
  const styled = marks.map((mark) => {
    const preset = MARK_COLORS[mark.color ?? "red"];
    return { text: mark.text, color: preset?.color ?? mark.color ?? "#FF5555", bold: preset?.bold ?? false };
  });
  return page.evaluate(
    ({ selector, marks, replaces }) => {
      const root = document.querySelector<HTMLElement>(selector);
      if (!root) throw new Error(`capture node not found: ${selector}`);
      // Prefer the description so a phrase does not hit the title first.
      const scope = root.querySelector<HTMLElement>("[data-card-description-content]") ?? root;

      function locate(text: string) {
        const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        let joined = "";
        const starts: number[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          starts.push(joined.length);
          nodes.push(node as Text);
          joined += node.textContent ?? "";
        }
        const at = joined.indexOf(text);
        if (at < 0) return null;
        // A phrase that occurs twice would edit whichever comes first.
        if (joined.indexOf(text, at + 1) >= 0) return "ambiguous" as const;
        const end = at + text.length;
        const pieces: { node: Text; from: number; to: number }[] = [];
        nodes.forEach((node, i) => {
          const nodeStart = starts[i];
          const nodeEnd = nodeStart + (node.textContent?.length ?? 0);
          if (nodeEnd <= at || nodeStart >= end) return;
          pieces.push({ node, from: Math.max(at, nodeStart) - nodeStart, to: Math.min(end, nodeEnd) - nodeStart });
        });
        return pieces;
      }

      function isolate(piece: { node: Text; from: number; to: number }): Text {
        let node = piece.node;
        if (piece.from > 0) node = node.splitText(piece.from);
        if (piece.to - piece.from < (node.textContent?.length ?? 0)) node.splitText(piece.to - piece.from);
        return node;
      }

      const results: { op: "mark" | "replace"; text: string; found: boolean | "ambiguous" }[] = [];
      for (const { from, to } of replaces) {
        const pieces = locate(from);
        results.push({ op: "replace", text: from, found: pieces === "ambiguous" ? pieces : Boolean(pieces) });
        if (!pieces || pieces === "ambiguous") continue;
        pieces.map(isolate).forEach((node, i) => {
          node.textContent = i === 0 ? to : "";
        });
      }
      for (const mark of marks) {
        const pieces = locate(mark.text);
        results.push({ op: "mark", text: mark.text, found: pieces === "ambiguous" ? pieces : Boolean(pieces) });
        if (!pieces || pieces === "ambiguous") continue;
        for (const node of pieces.map(isolate)) {
          const span = document.createElement("span");
          span.dataset.shortsMark = "";
          span.style.color = mark.color;
          if (mark.bold) span.style.fontWeight = "700";
          node.replaceWith(span);
          span.append(node);
        }
      }
      return results;
    },
    { selector, marks: styled, replaces },
  );
}

/** Image size and the bbox of non-transparent pixels, decoded by the browser. */
async function paintedBox(page: Page, file: string) {
  const dataUrl = `data:image/png;base64,${(await readFile(file)).toString("base64")}`;
  return page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d canvas");
    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] === 0) continue;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    const painted = right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
    return { width, height, painted };
  }, dataUrl);
}

async function capture(page: Page, shot: Shot, base: string, locale: "kor" | "eng", outDir: string) {
  const requested = shot.url ?? (shot.target ? targetPath(shot.target, shot.locale ?? locale) : null);
  if (!requested) throw new Error(`shot needs target or url: ${JSON.stringify(shot)}`);
  const url = new URL(requested, base).toString();
  const out = resolvePath(shot.out, outDir);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  const selector = shot.selector ?? CAPTURE_SELECTOR;
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  // Version and locale are stamped on the tile after hydration.
  await page.waitForTimeout(800);

  const edits = await applyEdits(page, selector, (shot.mark ?? []).map(parseMark), (shot.replace ?? []).map(parseReplace));
  const missing = edits.filter((edit) => edit.found !== true);
  if (missing.length > 0) {
    const reasons = missing.map((edit) =>
      `${JSON.stringify(edit.text)} ${edit.found === "ambiguous" ? "occurs more than once; add surrounding words" : "not found"}`);
    throw new Error(`${url}: ${reasons.join("; ")}`);
  }

  const stamp = await page.locator(selector).first().evaluate((node: HTMLElement) => ({
    version: node.dataset.version ?? null,
    gameLocale: node.dataset.gameLocale ?? null,
  }));

  await mkdir(path.dirname(out), { recursive: true });
  const button = page.locator(DOWNLOAD_SELECTOR).filter({ visible: true }).first();
  let method: "download-button" | "element-screenshot";
  if (await button.count()) {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      button.click(),
    ]);
    await download.saveAs(out);
    method = "download-button";
  } else {
    await page.locator(selector).first().screenshot({ path: out, omitBackground: true });
    method = "element-screenshot";
  }

  const image = await paintedBox(page, out);
  const sidecar = {
    requested,
    url: page.url(),
    target: shot.target ?? null,
    stamp,
    edits: { mark: shot.mark ?? [], replace: shot.replace ?? [] },
    method,
    pixelRatio: DEVICE_SCALE,
    ...image,
    capturedAt: new Date().toISOString(),
  };
  await writeFile(`${out}.json`, `${JSON.stringify(sidecar, null, 2)}\n`);

  const wanted = shot.target?.split("@")[1]?.replace(/^v/, "");
  const warn = wanted && stamp.version && stamp.version !== wanted ? ` (tile says v${stamp.version})` : "";
  console.log(`${out}${warn}`);
}

function parseArgs(argv: string[]): { batch: Batch; batchDir: string } | null {
  const shot: Partial<Shot> = { mark: [], replace: [] };
  let base: string | undefined;
  let locale: "kor" | "eng" | undefined;
  let batchFile: string | undefined;
  let markColor: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${flag} needs a value`);
      return next;
    };
    switch (flag) {
      case "--batch": batchFile = value(); break;
      case "--target": shot.target = value(); break;
      case "--url": shot.url = value(); break;
      case "--out": shot.out = value(); break;
      case "--selector": shot.selector = value(); break;
      case "--mark": shot.mark!.push(value()); break;
      case "--mark-color": markColor = value(); break;
      case "--replace": shot.replace!.push(value()); break;
      case "--base": base = value(); break;
      case "--locale": locale = value() as "kor" | "eng"; break;
      case "--help": case "-h": return null;
      default: throw new Error(`unknown flag: ${flag}`);
    }
  }
  if (batchFile) return { batch: { shots: [] }, batchDir: resolvePath(batchFile) };
  if (!shot.out || !(shot.target || shot.url)) return null;
  if (markColor) shot.mark = shot.mark!.map((text) => ({ text: String(text), color: markColor }));
  return { batch: { base, locale, shots: [shot as Shot] }, batchDir: "" };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2).filter((arg) => arg !== "--"));
  if (!parsed) {
    console.log(
      "usage: pnpm shorts:capture (--target type/ID[@version] | --url path) --out file.png\n" +
        "         [--mark text]... [--mark-color red|gold|green|blue|purple|#hex] [--replace old=>new]...\n" +
        "         [--selector css] [--locale kor|eng] [--base http://localhost:3000]\n" +
        "       pnpm shorts:capture --batch shots.json",
    );
    process.exit(1);
  }

  let { batch } = parsed;
  let outDir = invokedFrom;
  if (parsed.batchDir) {
    batch = JSON.parse(await readFile(parsed.batchDir, "utf8")) as Batch;
    const fileDir = path.dirname(parsed.batchDir);
    outDir = batch.outDir ? resolvePath(batch.outDir, fileDir) : fileDir;
  }
  const base = batch.base ?? DEFAULT_BASE;

  try {
    await fetch(base, { signal: AbortSignal.timeout(120_000) });
  } catch {
    throw new Error(`no site at ${base}. Start it with \`pnpm dev\` in scare-the-spire.`);
  }

  const browser = await chromium.launch();
  try {
    // The site picks its game locale from the browser language, so each locale
    // gets its own context.
    const pages = new Map<"kor" | "eng", Page>();
    const pageFor = async (locale: "kor" | "eng") => {
      const existing = pages.get(locale);
      if (existing) return existing;
      const context = await browser.newContext({
        viewport: { width: 1280, height: 1400 },
        deviceScaleFactor: DEVICE_SCALE,
        acceptDownloads: true,
        reducedMotion: "reduce",
        locale: locale === "kor" ? "ko-KR" : "en-US",
      });
      // tsx keeps function names with an `__name` helper that page.evaluate does not ship.
      await context.addInitScript("globalThis.__name = (fn) => fn;");
      const page = await context.newPage();
      pages.set(locale, page);
      return page;
    };
    for (const shot of batch.shots) {
      const locale = shot.locale ?? batch.locale ?? "kor";
      await capture(await pageFor(locale), { ...shot, locale }, base, locale, outDir);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
