#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";
import { chromium } from "@playwright/test";

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";

const PRESETS = [
  { name: "iPhone 13 mini / user", width: 375, height: 812, dpr: 3, userAgent: IOS_UA },
  { name: "iPhone mainstream 6.1", width: 390, height: 844, dpr: 3, userAgent: IOS_UA },
  { name: "iPhone Plus / Pro Max", width: 430, height: 932, dpr: 3, userAgent: IOS_UA },
  { name: "Android compact", width: 360, height: 800, dpr: 3, userAgent: ANDROID_UA },
  { name: "Pixel mainstream", width: 412, height: 915, dpr: 2.625, userAgent: ANDROID_UA },
  { name: "Android large", width: 432, height: 960, dpr: 3, userAgent: ANDROID_UA },
  { name: "Android XL", width: 480, height: 1040, dpr: 2.75, userAgent: ANDROID_UA },
];

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.MOBILE_QA_BASE_URL ?? "",
    host: process.env.MOBILE_QA_HOST ?? "0.0.0.0",
    noDev: false,
    port: Number(process.env.MOBILE_QA_PORT ?? 3000),
    route: "/patches",
    list: false,
  };

  for (const arg of argv) {
    if (arg === "--list") options.list = true;
    else if (arg === "--no-dev") options.noDev = true;
    else if (arg.startsWith("--base-url=")) options.baseUrl = arg.slice("--base-url=".length);
    else if (arg.startsWith("--host=")) options.host = arg.slice("--host=".length);
    else if (arg.startsWith("--port=")) options.port = Number(arg.slice("--port=".length));
    else if (!arg.startsWith("--")) options.route = arg;
  }

  return options;
}

function normalizeRoute(route) {
  if (/^https?:\/\//.test(route)) return route;
  return route.startsWith("/") ? route : `/${route}`;
}

function joinUrl(baseUrl, route) {
  if (/^https?:\/\//.test(route)) return route;
  return `${baseUrl.replace(/\/$/, "")}${normalizeRoute(route)}`;
}

async function canReach(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok || response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(baseUrl, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canReach(baseUrl)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

function startDevServer({ host, port }) {
  const child = spawn(
    "pnpm",
    ["exec", "next", "dev", "--hostname", host, "--port", String(port)],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

function printPresets() {
  for (const preset of PRESETS) {
    console.log(`${preset.name}: ${preset.width}x${preset.height} @${preset.dpr}x`);
  }
}

async function labelTab(page, preset) {
  await page.addInitScript(({ name }) => {
    const prefix = `[${name}] `;
    const stripPresetPrefix = (title) => title.replace(/^\[[^\]]+\]\s*/, "");
    const applyTitle = () => {
      if (!document.title.startsWith(prefix)) {
        document.title = `${prefix}${stripPresetPrefix(document.title)}`;
      }
    };

    window.addEventListener("DOMContentLoaded", () => {
      applyTitle();
      const title = document.querySelector("title");
      if (title) {
        new MutationObserver(applyTitle).observe(title, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
    });
  }, { name: preset.name });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) {
    printPresets();
    return;
  }

  const baseUrl = options.baseUrl || `http://localhost:${options.port}`;
  const targetUrl = joinUrl(baseUrl, options.route);
  let devServer;

  if (!(await canReach(baseUrl))) {
    if (options.noDev) {
      throw new Error(`${baseUrl} is not reachable. Remove --no-dev or start the dev server first.`);
    }
    console.log(`[mobile-qa] starting dev server on ${options.host}:${options.port}`);
    devServer = startDevServer(options);
    await waitForServer(baseUrl);
  } else {
    console.log(`[mobile-qa] reusing ${baseUrl}`);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: PRESETS[0].width, height: PRESETS[0].height },
    deviceScaleFactor: PRESETS[0].dpr,
    hasTouch: true,
    isMobile: true,
    userAgent: IOS_UA,
  });

  async function shutdown() {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    if (devServer) devServer.kill("SIGTERM");
    process.exit(0);
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  for (const preset of PRESETS) {
    const page = await context.newPage();
    await labelTab(page, preset);
    await page.setViewportSize({ width: preset.width, height: preset.height });
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    console.log(`[mobile-qa] opened ${preset.name} (${preset.width}x${preset.height}) -> ${targetUrl}`);
  }

  console.log("[mobile-qa] opened one browser window with one tab per preset.");
  console.log("[mobile-qa] tab titles are prefixed with preset names.");
  console.log("[mobile-qa] press Ctrl+C to close the browser and dev server.");
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(`[mobile-qa] ${error.message}`);
  process.exit(1);
});
