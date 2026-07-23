#!/usr/bin/env node

import { readFileSync } from "node:fs";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const HISTORY_RUN_ID = "1phase4smoketest";

function usage() {
  console.log(`Usage: pnpm cf:smoke -- --origin <url> [options]

Options:
  --origin <url>               Cloudflare preview or production origin
  --scope <main|patch|all>     Route group to test (default: all)
  --attempts <number>          Attempts per request (default: 1)
  --retry-delay-ms <number>    Delay between attempts (default: 0)
  --help                       Show this help`);
}

function parseArgs(argv) {
  const options = {
    origin: process.env.CF_SMOKE_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "",
    scope: "all",
    attempts: 1,
    retryDelayMs: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--help") {
      usage();
      process.exit(0);
    }
    if (argument === "--origin") {
      options.origin = argv[++index] ?? "";
      continue;
    }
    if (argument === "--scope") {
      options.scope = argv[++index] ?? "";
      continue;
    }
    if (argument === "--attempts") {
      options.attempts = Number(argv[++index]);
      continue;
    }
    if (argument === "--retry-delay-ms") {
      options.retryDelayMs = Number(argv[++index]);
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  if (!options.origin) throw new Error("--origin is required");
  if (!/^https?:\/\//.test(options.origin)) {
    throw new Error("--origin must be an HTTP(S) URL");
  }
  if (!new Set(["main", "patch", "all"]).has(options.scope)) {
    throw new Error("--scope must be main, patch, or all");
  }
  if (!Number.isInteger(options.attempts) || options.attempts < 1 || options.attempts > 60) {
    throw new Error("--attempts must be an integer between 1 and 60");
  }
  if (!Number.isFinite(options.retryDelayMs) || options.retryDelayMs < 0) {
    throw new Error("--retry-delay-ms must be a non-negative number");
  }

  options.origin = options.origin.replace(/\/+$/, "");
  return options;
}

function latestPatchVersion() {
  const patches = JSON.parse(readFileSync("data/sts2-patches.json", "utf8"));
  patches.sort((left, right) => right.date.localeCompare(left.date));
  return patches[0]?.version;
}

function page(path, owner, bodyIncludes) {
  return [
    {
      name: `${path} document`,
      path,
      headers: { Accept: "text/html" },
      contentType: "text/html",
      owner,
      bodyIncludes,
    },
    {
      name: `${path} RSC`,
      path: `${path}${path.includes("?") ? "&" : "?"}_rsc=smoke`,
      headers: { RSC: "1" },
      contentType: "text/x-component",
      owner,
    },
  ];
}

function missingPage(path) {
  return page(path).map((testCase) => ({
    ...testCase,
    statuses: [404],
  }));
}

function mainCases() {
  return [
    ...page("/", "home"),
    ...page("/en", "home"),
    ...page("/zh", "home"),
    ...page("/compendium/cards", "compendium"),
    ...page("/compendium/powers/painful_stabs", "compendium"),
    ...page("/en/compendium/powers/painful_stabs", "compendium"),
    ...page("/zh/compendium/powers?power=painful_stabs", "compendium"),
    ...page("/chemical-x", "service"),
    ...page("/history-course", "service"),
    ...page("/this-or-that", "service"),
    ...page("/c-c-c-combo", "service", "data-combo-page=\"index\""),
    ...page("/en/c-c-c-combo", "service"),
    ...page("/zh/c-c-c-combo", "service"),
    ...page(`/chemical-x/${MISSING_UUID}`),
    ...page(`/c-c-c-combo/${MISSING_UUID}`),
    ...page(`/this-or-that/${MISSING_UUID}`),
    ...page(`/history-course/${HISTORY_RUN_ID}`),
    ...missingPage(`/chemical-x/${MISSING_UUID}/extra`),
    ...missingPage(`/c-c-c-combo/${MISSING_UUID}/extra`),
    ...missingPage(`/this-or-that/${MISSING_UUID}/extra`),
    ...missingPage(`/history-course/${HISTORY_RUN_ID}/extra`),
    {
      name: "Search index asset",
      path: "/generated/search-index.json",
      contentType: "application/json",
    },
    {
      name: "Compendium manifest asset",
      path: "/generated/compendium-resource-manifest.json",
      contentType: "application/json",
    },
    {
      name: "Compendium detail payload",
      path: "/generated/compendium-detail-kor.json",
      contentType: "application/json",
    },
  ];
}

function patchCases() {
  const latest = latestPatchVersion();
  if (!latest) throw new Error("Could not resolve the latest patch version");

  return [
    {
      name: "Patch index",
      path: "/patches",
      headers: { Accept: "text/html" },
      contentType: "text/html",
      bodyIncludes: "data-service-locale=\"ko\"",
    },
    {
      name: "English patch index",
      path: "/en/patches",
      headers: { Accept: "text/html" },
      contentType: "text/html",
      bodyIncludes: "data-service-locale=\"en\"",
    },
    {
      name: "Resource change history stays private",
      path: "/patches/changes",
      headers: { Accept: "text/html" },
      statuses: [404],
    },
    {
      name: "English resource change history stays private",
      path: "/en/patches/changes",
      headers: { Accept: "text/html" },
      statuses: [404],
    },
    {
      name: "Latest Korean patch",
      path: `/patches/${latest}`,
      headers: { Accept: "text/html" },
      contentType: "text/html",
    },
    {
      name: "Latest English patch",
      path: `/en/patches/${latest}`,
      headers: { Accept: "text/html" },
      contentType: "text/html",
    },
    {
      name: "Patch stylesheet",
      path: "/_patches/patch.css",
      contentType: "text/css",
    },
    {
      name: "Resource change history data",
      path: "/generated/sts2-resource-patch-index.json",
      contentType: "application/json",
    },
  ];
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchCase(origin, testCase) {
  const response = await fetch(`${origin}${testCase.path}`, {
    headers: testCase.headers,
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  const body = testCase.bodyIncludes ? await response.text() : "";
  return { response, body };
}

function validateCase(testCase, response, body) {
  const expectedStatuses = testCase.statuses ?? [200];
  if (!expectedStatuses.includes(response.status)) {
    return `expected HTTP ${expectedStatuses.join("/")}, got ${response.status}`;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (testCase.contentType && !contentType.includes(testCase.contentType)) {
    return `expected content-type ${testCase.contentType}, got ${contentType || "missing"}`;
  }

  if (testCase.owner) {
    const owner = response.headers.get("x-cf-static-page")?.toLowerCase() ?? "";
    if (owner !== testCase.owner) {
      return `expected x-cf-static-page=${testCase.owner}, got ${owner || "missing"}`;
    }
  }

  if (testCase.bodyIncludes && !body.includes(testCase.bodyIncludes)) {
    return `response body is missing ${JSON.stringify(testCase.bodyIncludes)}`;
  }

  return null;
}

async function runCase(origin, testCase, options) {
  let lastFailure = "request did not run";
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const { response, body } = await fetchCase(origin, testCase);
      const failure = validateCase(testCase, response, body);
      if (!failure) {
        console.log(`PASS ${testCase.name} · HTTP ${response.status}`);
        return;
      }
      lastFailure = failure;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    console.log(`WAIT ${testCase.name} · ${lastFailure} · attempt ${attempt}/${options.attempts}`);
    if (attempt < options.attempts && options.retryDelayMs > 0) {
      await sleep(options.retryDelayMs);
    }
  }

  throw new Error(`${testCase.name}: ${lastFailure}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cases = [
    ...(["main", "all"].includes(options.scope) ? mainCases() : []),
    ...(["patch", "all"].includes(options.scope) ? patchCases() : []),
  ];

  console.log(`Cloudflare route smoke · ${options.origin} · ${options.scope} · ${cases.length} checks`);
  const failures = [];
  for (const testCase of cases) {
    try {
      await runCase(options.origin, testCase, options);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} smoke check(s) failed:`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll ${cases.length} smoke checks passed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
