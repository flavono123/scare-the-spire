#!/usr/bin/env node

import fsSync from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const url = stringArg(args, "url");
if (!url) {
  console.error("Missing required --url");
  printHelp();
  process.exit(2);
}

const stageSelector = stringArg(args, "stage", "canvas");
const triggerSpecs = arrayArg(args, "trigger");
const delays = stringArg(args, "delays", "80,120,240,480")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value) && value >= 0)
  .sort((a, b) => a - b);
const repeat = numberArg(args, "repeat", 2);
const preWaitMs = numberArg(args, "pre-wait", 2000);
const settleMs = numberArg(args, "settle", 600);
const timeoutMs = numberArg(args, "timeout", 30000);
const viewport = parseViewport(stringArg(args, "viewport", "1440x1200"));
const deviceScaleFactor = numberArg(args, "device-scale-factor", 1);
const outputDir = path.resolve(
  stringArg(args, "output", path.join("/tmp/animation-playback-qa", timestampSlug())),
);
const browserExecutable = stringArg(args, "browser-executable", defaultChromeExecutable());

const { chromium } = await loadPlaywright();

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
});
const page = await browser.newPage({ viewport, deviceScaleFactor });
const consoleEvents = [];
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning") {
    consoleEvents.push({ type: message.type(), text: message.text() });
  }
});
page.on("pageerror", (error) => {
  consoleEvents.push({ type: "pageerror", text: error.message });
});

const captures = [];
try {
  await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
  await page.waitForTimeout(preWaitMs);
  await captureStage(page, captures, {
    outputDir,
    stageSelector,
    label: "before",
    trigger: null,
    repeatIndex: 0,
    delayMs: 0,
  });

  if (triggerSpecs.length === 0) {
    let elapsed = 0;
    const startedAt = Date.now();
    for (const delay of delays) {
      const waitFor = Math.max(0, delay - elapsed);
      if (waitFor > 0) await page.waitForTimeout(waitFor);
      elapsed = Date.now() - startedAt;
      await captureStage(page, captures, {
        outputDir,
        stageSelector,
        label: `passive-${delay}ms`,
        trigger: null,
        repeatIndex: 0,
        delayMs: delay,
      });
    }
  }

  for (const trigger of triggerSpecs) {
    const locator = page.locator(trigger).first();
    const count = await locator.count();
    if (count === 0) {
      throw new Error(`Trigger locator did not match anything: ${trigger}`);
    }

    for (let index = 1; index <= repeat; index += 1) {
      await locator.click({ timeout: timeoutMs });
      const clickedAt = Date.now();
      let elapsed = 0;
      for (const delay of delays) {
        const waitFor = Math.max(0, delay - elapsed);
        if (waitFor > 0) await page.waitForTimeout(waitFor);
        elapsed = Date.now() - clickedAt;
        await captureStage(page, captures, {
          outputDir,
          stageSelector,
          label: sanitizeName(`${trigger}-r${index}-${delay}ms`),
          trigger,
          repeatIndex: index,
          delayMs: delay,
        });
      }
      if (settleMs > 0) await page.waitForTimeout(settleMs);
    }
  }
} finally {
  await browser.close();
}

const summary = buildSummary({
  url,
  stageSelector,
  triggerSpecs,
  repeat,
  delays,
  preWaitMs,
  settleMs,
  viewport,
  deviceScaleFactor,
  outputDir,
  captures,
  consoleEvents,
});

const summaryPath = path.join(outputDir, "summary.json");
await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ summaryPath, ...summary }, null, 2));

async function captureStage(page, captures, options) {
  const stage = page.locator(options.stageSelector).first();
  const count = await stage.count();
  if (count === 0) {
    throw new Error(`Stage locator did not match anything: ${options.stageSelector}`);
  }

  const elementInfo = await page.evaluate((selector) => {
    const windowWithQa = window;
    windowWithQa.__animationQaElementIds ??= new WeakMap();
    windowWithQa.__animationQaNextElementId ??= 1;
    const element = document.querySelector(selector);
    if (!element) return null;
    if (!windowWithQa.__animationQaElementIds.has(element)) {
      windowWithQa.__animationQaElementIds.set(element, windowWithQa.__animationQaNextElementId++);
    }
    const rect = element.getBoundingClientRect();
    return {
      id: windowWithQa.__animationQaElementIds.get(element),
      tagName: element.tagName,
      className: typeof element.className === "string" ? element.className : "",
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
    };
  }, options.stageSelector);

  const screenshot = await stage.screenshot();
  const previous = captures.at(-1);
  const before = captures[0];
  const fileName = `${String(captures.length).padStart(3, "0")}-${options.label}.png`;
  const filePath = path.join(options.outputDir, fileName);
  await fs.writeFile(filePath, screenshot);

  captures.push({
    filePath,
    fileName,
    trigger: options.trigger,
    repeatIndex: options.repeatIndex,
    delayMs: options.delayMs,
    elementInfo,
    byteLength: screenshot.length,
    diffFromPrevious: previous ? diffBytes(previous.bytes, screenshot) : null,
    diffFromBefore: before ? diffBytes(before.bytes, screenshot) : null,
    bytes: screenshot,
  });
}

function buildSummary(input) {
  const publicCaptures = input.captures.map(({ bytes: _bytes, ...capture }) => capture);
  const elementIds = publicCaptures.map((capture) => capture.elementInfo?.id ?? null);
  const uniqueElementIds = [...new Set(elementIds.filter((id) => id !== null))];
  const nonZeroFrameDiffs = publicCaptures.filter((capture) => (capture.diffFromPrevious ?? 0) > 0).length;
  return {
    url: input.url,
    stageSelector: input.stageSelector,
    triggerSpecs: input.triggerSpecs,
    repeat: input.repeat,
    delays: input.delays,
    preWaitMs: input.preWaitMs,
    settleMs: input.settleMs,
    viewport: input.viewport,
    deviceScaleFactor: input.deviceScaleFactor,
    outputDir: input.outputDir,
    checks: {
      captureCount: publicCaptures.length,
      uniqueStageElementIds: uniqueElementIds,
      stageElementRemounted: uniqueElementIds.length > 1,
      nonZeroFrameDiffs,
      consoleProblemCount: input.consoleEvents.length,
    },
    consoleEvents: input.consoleEvents,
    captures: publicCaptures,
  };
}

function diffBytes(a, b) {
  const length = Math.min(a.length, b.length);
  let changed = Math.abs(a.length - b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) changed += 1;
  }
  return changed;
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s);
    const next = argv[index + 1];
    const value = inlineValue !== undefined
      ? inlineValue
      : next && !next.startsWith("--")
        ? argv[++index]
        : true;
    if (parsed[rawKey] === undefined) parsed[rawKey] = value;
    else if (Array.isArray(parsed[rawKey])) parsed[rawKey].push(value);
    else parsed[rawKey] = [parsed[rawKey], value];
  }
  return parsed;
}

function stringArg(parsed, key, fallback = null) {
  const value = parsed[key];
  if (Array.isArray(value)) return String(value.at(-1));
  if (value === undefined || value === true) return fallback;
  return String(value);
}

function arrayArg(parsed, key) {
  const value = parsed[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function numberArg(parsed, key, fallback) {
  const value = Number.parseInt(stringArg(parsed, key, String(fallback)), 10);
  return Number.isFinite(value) ? value : fallback;
}

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid --viewport '${value}', expected WIDTHxHEIGHT`);
  return { width: Number.parseInt(match[1], 10), height: Number.parseInt(match[2], 10) };
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitizeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120) || "capture";
}

function defaultChromeExecutable() {
  const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return fsSync.existsSync(macChrome) ? macChrome : null;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (bareImportError) {
    const require = createRequire(import.meta.url);
    const candidateRoots = [
      process.env.PLAYWRIGHT_NODE_MODULES,
      process.env.NODE_PATH,
      path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"),
    ].filter(Boolean);

    for (const root of candidateRoots) {
      for (const packageRoot of String(root).split(path.delimiter)) {
        const packageJson = path.join(packageRoot, "playwright", "package.json");
        if (!fsSync.existsSync(packageJson)) continue;
        try {
          return require(path.join(packageRoot, "playwright"));
        } catch {
          continue;
        }
      }
    }

    console.error("Unable to import Playwright. Install it in the project, set PLAYWRIGHT_NODE_MODULES, or set NODE_PATH.");
    console.error(bareImportError instanceof Error ? bareImportError.message : String(bareImportError));
    process.exit(2);
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/capture-animation-playback.mjs --url http://localhost:3000/page --stage ".stage canvas" --trigger "text=Play"

Options:
  --url URL                    Required page URL.
  --stage SELECTOR             CSS selector for the element to screenshot. Default: canvas
  --trigger LOCATOR            Playwright locator to click. Repeat for multiple triggers. Example: text=방출
  --repeat N                   Times to click each trigger. Default: 2
  --delays MS,MS               Capture offsets after each click. Default: 80,120,240,480
  --pre-wait MS                Initial wait after navigation. Default: 2000
  --settle MS                  Wait after each trigger capture sequence. Default: 600
  --viewport WIDTHxHEIGHT      Browser viewport. Default: 1440x1200
  --output DIR                 Output directory. Default: /tmp/animation-playback-qa/<timestamp>
  --browser-executable PATH    Optional Chrome/Chromium executable path.
`);
}
