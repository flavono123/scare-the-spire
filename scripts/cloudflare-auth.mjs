import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const WORKERS = {
  main: "scare-the-spire",
  patch: "scare-the-spire-patches",
};

export function workerNames(selection) {
  return selection === "all" ? Object.values(WORKERS) : [WORKERS[selection]];
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

function runWranglerWhoami() {
  const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return execFileSync(executable, ["exec", "wrangler", "whoami"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function resolveAuthentication() {
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
