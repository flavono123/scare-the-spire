#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const WORKERS = {
  main: "scare-the-spire",
  patch: "scare-the-spire-patches",
};

function usage() {
  console.log(`Usage: pnpm cf:metrics -- [options]

Options:
  --hours <number>          Lookback window in hours (default: 24, max: 720)
  --worker <main|patch|all> Worker to inspect (default: all)
  --hourly                  Rank KST hours and two-hour windows by request volume
  --json                    Print the raw query result as JSON
  --help                    Show this help

Authentication:
  Uses CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID when set.
  Otherwise reuses the local Wrangler OAuth login without printing the token.`);
}

function parseArgs(argv) {
  const options = { hours: 24, worker: "all", hourly: false, json: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--help") {
      usage();
      process.exit(0);
    }
    if (argument === "--json") {
      options.json = true;
      continue;
    }
    if (argument === "--hourly") {
      options.hourly = true;
      continue;
    }
    if (argument === "--hours") {
      options.hours = Number(argv[++index]);
      continue;
    }
    if (argument === "--worker") {
      options.worker = argv[++index];
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  if (!Number.isFinite(options.hours) || options.hours <= 0 || options.hours > 720) {
    throw new Error("--hours must be a number between 0 and 720");
  }
  if (!["main", "patch", "all"].includes(options.worker)) {
    throw new Error("--worker must be main, patch, or all");
  }

  return options;
}

function runWranglerWhoami() {
  const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return execFileSync(executable, ["exec", "wrangler", "whoami"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function wranglerConfigPaths() {
  const home = homedir();
  return [
    process.env.WRANGLER_HOME && path.join(process.env.WRANGLER_HOME, "config", "default.toml"),
    process.env.XDG_CONFIG_HOME && path.join(process.env.XDG_CONFIG_HOME, ".wrangler", "config", "default.toml"),
    path.join(home, "Library", "Preferences", ".wrangler", "config", "default.toml"),
    path.join(home, ".config", ".wrangler", "config", "default.toml"),
  ].filter(Boolean);
}

function readWranglerOauthToken() {
  for (const configPath of wranglerConfigPaths()) {
    if (!existsSync(configPath)) continue;
    const config = readFileSync(configPath, "utf8");
    const match = config.match(/^oauth_token\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  }
  return null;
}

function resolveAuthentication() {
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    return {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
      source: "environment",
    };
  }

  let whoami;
  try {
    whoami = runWranglerWhoami();
  } catch {
    throw new Error(
      "Cloudflare authentication is unavailable. Run `pnpm exec wrangler login` or set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.",
    );
  }

  const accountIds = [...new Set(whoami.match(/\b[a-f0-9]{32}\b/gi) ?? [])];
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? (accountIds.length === 1 ? accountIds[0] : null);
  const token = process.env.CLOUDFLARE_API_TOKEN ?? readWranglerOauthToken();

  if (!accountId) {
    throw new Error("Could not choose a Cloudflare account. Set CLOUDFLARE_ACCOUNT_ID explicitly.");
  }
  if (!token) {
    throw new Error("Could not read the Wrangler OAuth token. Run `pnpm exec wrangler login` again.");
  }

  return { accountId, token, source: "wrangler" };
}

async function queryGraphql(token, query, variables) {
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();

  if (!response.ok || payload.errors?.length) {
    const messages = payload.errors?.map((error) => error.message).join("; ") || `HTTP ${response.status}`;
    throw new Error(`Cloudflare GraphQL query failed: ${messages}`);
  }

  return payload.data.viewer.accounts[0]?.workersInvocationsAdaptive ?? [];
}

function workerNames(selection) {
  return selection === "all" ? Object.values(WORKERS) : [WORKERS[selection]];
}

function workerFilter(names) {
  return names.map((name) => JSON.stringify(name)).join(", ");
}

async function loadMetrics(authentication, options) {
  const names = workerNames(options.worker);
  const from = new Date(Date.now() - options.hours * 60 * 60 * 1000).toISOString();
  const to = new Date().toISOString();
  const variables = { accountTag: authentication.accountId, from, to };
  const namesFilter = workerFilter(names);

  const aggregateQuery = `
    query WorkerMetrics($accountTag: string, $from: string, $to: string) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 100
            filter: {
              scriptName_in: [${namesFilter}]
              datetime_geq: $from
              datetime_leq: $to
            }
          ) {
            dimensions { scriptName status }
            sum { errors requests subrequests }
            quantiles { cpuTimeP50 cpuTimeP99 wallTimeP50 wallTimeP99 }
          }
        }
      }
    }
  `;
  const timelineQuery = `
    query WorkerErrorTimeline($accountTag: string, $from: string, $to: string) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 5000
            orderBy: [datetimeMinute_ASC]
            filter: {
              scriptName_in: [${namesFilter}]
              status_neq: "success"
              datetime_geq: $from
              datetime_leq: $to
            }
          ) {
            dimensions { datetimeMinute scriptName status }
            sum { errors requests subrequests }
            quantiles { cpuTimeP50 cpuTimeP99 wallTimeP50 wallTimeP99 }
          }
        }
      }
    }
  `;
  const hourlyQuery = `
    query WorkerHourlyTraffic($accountTag: string, $from: string, $to: string) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 5000
            orderBy: [datetimeHour_ASC]
            filter: {
              scriptName_in: [${namesFilter}]
              datetime_geq: $from
              datetime_leq: $to
            }
          ) {
            dimensions { datetimeHour scriptName }
            sum { requests }
          }
        }
      }
    }
  `;

  const [aggregate, timeline, hourly] = await Promise.all([
    queryGraphql(authentication.token, aggregateQuery, variables),
    queryGraphql(authentication.token, timelineQuery, variables),
    options.hourly
      ? queryGraphql(authentication.token, hourlyQuery, variables)
      : Promise.resolve([]),
  ]);

  return { aggregate, timeline, hourly, timeframe: { from, to }, authSource: authentication.source };
}

function formatDuration(microseconds) {
  if (!Number.isFinite(microseconds)) return "-";
  return `${(microseconds / 1000).toFixed(3)}ms`;
}

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}

function kstHour(timestamp) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Seoul",
    }).format(new Date(timestamp)),
  ) % 24;
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function summarizeHourlyTraffic(result) {
  const start = new Date(result.timeframe.from);
  start.setUTCMinutes(0, 0, 0);
  if (start < new Date(result.timeframe.from)) {
    start.setUTCHours(start.getUTCHours() + 1);
  }
  const end = new Date(result.timeframe.to);
  end.setUTCMinutes(0, 0, 0);

  const requestByUtcHour = new Map();
  for (const row of result.hourly) {
    const key = new Date(row.dimensions.datetimeHour).toISOString();
    requestByUtcHour.set(key, (requestByUtcHour.get(key) ?? 0) + row.sum.requests);
  }

  const totals = Array.from({ length: 24 }, () => ({ requests: 0, samples: 0 }));
  for (let cursor = start; cursor < end; cursor = new Date(cursor.getTime() + 60 * 60 * 1000)) {
    const hour = kstHour(cursor);
    totals[hour].requests += requestByUtcHour.get(cursor.toISOString()) ?? 0;
    totals[hour].samples += 1;
  }

  const hours = totals.map((total, hour) => ({
    hour,
    average: total.samples > 0 ? total.requests / total.samples : 0,
    requests: total.requests,
    samples: total.samples,
  }));
  const windows = hours.map((current, hour) => {
    const next = hours[(hour + 1) % 24];
    return {
      hour,
      average: (current.average + next.average) / 2,
    };
  });

  hours.sort((left, right) => left.average - right.average || left.hour - right.hour);
  windows.sort((left, right) => left.average - right.average || left.hour - right.hour);
  return { hours, windows };
}

function printHourlyTraffic(result) {
  const summary = summarizeHourlyTraffic(result);
  console.log("\nQuiet traffic windows (Asia/Seoul, full hours only)");
  for (const window of summary.windows.slice(0, 5)) {
    console.log(
      `  ${formatHour(window.hour)}-${formatHour((window.hour + 2) % 24)}  ` +
        `avg=${window.average.toFixed(1)} requests/hour`,
    );
  }

  console.log("\nLowest individual hours (Asia/Seoul)");
  for (const hour of summary.hours.slice(0, 8)) {
    console.log(
      `  ${formatHour(hour.hour)}-${formatHour((hour.hour + 1) % 24)}  ` +
        `avg=${hour.average.toFixed(1)} requests/hour (${hour.samples} samples)`,
    );
  }
}

function printMetrics(result, options) {
  console.log(`Cloudflare Workers metrics · last ${options.hours}h · auth: ${result.authSource}`);

  const grouped = Map.groupBy(result.aggregate, (row) => row.dimensions.scriptName);
  for (const name of workerNames(options.worker)) {
    console.log(`\n${name}`);
    const rows = grouped.get(name) ?? [];
    if (rows.length === 0) {
      console.log("  no invocations");
      continue;
    }

    rows.sort((left, right) => {
      if (left.dimensions.status === "success") return 1;
      if (right.dimensions.status === "success") return -1;
      return left.dimensions.status.localeCompare(right.dimensions.status);
    });
    for (const row of rows) {
      const { status } = row.dimensions;
      const { errors, requests, subrequests } = row.sum;
      const { cpuTimeP50, cpuTimeP99, wallTimeP50, wallTimeP99 } = row.quantiles;
      console.log(
        `  ${status.padEnd(22)} requests=${requests} errors=${errors} subrequests=${subrequests} ` +
          `cpu(p50/p99)=${formatDuration(cpuTimeP50)}/${formatDuration(cpuTimeP99)} ` +
          `wall(p50/p99)=${formatDuration(wallTimeP50)}/${formatDuration(wallTimeP99)}`,
      );
    }
  }

  const errorRows = result.timeline.filter((row) => row.sum.errors > 0);
  console.log("\nError timeline (one row per minute)");
  if (errorRows.length === 0) {
    console.log("  no Worker invocation errors");
  } else {
    for (const row of errorRows) {
      console.log(
        `  ${formatTimestamp(row.dimensions.datetimeMinute)}  ${row.dimensions.scriptName}  ` +
          `${row.dimensions.status}  requests=${row.sum.requests} errors=${row.sum.errors} ` +
          `cpu-p99=${formatDuration(row.quantiles.cpuTimeP99)}`,
      );
    }
  }

  if (options.hourly) {
    printHourlyTraffic(result);
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  const authentication = resolveAuthentication();
  const result = await loadMetrics(authentication, options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printMetrics(result, options);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
