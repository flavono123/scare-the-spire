#!/usr/bin/env node

import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const args = parseArgs(process.argv.slice(2));
const baseUrl = stringArg(args, "base-url", "http://localhost:3000");
const outputDir = path.resolve(
  stringArg(args, "output", path.join("/tmp/resource-patch-spine-qa", timestampSlug())),
);
const timeoutMs = numberArg(args, "timeout", 30_000);
const viewport = parseViewport(stringArg(args, "viewport", "1440x1200"));
const chromeExecutable = defaultChromeExecutable();

const [index, entities] = await Promise.all([
  readJson("public/generated/sts2-resource-patch-index.json"),
  readJson("public/comment-entities/sts2"),
]);
const entityByKey = new Map(entities.map((entity) => [resourceKey(entity), entity]));
const resources = index.groups
  .filter((group) => group.type === "character" || group.type === "monster")
  .flatMap((group) => group.resources.map((resource) => ({
    ...resource,
    type: group.type,
    expectedSpine: hasSpineAsset(entityByKey.get(resourceKey({ type: group.type, id: resource.id }))),
  })));

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(chromeExecutable ? { executablePath: chromeExecutable } : {}),
});
const page = await browser.newPage({ viewport });
const consoleEvents = [];
page.on("console", (message) => {
  if (message.type() !== "error" && message.type() !== "warning") return;
  consoleEvents.push({ type: message.type(), text: message.text() });
});
page.on("pageerror", (error) => {
  consoleEvents.push({ type: "pageerror", text: error.message });
});

const results = [];
try {
  for (const resource of resources) {
    const url = new URL("/patches/changes", baseUrl);
    url.searchParams.set("type", resource.type);
    url.searchParams.set("id", resource.id);
    const failures = [];

    try {
      await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.waitForFunction(
        ({ expectedLabel }) => {
          const root = document.querySelector("[data-selected-resource-spine]");
          return Array.from(root?.children ?? [])
            .some((child) => child.textContent?.trim() === expectedLabel);
        },
        { expectedLabel: resource.nameKo },
        { timeout: timeoutMs },
      );
      await page.waitForFunction(
        ({ expectedSpine }) => {
          const root = document.querySelector("[data-selected-resource-spine]");
          if (!root) return false;
          if (!expectedSpine) return Boolean(root.querySelector("img"));
          return Boolean(root.querySelector(".sts2-spine-stage.opacity-100 canvas"));
        },
        { expectedSpine: resource.expectedSpine },
        { timeout: timeoutMs },
      );
      await page.waitForTimeout(120);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }

    const root = page.locator("[data-selected-resource-spine]");
    if (await root.count() !== 1) {
      failures.push("Selected Spine preview root is missing or duplicated.");
      results.push(toResult(resource, null, failures));
      continue;
    }

    const measurement = await root.evaluate(measurePreview);
    validateMeasurement(measurement, resource.expectedSpine, failures);
    await root.locator(":scope > span").first().screenshot({
      path: path.join(outputDir, `${resource.type}-${resource.id.toLowerCase()}.png`),
    });
    results.push(toResult(resource, measurement, failures));

    const status = failures.length > 0 ? "FAIL" : "OK";
    console.log(
      `[resource-patch-spine-qa] ${status} ${resource.type}:${resource.id}`
      + (measurement?.visual
        ? ` occupancy=${measurement.visual.widthRatio.toFixed(2)}x${measurement.visual.heightRatio.toFixed(2)} center=${measurement.visual.centerOffsetRatio.toFixed(3)}`
        : ""),
    );
    for (const failure of failures) console.log(`  - ${failure}`);
  }
} finally {
  await browser.close();
}

const relevantConsoleEvents = consoleEvents.filter((event) =>
  /Spine|WebGL|pageerror/i.test(event.text),
);
const summary = {
  ok: results.every((result) => result.failures.length === 0) && relevantConsoleEvents.length === 0,
  baseUrl,
  viewport,
  outputDir,
  checked: results.length,
  expectedSpine: resources.filter((resource) => resource.expectedSpine).length,
  relevantConsoleEvents,
  results,
};
const summaryPath = path.join(outputDir, "summary.json");
await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`[resource-patch-spine-qa] summary: ${summaryPath}`);

if (!summary.ok) process.exitCode = 1;

function measurePreview(root) {
  function alphaBounds(pixels, width, height) {
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] <= 8) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
      }
    }
    return right > left && bottom > top ? { left, top, right, bottom } : null;
  }

  function canvasVisualBounds(canvas, stageRect) {
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) return null;
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const bounds = alphaBounds(pixels, copy.width, copy.height);
    if (!bounds) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      left: rect.left - stageRect.left + (bounds.left / copy.width) * rect.width,
      top: rect.top - stageRect.top + (bounds.top / copy.height) * rect.height,
      right: rect.left - stageRect.left + (bounds.right / copy.width) * rect.width,
      bottom: rect.top - stageRect.top + (bounds.bottom / copy.height) * rect.height,
    };
  }

  function imageVisualBounds(image, stageRect) {
    if (!(image instanceof HTMLImageElement) || image.naturalWidth <= 0 || image.naturalHeight <= 0) return null;
    const copy = document.createElement("canvas");
    copy.width = image.naturalWidth;
    copy.height = image.naturalHeight;
    const context = copy.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const bounds = alphaBounds(pixels, copy.width, copy.height);
    if (!bounds) return null;

    const rect = image.getBoundingClientRect();
    const imageAspect = image.naturalWidth / image.naturalHeight;
    const rectAspect = rect.width / rect.height;
    const drawnWidth = rectAspect > imageAspect ? rect.height * imageAspect : rect.width;
    const drawnHeight = rectAspect > imageAspect ? rect.height : rect.width / imageAspect;
    const drawnLeft = rect.left - stageRect.left + (rect.width - drawnWidth) / 2;
    const drawnTop = rect.top - stageRect.top + (rect.height - drawnHeight) / 2;
    return {
      left: drawnLeft + (bounds.left / copy.width) * drawnWidth,
      top: drawnTop + (bounds.top / copy.height) * drawnHeight,
      right: drawnLeft + (bounds.right / copy.width) * drawnWidth,
      bottom: drawnTop + (bounds.bottom / copy.height) * drawnHeight,
    };
  }

  function mergeBounds(bounds, stageRect) {
    if (bounds.length === 0) return null;
    const left = Math.min(...bounds.map((bound) => bound.left));
    const top = Math.min(...bounds.map((bound) => bound.top));
    const right = Math.max(...bounds.map((bound) => bound.right));
    const bottom = Math.max(...bounds.map((bound) => bound.bottom));
    const width = right - left;
    const height = bottom - top;
    const centerOffset = (left + right) / 2 - stageRect.width / 2;
    return {
      left,
      top,
      right,
      bottom,
      width,
      height,
      widthRatio: width / stageRect.width,
      heightRatio: height / stageRect.height,
      centerOffset,
      centerOffsetRatio: centerOffset / stageRect.width,
    };
  }

  function rectJson(rect) {
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  const stage = root.querySelector(":scope > span");
  if (!(stage instanceof HTMLElement)) return null;

  const stageRect = stage.getBoundingClientRect();
  const canvases = Array.from(stage.querySelectorAll("canvas"))
    .filter((canvas) => {
      const rect = canvas.getBoundingClientRect();
      const layer = canvas.closest(".sts2-spine-stage");
      return rect.width > 0
        && rect.height > 0
        && (!layer || Number.parseFloat(getComputedStyle(layer).opacity) > 0.01);
    });
  const canvasBounds = canvases
    .map((canvas) => canvasVisualBounds(canvas, stageRect))
    .filter(Boolean);
  const imageBounds = canvasBounds.length > 0
    ? []
    : Array.from(stage.querySelectorAll("img"))
        .map((image) => imageVisualBounds(image, stageRect))
        .filter(Boolean);
  const visual = mergeBounds([...canvasBounds, ...imageBounds], stageRect);

  return {
    wrapper: rectJson(root.getBoundingClientRect()),
    stage: rectJson(stageRect),
    canvasCount: canvases.length,
    visual,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  };
}

function validateMeasurement(measurement, expectedSpine, failures) {
  if (!measurement) {
    failures.push("Could not measure the selected preview.");
    return;
  }
  if (measurement.wrapper.width < 360) {
    failures.push(`Preview wrapper is too narrow: ${measurement.wrapper.width.toFixed(1)}px.`);
  }
  if (measurement.documentWidth > measurement.viewportWidth) {
    failures.push(
      `Horizontal overflow: document ${measurement.documentWidth}px > viewport ${measurement.viewportWidth}px.`,
    );
  }
  if (expectedSpine && measurement.canvasCount === 0) {
    failures.push("Expected a ready WebGL Spine canvas.");
  }
  if (!measurement.visual) {
    failures.push("Preview has no visible actor pixels.");
    return;
  }
  if (Math.max(measurement.visual.widthRatio, measurement.visual.heightRatio) < 0.72) {
    failures.push(
      `Actor is too small: ${measurement.visual.widthRatio.toFixed(2)}x${measurement.visual.heightRatio.toFixed(2)}.`,
    );
  }
  if (Math.abs(measurement.visual.centerOffsetRatio) > 0.12) {
    failures.push(
      `Actor is horizontally off-center: ${measurement.visual.centerOffsetRatio.toFixed(3)} stage widths.`,
    );
  }
}

function toResult(resource, measurement, failures) {
  return {
    type: resource.type,
    id: resource.id,
    nameKo: resource.nameKo,
    expectedSpine: resource.expectedSpine,
    measurement,
    failures,
  };
}

function hasSpineAsset(entity) {
  if (entity?.type === "character") return Boolean(entity.characterData?.spineAsset);
  if (entity?.type === "monster") return Boolean(entity.monsterData?.spineAsset);
  return false;
}

function resourceKey(resource) {
  return `${resource.type}:${resource.id}`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(path.resolve(filePath), "utf8"));
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function stringArg(parsed, key, fallback) {
  const value = parsed[key];
  return typeof value === "string" ? value : fallback;
}

function numberArg(parsed, key, fallback) {
  const value = Number.parseInt(stringArg(parsed, key, String(fallback)), 10);
  return Number.isFinite(value) ? value : fallback;
}

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid viewport '${value}', expected WIDTHxHEIGHT.`);
  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10),
  };
}

function defaultChromeExecutable() {
  const executable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return fsSync.existsSync(executable) ? executable : null;
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
