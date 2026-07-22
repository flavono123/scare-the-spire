#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";

const LOCAL_MAIN_ORIGIN = "http://127.0.0.1:8787";
const LOCAL_PATCH_ORIGIN = "http://127.0.0.1:8788";

function usage() {
  console.log(`Usage: pnpm cf:phase4 -- [options]

Options:
  --origin <url>   Test an already-running preview without building or starting Workers
  --skip-build     Reuse existing .open-next and .patch-worker artifacts
  --help           Show this help`);
}

function parseArgs(argv) {
  const options = { origin: "", skipBuild: false };
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
    if (argument === "--skip-build") {
      options.skipBuild = true;
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

function executable(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(label, command, args, env = process.env) {
  console.log(`\n[phase4] ${label}`);
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

function startWorker(label, config, port) {
  console.log(`\n[phase4] starting ${label} on port ${port}`);
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
    ],
    {
      cwd: process.cwd(),
      env: process.env,
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
        console.log(`[phase4] ${label} ready · ${url} · HTTP ${response.status}`);
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

function runSuites(origin) {
  run("production-shaped route smoke", "pnpm", [
    "cf:smoke",
    "--",
    "--origin",
    origin,
    "--scope",
    "all",
  ]);
  run(
    "browser behavior and mobile QA",
    "pnpm",
    ["qa:cf:phase4"],
    { ...process.env, BASE_URL: origin, CF_PHASE4_ORIGIN: origin },
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.origin) {
    runSuites(options.origin);
    return;
  }

  if (!options.skipBuild) {
    run("build main Worker artifact", "pnpm", ["cf:build"]);
    run("build static patch Worker artifact", "pnpm", ["patch:build"]);
  }

  let patchWorker;
  let mainWorker;
  try {
    patchWorker = startWorker("patch-worker", "wrangler.patch.jsonc", 8788);
    await waitForWorker("patch Worker", patchWorker, `${LOCAL_PATCH_ORIGIN}/patches`);

    mainWorker = startWorker("main-worker", "wrangler.jsonc", 8787);
    await waitForWorker("main Worker", mainWorker, `${LOCAL_MAIN_ORIGIN}/`);
    await waitForWorker(
      "main-to-patch service binding",
      mainWorker,
      `${LOCAL_MAIN_ORIGIN}/patches/changes`,
    );

    runSuites(LOCAL_MAIN_ORIGIN);
  } finally {
    stopWorker(mainWorker);
    stopWorker(patchWorker);
  }
}

main().catch((error) => {
  console.error(`\n[phase4] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
