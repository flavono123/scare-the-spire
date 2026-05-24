#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const repoRoot = await findRepoRoot(process.cwd());
const options = {
  baseUrl: stringArg(args, "base-url", process.env.BASE_URL ?? "http://localhost:3000"),
  route: stringArg(args, "route", "/profile"),
  renderSelector: stringArg(args, "render-selector", "[data-profile-render]"),
  controlsSelector: stringArg(args, "controls-selector", "[data-profile-controls]"),
  choiceSelector: stringArg(args, "choice-selector", "[data-profile-choice]"),
  clickTypes: stringArg(args, "click-types", "").split(",").map((value) => value.trim()).filter(Boolean),
  minVisibleHeight: numberArg(args, "min-visible-height", 240),
  timeoutMs: numberArg(args, "timeout", 60000),
  noDev: Boolean(args["no-dev"]),
  headed: Boolean(args.headed),
  outputDir: path.resolve(stringArg(args, "output", path.join("/tmp/mobile-viewport-qa", timestampSlug()))),
};

await fs.mkdir(options.outputDir, { recursive: true });

let devServer = null;
if (!(await canReach(options.baseUrl))) {
  if (options.noDev) {
    throw new Error(`${options.baseUrl} is not reachable. Start the app or omit --no-dev.`);
  }
  devServer = startDevServer(repoRoot, options.baseUrl);
  await waitForServer(options.baseUrl, options.timeoutMs);
}

const presets = await loadMobilePresets(repoRoot);
const browser = await chromium.launch({ headless: !options.headed });
const summary = {
  ok: true,
  url: joinUrl(options.baseUrl, options.route),
  outputDir: options.outputDir,
  presets: [],
};

try {
  for (const preset of presets) {
    const result = await checkPreset(browser, preset, options);
    summary.presets.push(result);
    if (result.failures.length > 0) summary.ok = false;
    const status = result.failures.length > 0 ? "FAIL" : "OK";
    console.log(`[mobile-viewport-qa] ${status} ${preset.name} (${preset.width}x${preset.height})`);
    for (const failure of result.failures) {
      console.log(`  - ${failure}`);
    }
  }
} finally {
  await browser.close().catch(() => {});
  if (devServer) devServer.kill("SIGTERM");
}

const summaryPath = path.join(options.outputDir, "summary.json");
await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`[mobile-viewport-qa] summary: ${summaryPath}`);

if (!summary.ok) process.exit(1);

async function checkPreset(browser, preset, options) {
  const context = await browser.newContext({
    viewport: { width: preset.width, height: preset.height },
    deviceScaleFactor: preset.dpr,
    hasTouch: true,
    isMobile: true,
    userAgent: preset.name.toLowerCase().includes("iphone") ? IOS_UA : ANDROID_UA,
  });
  const page = await context.newPage();
  const consoleEvents = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleEvents.push({ type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    consoleEvents.push({ type: "pageerror", text: error.message });
  });

  const slug = sanitizeName(`${preset.name}-${preset.width}x${preset.height}`);
  const failures = [];

  try {
    await page.goto(joinUrl(options.baseUrl, options.route), {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs,
    });
    await page.waitForLoadState("networkidle", { timeout: options.timeoutMs }).catch(() => {});
    await page.waitForTimeout(1200);

    const initial = await readLayout(page, options, preset);
    failures.push(...layoutFailures(initial, options));

    const screenshotPath = path.join(options.outputDir, `${slug}-initial.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const clickResults = [];
    for (const type of options.clickTypes) {
      const clickResult = await clickChoiceAndVerify(page, options, type);
      clickResults.push(clickResult);
      if (!clickResult.skipped && !clickResult.ok) {
        failures.push(clickResult.reason);
      }
      await page.screenshot({
        path: path.join(options.outputDir, `${slug}-${sanitizeName(type)}.png`),
        fullPage: false,
      });
    }

    return {
      ...preset,
      failures,
      layout: initial,
      clickResults,
      consoleEvents,
      screenshots: [screenshotPath],
    };
  } finally {
    await context.close().catch(() => {});
  }
}

async function readLayout(page, options, preset) {
  return page.evaluate(
    ({ renderSelector, controlsSelector, width, height }) => {
      const render = document.querySelector(renderSelector);
      const controls = document.querySelector(controlsSelector);
      const renderRect = render?.getBoundingClientRect();
      const controlsRect = controls?.getBoundingClientRect();
      const viewport = { width, height };
      const visibleRect = renderRect ? intersectRect(renderRect, viewport) : null;
      const visibleRenderChildren = render
        ? [...render.querySelectorAll("canvas,img,.sts2-spine-stage,[data-ancient-node-render]")]
          .map((element) => element.getBoundingClientRect())
          .filter((rect) => {
            const visible = intersectRect(rect, viewport);
            return visible.width > 12 && visible.height > 12;
          })
          .length
        : 0;

      return {
        viewport,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        render: renderRect ? rectJson(renderRect) : null,
        controls: controlsRect ? rectJson(controlsRect) : null,
        visibleRender: visibleRect,
        visibleRenderChildren,
        renderDataset: render instanceof HTMLElement ? { ...render.dataset } : {},
      };

      function rectJson(rect) {
        return {
          x: rect.x,
          y: rect.y,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
      }

      function intersectRect(rect, viewport) {
        const left = Math.max(0, rect.left);
        const top = Math.max(0, rect.top);
        const right = Math.min(viewport.width, rect.right);
        const bottom = Math.min(viewport.height, rect.bottom);
        return {
          left,
          top,
          right,
          bottom,
          width: Math.max(0, right - left),
          height: Math.max(0, bottom - top),
        };
      }
    },
    {
      renderSelector: options.renderSelector,
      controlsSelector: options.controlsSelector,
      width: preset.width,
      height: preset.height,
    },
  );
}

function layoutFailures(layout, options) {
  const failures = [];
  const viewportWidth = layout.viewport.width;

  if (!layout.render) {
    failures.push(`render selector not found: ${options.renderSelector}`);
    return failures;
  }

  if (layout.documentWidth > viewportWidth + 2 || layout.bodyWidth > viewportWidth + 2) {
    failures.push(`horizontal overflow: document=${layout.documentWidth}, body=${layout.bodyWidth}, viewport=${viewportWidth}`);
  }

  if (!layout.visibleRender || layout.visibleRender.width < Math.min(300, viewportWidth * 0.78)) {
    failures.push(`render width is not visibly mobile-sized: ${layout.visibleRender?.width ?? 0}px`);
  }

  if (!layout.visibleRender || layout.visibleRender.height < options.minVisibleHeight) {
    failures.push(`render visible height is too small: ${layout.visibleRender?.height ?? 0}px < ${options.minVisibleHeight}px`);
  }

  if (layout.controls && layout.render.top < layout.controls.bottom - 2) {
    failures.push(`render is not vertically below controls: render.top=${layout.render.top}, controls.bottom=${layout.controls.bottom}`);
  }

  if (layout.visibleRenderChildren === 0) {
    failures.push("render contains no visible canvas/image/stage child");
  }

  return failures;
}

async function clickChoiceAndVerify(page, options, type) {
  const choiceSelector = `${options.choiceSelector}[data-profile-choice-type="${cssEscape(type)}"]:not([aria-pressed="true"])`;
  const choice = page.locator(choiceSelector).first();
  if (await choice.count() === 0) {
    return { type, skipped: true, ok: true, reason: `no inactive ${type} choice found` };
  }

  const expectedId = await choice.getAttribute("data-profile-choice-id");
  await choice.click({ timeout: options.timeoutMs });
  await page.waitForTimeout(900);

  const dataset = await page.locator(options.renderSelector).first().evaluate((element) => ({ ...element.dataset }));
  const key = `profile${type[0].toUpperCase()}${type.slice(1)}Id`;
  const actualId = dataset[key];
  const ok = expectedId && actualId === expectedId;

  return {
    type,
    skipped: false,
    ok,
    expectedId,
    actualId,
    reason: ok ? "" : `${type} selection did not reach render dataset: expected ${expectedId}, got ${actualId ?? "(missing)"}`,
  };
}

async function loadMobilePresets(repoRoot) {
  const output = await runNode(repoRoot, ["scripts/mobile-qa.mjs", "--list"]);
  const presets = [];
  for (const line of output.split("\n")) {
    const match = line.match(/^(.+):\s+(\d+)x(\d+)\s+@([\d.]+)x$/);
    if (!match) continue;
    presets.push({
      name: match[1],
      width: Number(match[2]),
      height: Number(match[3]),
      dpr: Number(match[4]),
    });
  }
  if (presets.length === 0) {
    throw new Error("No mobile presets found from scripts/mobile-qa.mjs --list");
  }
  return presets;
}

function runNode(cwd, nodeArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", nodeArgs, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `node ${nodeArgs.join(" ")} exited with ${code}`));
    });
  });
}

function startDevServer(repoRoot, baseUrl) {
  const url = new URL(baseUrl);
  const port = url.port || (url.protocol === "https:" ? "443" : "3000");
  const host = process.env.MOBILE_QA_HOST ?? "0.0.0.0";
  console.log(`[mobile-viewport-qa] starting dev server on ${host}:${port}`);
  const child = spawn("pnpm", ["exec", "next", "dev", "--hostname", host, "--port", port], {
    cwd: repoRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function canReach(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    return response.ok || response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(baseUrl, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canReach(baseUrl)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function findRepoRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(current, "package.json"), "utf8"));
      if (pkg.name === "scare-the-spire") return current;
    } catch {}
    const parent = path.dirname(current);
    if (parent === current) throw new Error("Could not find scare-the-spire package.json");
    current = parent;
  }
}

function joinUrl(baseUrl, route) {
  if (/^https?:\/\//.test(route)) return route;
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  return `${baseUrl.replace(/\/$/, "")}${normalizedRoute}`;
}

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [key, ...rest] = arg.slice(2).split("=");
      parsed[key] = rest.length ? rest.join("=") : true;
    }
  }
  return parsed;
}

function stringArg(args, key, fallback = "") {
  const value = args[key];
  return typeof value === "string" ? value : fallback;
}

function numberArg(args, key, fallback) {
  const raw = args[key];
  if (typeof raw !== "string") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitizeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function cssEscape(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function printHelp() {
  console.log(`Usage:
  node .codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs --route /profile

Options:
  --base-url URL              Existing or desired local app URL. Default: http://localhost:3000
  --route PATH_OR_URL          Route or full URL to test. Default: /profile
  --render-selector SELECTOR   Render area selector. Default: [data-profile-render]
  --controls-selector SELECTOR Selector block expected above render. Default: [data-profile-controls]
  --choice-selector SELECTOR   Selectable carousel item base selector. Default: [data-profile-choice]
  --click-types LIST           Comma list of data-profile-choice-type values to click.
  --min-visible-height PX      Minimum visible render height. Default: 240
  --output DIR                 Screenshot and summary directory.
  --no-dev                     Do not start Next dev server.
  --headed                     Run browser headed.
`);
}
