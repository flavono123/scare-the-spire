#!/usr/bin/env node
/**
 * `wrangler dev` for the main Worker's large static asset directory.
 *
 * `wrangler dev` watches the assets directory with one kqueue descriptor per
 * file on macOS. Past ~10k assets the descriptors exceed OPEN_MAX and spawning
 * workerd fails with EBADF, so on macOS it polls (stat-based, no descriptors)
 * instead. CHOKIDAR_INTERVAL slows polling of text files only: Wrangler's
 * chokidar keeps a fixed 300 ms binaryInterval for images, fonts, and audio.
 * Other platforms keep native watching.
 *
 * Usage: node scripts/wrangler-dev-assets.mjs [wrangler dev options]
 */
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export const DEV_ASSET_WATCH_ENV = process.platform === "darwin"
  ? { CHOKIDAR_USEPOLLING: "1", CHOKIDAR_INTERVAL: "3600000" }
  : {};

function main() {
  const child = spawn(
    process.platform === "win32" ? "wrangler.cmd" : "wrangler",
    ["dev", ...process.argv.slice(2)],
    { env: { ...process.env, ...DEV_ASSET_WATCH_ENV }, stdio: "inherit" },
  );
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.once("error", (error) => {
    console.error(error);
    process.exit(1);
  });
  child.once("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
