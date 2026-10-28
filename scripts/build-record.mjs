#!/usr/bin/env node
// Records which commit a Worker artifact (.patch-worker, .open-next) was built
// from, and checks that a reused artifact still matches the checkout.
//
//   node scripts/build-record.mjs write <artifact-dir>
//   node scripts/build-record.mjs check <artifact-dir>...
//
// The record sits at the artifact root, outside the uploaded assets directory,
// so it never reaches Cloudflare.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BUILD_RECORD_FILE = "build-record.json";

function git(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr.trim() || `exit ${result.status}`}`);
  }
  return result.stdout;
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

// Content hash of a working-tree path; symlinks hash their target string.
function hashPath(file) {
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) return `link:${sha256(fs.readlinkSync(file))}`;
    if (!stat.isFile()) return "not-a-file";
    return sha256(fs.readFileSync(file));
  } catch {
    return "missing";
  }
}

// HEAD plus the content of every tracked file that differs from HEAD
// (staged or not). Untracked files are ignored.
export function readGitState(cwd = process.cwd()) {
  const top = git(["rev-parse", "--show-toplevel"], cwd).trim();
  const head = git(["rev-parse", "HEAD"], top).trim();
  const fields = git(["diff", "HEAD", "--name-status", "--no-renames", "-z"], top)
    .split("\0")
    .filter(Boolean);
  const changes = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    const [status, file] = [fields[index], fields[index + 1]];
    changes.push({
      status,
      path: file,
      hash: status === "D" ? null : hashPath(path.join(top, file)),
    });
  }
  changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { head, dirty: changes.length > 0, changes };
}

function changeKey(change) {
  return `${change.status} ${change.hash ?? "-"}`;
}

function shortSha(sha) {
  return typeof sha === "string" ? sha.slice(0, 10) : String(sha);
}

function listPaths(paths, limit = 8) {
  const shown = paths.slice(0, limit).join(", ");
  return paths.length > limit ? `${shown}, +${paths.length - limit} more` : shown;
}

export function writeBuildRecord(artifactDir, { state, env = process.env } = {}) {
  let gitState = state;
  let error = null;
  if (!gitState) {
    try {
      gitState = readGitState();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }
  const record = {
    head: gitState?.head ?? null,
    dirty: gitState?.dirty ?? null,
    changes: gitState?.changes ?? null,
    devTools: ["1", "true"].includes(env.NEXT_PUBLIC_ENABLE_DEV_TOOLS ?? ""),
    builtAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
  fs.writeFileSync(
    path.join(artifactDir, BUILD_RECORD_FILE),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  return record;
}

// Returns { ok: true, record } when the artifact was built from the current
// HEAD and working tree, otherwise { ok: false, reason }.
export function checkBuildRecord(artifactDir, { state } = {}) {
  if (!fs.existsSync(artifactDir)) {
    return { ok: false, reason: `${artifactDir} does not exist` };
  }
  const recordPath = path.join(artifactDir, BUILD_RECORD_FILE);
  if (!fs.existsSync(recordPath)) {
    return {
      ok: false,
      reason: `${artifactDir} has no ${BUILD_RECORD_FILE}, so its source commit is unknown`,
    };
  }

  let record;
  try {
    record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  } catch (cause) {
    return {
      ok: false,
      reason: `${recordPath} is unreadable (${cause instanceof Error ? cause.message : cause})`,
    };
  }
  if (typeof record?.head !== "string" || !Array.isArray(record.changes)) {
    return {
      ok: false,
      reason: `${artifactDir} records no commit${record?.error ? ` (${record.error})` : ""}`,
    };
  }
  if (record.devTools) {
    return {
      ok: false,
      reason: `${artifactDir} was built with NEXT_PUBLIC_ENABLE_DEV_TOOLS (pnpm dev or a preview build)`,
    };
  }

  const current = state ?? readGitState();
  if (record.head !== current.head) {
    return {
      ok: false,
      reason: `${artifactDir} was built from ${shortSha(record.head)}, but HEAD is ${shortSha(current.head)}`,
    };
  }

  const built = new Map(record.changes.map((change) => [change.path, changeKey(change)]));
  const now = new Map(current.changes.map((change) => [change.path, changeKey(change)]));
  const differing = [...new Set([...built.keys(), ...now.keys()])]
    .filter((file) => built.get(file) !== now.get(file))
    .sort();
  if (differing.length > 0) {
    const builtAs = record.changes.length > 0 ? "uncommitted changes" : "a clean tree";
    return {
      ok: false,
      reason: `${artifactDir} was built from ${shortSha(record.head)} with ${builtAs}, `
        + `and tracked files changed since: ${listPaths(differing)}`,
    };
  }

  return { ok: true, record };
}

// Fingerprint of a record's tree state, for log lines.
export function describeBuildRecord(record) {
  if (!record.changes.length) return `${shortSha(record.head)} (clean)`;
  const digest = sha256(
    record.changes.map((change) => `${changeKey(change)} ${change.path}`).join("\n"),
  ).slice(0, 10);
  return `${shortSha(record.head)} + ${record.changes.length} uncommitted file(s) [${digest}]`;
}

function main(argv) {
  const [command, ...dirs] = argv;
  if (command === "write" && dirs.length === 1) {
    if (!fs.existsSync(dirs[0])) {
      console.error(`[build-record] ${dirs[0]} does not exist`);
      return 1;
    }
    const record = writeBuildRecord(dirs[0]);
    if (record.error) {
      // Never fail a build over the record; a reuse check will reject it instead.
      console.warn(`[build-record] ${dirs[0]}: could not read git state (${record.error})`);
    } else {
      console.log(`[build-record] ${dirs[0]} built from ${describeBuildRecord(record)}`);
    }
    return 0;
  }
  if (command === "check" && dirs.length > 0) {
    let failed = false;
    for (const dir of dirs) {
      const result = checkBuildRecord(dir);
      if (result.ok) {
        console.log(`[build-record] ${dir} is fresh: ${describeBuildRecord(result.record)}`);
      } else {
        failed = true;
        console.error(`[build-record] stale: ${result.reason}`);
      }
    }
    return failed ? 1 : 0;
  }
  console.error("Usage: node scripts/build-record.mjs write <artifact-dir> | check <artifact-dir>...");
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
