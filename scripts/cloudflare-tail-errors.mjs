#!/usr/bin/env node

import { spawn } from "node:child_process";

const WORKERS = {
  main: "scare-the-spire",
  patch: "scare-the-spire-patches",
};

function usage() {
  console.log(`Usage: pnpm cf:errors -- [options]

Options:
  --worker <main|patch>  Worker to tail (default: main)
  --all                  Show successful requests too (default: errors only)
  --format <pretty|json> Wrangler output format (default: pretty)
  --ip <address|self>    Filter by client IP; do not use self for a phone
  --method <method>      Filter by HTTP method; repeatable
  --search <text>        Filter console messages by text
  --header <name:value>  Filter requests by a diagnostic header
  --version-id <id>      Filter a specific deployed Worker version
  --sampling-rate <0-1>  Limit the fraction of matching requests
  --help                 Show this help

Keep this command running, reproduce the issue, then press Ctrl-C.`);
}

function parseArgs(argv) {
  const options = { worker: "main", all: false, format: "pretty", forwarded: [] };
  const valueOptions = new Set([
    "--ip",
    "--method",
    "--search",
    "--header",
    "--version-id",
    "--sampling-rate",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--help") {
      usage();
      process.exit(0);
    }
    if (argument === "--all") {
      options.all = true;
      continue;
    }
    if (argument === "--worker") {
      options.worker = argv[++index];
      continue;
    }
    if (argument === "--format") {
      options.format = argv[++index];
      continue;
    }
    if (valueOptions.has(argument)) {
      const value = argv[++index];
      if (!value) throw new Error(`${argument} requires a value`);
      options.forwarded.push(argument, value);
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  if (!WORKERS[options.worker]) throw new Error("--worker must be main or patch");
  if (!["pretty", "json"].includes(options.format)) throw new Error("--format must be pretty or json");
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const argumentsForWrangler = [
    "exec",
    "wrangler",
    "tail",
    WORKERS[options.worker],
    "--format",
    options.format,
    ...(!options.all ? ["--status", "error"] : []),
    ...options.forwarded,
  ];

  console.log(`Tailing ${WORKERS[options.worker]} (${options.all ? "all invocations" : "errors only"})...`);
  console.log("Reproduce the issue now. Press Ctrl-C to stop.\n");

  const child = spawn(executable, argumentsForWrangler, { stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exitCode = code ?? 1;
  });
  child.on("error", (error) => {
    console.error(`Could not start Wrangler: ${error.message}`);
    process.exitCode = 1;
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
