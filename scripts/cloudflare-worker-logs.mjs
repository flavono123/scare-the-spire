#!/usr/bin/env node

import { resolveAuthentication, workerNames } from "./cloudflare-auth.mjs";

const DEFAULT_OUTCOMES = ["exceededCpu", "exceededMemory"];
const UNBOUNDED_ID_PREFIXES = [
  /^(\/(?:[a-z]{2}(?:-[0-9]+)?\/)?(?:this-or-that|transfigure|chemical-x|c-c-c-combo|history-course))\/[^/]+$/i,
  /^(\/defragment\/(?:chemical_x|combo|transfigure|this_or_that))\/[^/]+$/i,
];

function usage() {
  console.log(`Usage: pnpm cf:logs -- [options]

Query stored Workers Logs for a past window. This is an on-demand lookup,
not a collector. Logs on Workers Free are kept for three days.

Options:
  --hours <number>            Lookback window in hours (default: 24, max: 72)
  --from <iso>                Start timestamp (use with --to; overrides --hours)
  --to <iso>                  End timestamp
  --worker <main|patch|all>   Worker to inspect (default: main)
  --outcome <name>            Log outcome to include; repeatable
                              (default: exceededCpu, exceededMemory)
                              GraphQL metrics "exceededResources" maps to these
  --limit <number>            Max invocation events to fetch (default: 200, max: 2000)
  --json                      Print the redacted event list as JSON
  --help                      Show this help

Authentication:
  Prefers CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.
  Wrangler OAuth can authenticate metrics/tail but cannot query Workers Logs.
  For this command, create a Custom token with Account → Workers Observability → Write
  (log query permission; not Workers Scripts Edit / deploy).`);
}

function parseArgs(argv) {
  const options = {
    hours: 24,
    from: null,
    to: null,
    worker: "main",
    outcomes: [],
    limit: 200,
    json: false,
  };

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
    if (argument === "--hours") {
      options.hours = Number(argv[++index]);
      continue;
    }
    if (argument === "--from") {
      options.from = argv[++index];
      continue;
    }
    if (argument === "--to") {
      options.to = argv[++index];
      continue;
    }
    if (argument === "--worker") {
      options.worker = argv[++index];
      continue;
    }
    if (argument === "--outcome") {
      options.outcomes.push(argv[++index]);
      continue;
    }
    if (argument === "--limit") {
      options.limit = Number(argv[++index]);
      continue;
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  if (options.from && !options.to) throw new Error("--from requires --to");
  if (options.to && !options.from) throw new Error("--to requires --from");
  if (!options.from && (!Number.isFinite(options.hours) || options.hours <= 0 || options.hours > 72)) {
    throw new Error("--hours must be a number between 0 and 72");
  }
  if (!["main", "patch", "all"].includes(options.worker)) {
    throw new Error("--worker must be main, patch, or all");
  }
  if (!Number.isFinite(options.limit) || options.limit <= 0 || options.limit > 2000) {
    throw new Error("--limit must be a number between 1 and 2000");
  }
  if (options.outcomes.length === 0) options.outcomes = [...DEFAULT_OUTCOMES];
  return options;
}

function timeframe(options) {
  if (options.from) {
    const from = Date.parse(options.from);
    const to = Date.parse(options.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      throw new Error("--from and --to must be ISO timestamps");
    }
    if (from >= to) throw new Error("--from must be earlier than --to");
    return { from, to };
  }
  const to = Date.now();
  return { from: to - options.hours * 60 * 60 * 1000, to };
}

function redactPathname(pathname) {
  let value = (pathname || "/").split("?")[0] || "/";
  value = value.replace(/\/REDACTED(?=\/|$)/g, "/{id}");
  value = value.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
    "/{id}",
  );
  for (const pattern of UNBOUNDED_ID_PREFIXES) {
    value = value.replace(pattern, "$1/{id}");
  }
  return value;
}

function summarizeEvent(event) {
  const workers = event.$workers ?? {};
  const request = workers.event?.request ?? {};
  const method = request.method ?? "GET";
  const rawUrl = request.url ?? "";
  let pathname = "/";
  let rsc = false;

  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      pathname = url.pathname;
      rsc = url.searchParams.has("_rsc");
    } catch {
      pathname = rawUrl.split("?")[0] || "/";
      rsc = /[?&]_rsc=/.test(rawUrl);
    }
  } else if (event.$metadata?.trigger) {
    const parts = String(event.$metadata.trigger).split(" ");
    pathname = parts.slice(1).join(" ") || "/";
  }

  const path = redactPathname(pathname);
  return {
    time: event.timestamp,
    service: event.$metadata?.service ?? workers.scriptName,
    outcome: workers.outcome ?? null,
    trigger: `${method} ${path}`,
    path,
    method,
    rsc,
    status: workers.event?.response?.status ?? null,
    cpuTimeMs: workers.cpuTimeMs ?? null,
    wallTimeMs: workers.wallTimeMs ?? null,
    scriptVersion: workers.scriptVersion?.id ?? null,
    requestId: workers.requestId ?? event.$metadata?.requestId ?? null,
  };
}

function observabilityErrorMessage(status, payload) {
  const apiMessage = payload?.errors?.map((error) => error.message).join("; ") || `HTTP ${status}`;
  if (status === 403) {
    return `Workers Logs query returned 403 (${apiMessage}).
Wrangler OAuth cannot call this API. Create a Custom token with Account → Workers Observability → Write
(log query permission, not Workers Scripts Edit / deploy), then set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.`;
  }
  return `Workers Logs query failed: ${apiMessage}`;
}

async function queryLogs(authentication, body) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${authentication.accountId}/workers/observability/telemetry/query`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authentication.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) {
    throw new Error(observabilityErrorMessage(response.status, payload));
  }
  return payload.result;
}

function extractEvents(result) {
  if (Array.isArray(result)) return result;
  const events = result?.events?.events ?? result?.events;
  return Array.isArray(events) ? events : [];
}

function outcomeFilters(outcomes) {
  if (outcomes.length === 1) {
    return [{ key: "$workers.outcome", operation: "eq", type: "string", value: outcomes[0] }];
  }
  return [{ key: "$workers.outcome", operation: "in", type: "string", value: outcomes.join(",") }];
}

async function loadEvents(authentication, service, options, window) {
  const events = [];
  let offset;
  while (events.length < options.limit) {
    const remaining = options.limit - events.length;
    const result = await queryLogs(authentication, {
      queryId: `cf-logs-${service}`,
      dry: true,
      view: "events",
      limit: Math.min(remaining, 200),
      timeframe: {
        from: new Date(window.from).toISOString(),
        to: new Date(window.to).toISOString(),
      },
      parameters: {
        datasets: ["cloudflare-workers"],
        filterCombination: "and",
        filters: [
          { key: "$metadata.service", operation: "eq", type: "string", value: service },
          ...outcomeFilters(options.outcomes),
        ],
      },
      ...(offset ? { offset, offsetDirection: "next" } : {}),
    });
    const rows = extractEvents(result);
    if (rows.length === 0) break;
    events.push(...rows);
    const lastId = rows.at(-1)?.$metadata?.id;
    if (!lastId || rows.length < Math.min(remaining, 200)) break;
    offset = lastId;
  }
  return events.slice(0, options.limit);
}

function aggregate(events) {
  const groups = new Map();
  for (const event of events) {
    const key = `${event.outcome ?? "unknown"} ${event.trigger}`;
    const group = groups.get(key) ?? {
      outcome: event.outcome,
      trigger: event.trigger,
      count: 0,
      rsc: 0,
      cpu: [],
      statuses: new Map(),
    };
    group.count += 1;
    if (event.rsc) group.rsc += 1;
    if (Number.isFinite(event.cpuTimeMs)) group.cpu.push(event.cpuTimeMs);
    if (event.status != null) {
      group.statuses.set(event.status, (group.statuses.get(event.status) ?? 0) + 1);
    }
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      group.cpu.sort((left, right) => left - right);
      const p50 = group.cpu[Math.floor((group.cpu.length - 1) * 0.5)] ?? null;
      const status = [...group.statuses.entries()].map(([code, count]) => `${code}×${count}`).join(" ") || "-";
      return { ...group, cpuP50: p50, status };
    })
    .sort((left, right) => right.count - left.count || left.trigger.localeCompare(right.trigger));
}

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}

function printLogs(services, options, window, authSource) {
  console.log(
    `Cloudflare Workers logs · ${formatTimestamp(window.from)} – ${formatTimestamp(window.to)} · auth: ${authSource}`,
  );
  console.log(`Outcomes: ${options.outcomes.join(", ")}`);

  for (const { service, events } of services) {
    const redacted = events.map(summarizeEvent);
    console.log(`\n${service}`);
    if (redacted.length === 0) {
      console.log("  no matching invocation logs");
      continue;
    }
    console.log(`  events=${redacted.length}`);
    for (const group of aggregate(redacted)) {
      const rsc = group.rsc > 0 ? ` rsc=${group.rsc}` : "";
      const cpu = group.cpuP50 == null ? "-" : `${group.cpuP50}ms`;
      console.log(
        `  ${String(group.count).padStart(4)}  ${String(group.outcome ?? "-").padEnd(14)}  ${group.trigger}  cpu-p50=${cpu}  status=${group.status}${rsc}`,
      );
    }
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  const authentication = resolveAuthentication();
  const window = timeframe(options);
  const services = [];
  for (const service of workerNames(options.worker)) {
    const events = await loadEvents(authentication, service, options, window);
    services.push({ service, events });
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          timeframe: window,
          outcomes: options.outcomes,
          services: services.map(({ service, events }) => ({
            service,
            events: events.map(summarizeEvent),
          })),
        },
        null,
        2,
      ),
    );
  } else {
    printLogs(services, options, window, authentication.source);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
