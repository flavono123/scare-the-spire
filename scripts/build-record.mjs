#!/usr/bin/env node
// Records which commit a Worker artifact (.patch-worker, .open-next) was built
// from, and checks that a reused artifact still matches the checkout.
//
//   node scripts/build-record.mjs begin <artifact-dir>   before the build reads sources
//   node scripts/build-record.mjs write <artifact-dir>   after the build
//   node scripts/build-record.mjs check <artifact-dir>...
//
// The record sits at the artifact root, outside the uploaded assets directory,
// so it never reaches Cloudflare. `begin` snapshots the checkout as the build
// starts, and `write` records a commit only when the checkout still matches
// that snapshot: a commit or edit that lands mid-build leaves an artifact built
// from the old sources under the new HEAD. The snapshot is kept under
// node_modules/.cache because OpenNext empties .open-next during its build.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BUILD_RECORD_FILE = "build-record.json";
const BUILD_START_DIR = path.join("node_modules", ".cache", "build-record");

// Where `begin` keeps the start snapshot of an artifact dir's build.
export function buildStartPath(artifactDir) {
  const resolved = path.resolve(artifactDir);
  const name = path.basename(resolved).replace(/^\.+/, "") || "artifact";
  return path.join(path.dirname(resolved), BUILD_START_DIR, `${name}.json`);
}

function errorMessage(cause) {
  return cause instanceof Error ? cause.message : String(cause);
}

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

function captureGitState() {
  try {
    return { state: readGitState() };
  } catch (cause) {
    return { error: errorMessage(cause) };
  }
}

function changeKey(change) {
  return `${change.status} ${change.hash ?? "-"}`;
}

// Tracked paths whose status or content differs between two git states.
function differingPaths(a, b) {
  const left = new Map(a.changes.map((change) => [change.path, changeKey(change)]));
  const right = new Map(b.changes.map((change) => [change.path, changeKey(change)]));
  return [...new Set([...left.keys(), ...right.keys()])]
    .filter((file) => left.get(file) !== right.get(file))
    .sort();
}

function hasCommit(state) {
  return typeof state?.head === "string" && Array.isArray(state.changes);
}

function shortSha(sha) {
  return typeof sha === "string" ? sha.slice(0, 10) : String(sha);
}

function listPaths(paths, limit = 8) {
  const shown = paths.slice(0, limit).join(", ");
  return paths.length > limit ? `${shown}, +${paths.length - limit} more` : shown;
}

// Snapshots the checkout before a build reads any sources, and drops the
// previous build's record, which no longer describes a finished artifact.
export function beginBuildRecord(artifactDir, { state } = {}) {
  const captured = state ? { state } : captureGitState();
  const snapshot = {
    startedAt: new Date().toISOString(),
    ...(captured.state ?? { head: null, error: captured.error }),
  };
  fs.rmSync(path.join(artifactDir, BUILD_RECORD_FILE), { force: true });
  const startPath = buildStartPath(artifactDir);
  fs.mkdirSync(path.dirname(startPath), { recursive: true });
  fs.writeFileSync(startPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

// Reads and removes the snapshot `begin` left for this artifact dir; null when
// there is none.
function takeBuildStart(artifactDir) {
  const startPath = buildStartPath(artifactDir);
  let snapshot = null;
  try {
    snapshot = JSON.parse(fs.readFileSync(startPath, "utf8"));
  } catch (cause) {
    if (cause?.code !== "ENOENT" && cause?.code !== "ENOTDIR") {
      snapshot = { head: null, error: `${startPath} is unreadable (${errorMessage(cause)})` };
    }
  }
  try {
    fs.rmSync(startPath, { force: true });
  } catch {
    // Nothing to consume when the snapshot dir itself is unusable.
  }
  return snapshot;
}

// Why the end-of-build checkout cannot vouch for the artifact, or null.
function buildStartProblem(artifactDir, start, end) {
  if (!start) {
    return `its build start was not recorded `
      + `(run node scripts/build-record.mjs begin ${artifactDir} before the build)`;
  }
  if (!hasCommit(start)) {
    return `git state was unreadable when its build started (${start.error ?? "no commit"})`;
  }
  const changed = differingPaths(start, end);
  if (start.head === end.head && changed.length === 0) return null;
  return `the checkout changed during its build, from ${describeBuildRecord(start)} `
    + `to ${describeBuildRecord(end)}`
    + (start.head === end.head ? ` (tracked files changed: ${listPaths(changed)})` : "");
}

// `start` defaults to the snapshot `begin` left; tests pass it (or null).
export function writeBuildRecord(artifactDir, options = {}) {
  const { state, env = process.env } = options;
  const start = "start" in options ? options.start : takeBuildStart(artifactDir);
  const end = state ? { state } : captureGitState();
  const error = end.error
    ? `git state was unreadable when its build ended (${end.error})`
    : buildStartProblem(artifactDir, start, end.state);
  const record = {
    head: error ? null : end.state.head,
    dirty: error ? null : end.state.dirty,
    changes: error ? null : end.state.changes,
    devTools: ["1", "true"].includes(env.NEXT_PUBLIC_ENABLE_DEV_TOOLS ?? ""),
    startedAt: start?.startedAt ?? null,
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
  if (!hasCommit(record)) {
    return {
      ok: false,
      reason: `${artifactDir} records no commit${record?.error ? `: ${record.error}` : ""}`,
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

  const differing = differingPaths(record, current);
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

// Fingerprint of a record's (or git state's) tree, for log lines.
export function describeBuildRecord(record) {
  if (!record.changes.length) return `${shortSha(record.head)} (clean)`;
  const digest = sha256(
    record.changes.map((change) => `${changeKey(change)} ${change.path}`).join("\n"),
  ).slice(0, 10);
  return `${shortSha(record.head)} + ${record.changes.length} uncommitted file(s) [${digest}]`;
}

function main(argv) {
  const [command, ...dirs] = argv;
  // begin and write never fail a build; a reuse check rejects a bad record instead.
  if (command === "begin" && dirs.length === 1) {
    try {
      const snapshot = beginBuildRecord(dirs[0]);
      if (snapshot.error) {
        console.warn(`[build-record] ${dirs[0]}: git state is unreadable (${snapshot.error})`);
      } else {
        console.log(`[build-record] ${dirs[0]} build starts from ${describeBuildRecord(snapshot)}`);
      }
    } catch (cause) {
      console.warn(`[build-record] ${dirs[0]}: could not record the build start (${errorMessage(cause)})`);
    }
    return 0;
  }
  if (command === "write" && dirs.length === 1) {
    if (!fs.existsSync(dirs[0])) {
      console.error(`[build-record] ${dirs[0]} does not exist`);
      return 1;
    }
    const record = writeBuildRecord(dirs[0]);
    if (record.error) {
      console.warn(
        `[build-record] ${dirs[0]} records no commit: ${record.error}. `
          + "Reusing it with --skip-build will be refused; rebuild it.",
      );
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
  console.error(
    "Usage: node scripts/build-record.mjs begin <artifact-dir> | write <artifact-dir> | check <artifact-dir>...",
  );
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
