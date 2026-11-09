#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

import { checkBuildRecord, describeBuildRecord } from "./build-record.mjs";
import { CLOUDFLARE_ASSETS_DIR, CLOUDFLARE_BUILD_DIR } from "./cloudflare-assets-dir.mjs";
import { DEV_ASSET_WATCH_ENV } from "./wrangler-dev-assets.mjs";

const LOCAL_MAIN_ORIGIN = "http://127.0.0.1:8787";
const LOCAL_PATCH_ORIGIN = "http://127.0.0.1:8788";
const REMOTE_ENVIRONMENT = "testbed";
// The testbed is a development stage: its pages, patch pages and /api all use the
// shared Supabase's development rows, never production ones (users only reach production).
const TESTBED_DATA_ENV = "development";
const REMOTE_READY_TIMEOUT_MS = 180_000;

function usage() {
  console.log(`Usage: pnpm cf:testbed -- [options]

Options:
  --origin <url>   Test an already-running preview without building or starting Workers
  --remote         Deploy the isolated testbed Workers to Cloudflare and test them
  --skip-build     Reuse existing .cloudflare/assets and .patch-worker artifacts
                   (refused unless both were built from the current checkout)
  --api            Local only: turn the runtime flags on (API_RUNTIME_FLAGS=d1) and give
                   the local Worker the API vars from .env.local, so /api reaches the
                   shared Supabase's development rows. Off by default, like --allow-supabase
                   in mobile QA. Set flags with:
                   pnpm flags set path.<group> api --env production --local --note "local QA"
  --help           Show this help`);
}

// Refuse to test or deploy artifacts built from another commit or tree.
function assertFreshArtifacts(options) {
  const artifacts = [
    { dir: CLOUDFLARE_BUILD_DIR, build: "pnpm cf:build" },
    {
      dir: ".patch-worker",
      // Matches the patch build runRemote() does itself.
      build: options.remote
        ? `NEXT_PUBLIC_SUPABASE_ENV=${TESTBED_DATA_ENV} pnpm patch:build`
        : "pnpm patch:build",
    },
  ];
  const stale = [];
  for (const artifact of artifacts) {
    const result = checkBuildRecord(artifact.dir);
    if (result.ok) {
      console.log(`[testbed] ${artifact.dir} built from ${describeBuildRecord(result.record)}`);
    } else {
      stale.push({ ...artifact, reason: result.reason });
    }
  }
  if (stale.length === 0) return;

  const rebuild = options.remote ? "pnpm cf:testbed" : "pnpm cf:testbed:local";
  throw new Error(
    [
      "refusing to use stale Worker artifacts:",
      ...stale.map((artifact) => `  - ${artifact.reason} (rebuild with ${artifact.build})`),
      options.skipBuild
        ? `Run ${rebuild} without --skip-build to rebuild both from this checkout.`
        : `The checkout changed during the build; run ${rebuild} again.`,
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const options = { origin: "", remote: false, skipBuild: false, api: false };
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
    if (argument === "--remote") {
      options.remote = true;
      continue;
    }
    if (argument === "--skip-build") {
      options.skipBuild = true;
      continue;
    }
    if (argument === "--api") {
      options.api = true;
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  if (options.origin && !/^https?:\/\//.test(options.origin)) {
    throw new Error("--origin must be an HTTP(S) URL");
  }
  options.origin = options.origin.replace(/\/+$/, "");
  return options;
}

/** One key from .env.local or .env, without loading the rest (it holds service secrets). */
function checkoutEnvValue(name) {
  if (process.env[name]) return process.env[name];
  for (const file of [".env.local", ".env"]) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const line = text.split("\n").find((candidate) => candidate.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

/** --var arguments for the same-origin API (docs/supabase-exit/STEP1_DESIGN.md 2.1, 10). */
function apiVarArgs(dataEnv) {
  const vars = {
    API_SUPABASE_URL: checkoutEnvValue("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, ""),
    API_SUPABASE_KEY: checkoutEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    API_DATA_ENV: dataEnv,
  };
  run("check API vars", "pnpm", ["exec", "tsx", "scripts/check-api-vars.ts", "--expect-env", dataEnv], {
    ...process.env,
    ...vars,
  });
  return Object.entries(vars).flatMap(([key, value]) => ["--var", `${key}:${value}`]);
}

function executable(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(label, command, args, env = process.env) {
  console.log(`\n[testbed] ${label}`);
  const result = spawnSync(executable(command), args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function runCaptured(label, command, args, env = process.env) {
  console.log(`\n[testbed] ${label}`);
  return new Promise((resolve, reject) => {
    const child = spawn(executable(command), args, {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const forward = (stream, destination) => {
      stream.on("data", (chunk) => {
        const text = chunk.toString();
        output += text;
        destination.write(text);
      });
    };
    forward(child.stdout, process.stdout);
    forward(child.stderr, process.stderr);
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${label} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

function startWorker(label, config, port, extraArgs = []) {
  console.log(`\n[testbed] starting ${label} on port ${port}`);
  const child = spawn(
    executable("pnpm"),
    [
      "exec",
      "wrangler",
      "dev",
      "--config",
      config,
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--log-level",
      "warn",
      "--show-interactive-dev-session=false",
      ...extraArgs,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...DEV_ASSET_WATCH_ENV },
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return child;
}

async function waitForWorker(label, child, url, timeoutMs = 90_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`${label} exited before becoming ready (exit ${child.exitCode})`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) {
        console.log(`[testbed] ${label} ready · ${url} · HTTP ${response.status}`);
        return;
      }
    } catch {
      // The dev server may still be compiling or registering its service binding.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not become ready within ${timeoutMs / 1000}s`);
}

function stopWorker(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  try {
    if (process.platform === "win32") child.kill("SIGTERM");
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function runSuites(origin, { attempts = 1, retryDelayMs = 0 } = {}) {
  run("production-shaped route smoke", "pnpm", [
    "cf:smoke",
    "--",
    "--origin",
    origin,
    "--scope",
    "all",
    "--attempts",
    String(attempts),
    "--retry-delay-ms",
    String(retryDelayMs),
  ]);
  run(
    "browser behavior and mobile QA",
    "pnpm",
    ["qa:cf:testbed"],
    {
      ...process.env,
      BASE_URL: origin,
      CF_TESTBED_ORIGIN: origin,
      PLAYWRIGHT_BLOCK_SUPABASE: "1",
    },
  );
}

async function waitForRemoteStack(origin, timeoutMs = REMOTE_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  let lastStatus = "not requested";
  let nextProgressAt = startedAt;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const [home, patch] = await Promise.all([
        fetch(`${origin}/`, {
          headers: { Accept: "text/html", "Cache-Control": "no-cache" },
          signal: AbortSignal.timeout(10_000),
        }),
        fetch(`${origin}/patches`, {
          headers: { Accept: "text/html", "Cache-Control": "no-cache" },
          signal: AbortSignal.timeout(10_000),
        }),
      ]);
      const homeOwner = home.headers.get("x-cf-static-page");
      lastStatus = `home=${home.status}/${homeOwner ?? "no-owner"}, patch=${patch.status}`;
      await Promise.all([home.body?.cancel(), patch.body?.cancel()]);
      if (home.status === 200 && homeOwner === "home" && patch.status === 200) {
        console.log(`[testbed] remote stack ready · ${origin} · ${lastStatus}`);
        return;
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }

    if (Date.now() >= nextProgressAt) {
      console.log(`[testbed] waiting for Cloudflare asset propagation · ${lastStatus}`);
      nextProgressAt = Date.now() + 10_000;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(
    `remote testbed stack did not become ready within ${timeoutMs / 1000}s (${lastStatus})`,
  );
}

async function runRemote(options) {
  if (!options.skipBuild) {
    // Set explicitly: a checkout .env.local pointing at production must not leak into the testbed.
    const buildEnv = { ...process.env, NEXT_PUBLIC_SUPABASE_ENV: TESTBED_DATA_ENV };
    // Optional pass-through of the browser's no-cookie path (src/lib/runtime-flags.ts); unset = legacy.
    const apiPathDefault = process.env.NEXT_PUBLIC_API_PATH_DEFAULT ?? "api"; // like CI since 2026-11-09
    if (!["", "legacy", "api"].includes(apiPathDefault)) throw new Error("NEXT_PUBLIC_API_PATH_DEFAULT must be legacy or api");
    console.log(`[testbed] NEXT_PUBLIC_API_PATH_DEFAULT=${apiPathDefault || "(unset: legacy)"}`);
    // The builds read it from their env: the default above must reach them, not only this log line.
    if (apiPathDefault) buildEnv.NEXT_PUBLIC_API_PATH_DEFAULT = apiPathDefault;
    else delete buildEnv.NEXT_PUBLIC_API_PATH_DEFAULT;
    run("build main Worker artifact", "pnpm", ["cf:build"], buildEnv);
    run("build static patch Worker artifact", "pnpm", ["patch:build"], buildEnv);
  }

  assertFreshArtifacts(options);
  run("validate static patch Worker artifact", "pnpm", ["patch:test"]);
  run("validate main Worker upload size", "pnpm", ["cf:size"]);

  const wranglerEnv = { ...process.env, WRANGLER_WRITE_LOGS: "0" };
  const apiVars = apiVarArgs(TESTBED_DATA_ENV);
  // Idempotent; the testbed Worker reads runtime_flags and api_cache from its own D1.
  run(
    "apply testbed D1 migrations",
    "pnpm",
    ["exec", "wrangler", "d1", "migrations", "apply", "DB", "--env", REMOTE_ENVIRONMENT, "--remote"],
    wranglerEnv,
  );
  await runCaptured(
    "deploy isolated patch Worker",
    "pnpm",
    [
      "exec",
      "wrangler",
      "deploy",
      "--config",
      "wrangler.patch.jsonc",
      "--env",
      REMOTE_ENVIRONMENT,
      "--keep-vars",
    ],
    wranglerEnv,
  );
  const mainOutput = await runCaptured(
    "deploy isolated main Worker",
    "pnpm",
    [
      "exec",
      "wrangler",
      "deploy",
      "--config",
      "wrangler.jsonc",
      "--env",
      REMOTE_ENVIRONMENT,
      "--keep-vars",
      ...apiVars,
    ],
    wranglerEnv,
  );
  const origin = mainOutput.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0];
  if (!origin) throw new Error("Cloudflare did not report the testbed Worker URL");

  await waitForRemoteStack(origin);
  runSuites(origin, { attempts: 3, retryDelayMs: 2_000 });
}

function assertBuiltArtifacts() {
  for (const artifact of [CLOUDFLARE_ASSETS_DIR, ".patch-worker"]) {
    if (!statSync(artifact, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`--skip-build needs an existing ${artifact}; run pnpm cf:build and pnpm patch:build first`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.skipBuild && !options.origin) assertBuiltArtifacts();
  if (options.origin) {
    runSuites(options.origin);
    return;
  }

  if (options.remote) {
    await runRemote(options);
    return;
  }

  if (!options.skipBuild) {
    run("build main Worker artifact", "pnpm", ["cf:build"]);
    run("build static patch Worker artifact", "pnpm", ["patch:build"]);
  }
  assertFreshArtifacts(options);

  let patchWorker;
  let mainWorker;
  try {
    patchWorker = startWorker("patch-worker", "wrangler.patch.jsonc", 8788);
    await waitForWorker("patch Worker", patchWorker, `${LOCAL_PATCH_ORIGIN}/patches`);

    const localApiArgs = options.api
      ? ["--var", "API_RUNTIME_FLAGS:d1", ...apiVarArgs("development")]
      : [];
    if (options.api) {
      run("apply local D1 migrations", "pnpm", ["exec", "wrangler", "d1", "migrations", "apply", "DB", "--local"]);
    }
    mainWorker = startWorker("main-worker", "wrangler.jsonc", 8787, localApiArgs);
    await waitForWorker("main Worker", mainWorker, `${LOCAL_MAIN_ORIGIN}/`);
    await waitForWorker(
      "main-to-patch service binding",
      mainWorker,
      `${LOCAL_MAIN_ORIGIN}/patches`,
    );

    runSuites(LOCAL_MAIN_ORIGIN);
  } finally {
    stopWorker(mainWorker);
    stopWorker(patchWorker);
  }
}

main().catch((error) => {
  console.error(`\n[testbed] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
