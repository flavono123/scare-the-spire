import http from "node:http";
import net from "node:net";
import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { execFileSync, spawn, spawnSync } from "node:child_process";

const root = process.cwd();
const preferredProxyPort = Number(process.env.PORT ?? 3000);
const preferredMainPort = Number(process.env.MAIN_DEV_PORT ?? 3001);
let proxyPort = preferredProxyPort;
let mainPort = preferredMainPort;
const patchAssetsDir = path.join(root, ".patch-worker/assets");
const portReclaimTimeoutMs = Number(process.env.DEV_PORT_RECLAIM_TIMEOUT_MS ?? 4000);
const portSearchLimit = 50;

function listeningPids(port) {
  try {
    const output = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    }).trim();
    if (!output) return [];
    return [...new Set(output.split(/\s+/).map(Number).filter(Boolean))];
  } catch {
    return [];
  }
}

function processCwd(pid) {
  try {
    const output = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
      encoding: "utf8",
    });
    const line = output.split("\n").find((entry) => entry.startsWith("n"));
    return line ? line.slice(1) : "";
  } catch {
    return "";
  }
}

function processCommand(pid) {
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function isThisProjectListener(pid) {
  const cwd = processCwd(pid);
  if (cwd === root || cwd.startsWith(`${root}/`)) return true;

  const command = processCommand(pid);
  return command.includes(root);
}

function childPids(pid) {
  try {
    const output = execFileSync("pgrep", ["-P", String(pid)], {
      encoding: "utf8",
    }).trim();
    if (!output) return [];
    return output.split(/\s+/).map(Number).filter(Boolean);
  } catch {
    return [];
  }
}

function killPid(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch {
    // Already gone.
  }
}

function killProcessTree(pid, signal) {
  for (const child of childPids(pid)) {
    killProcessTree(child, signal);
  }
  killPid(pid, signal);
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitUntilPortFree(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (listeningPids(port).length === 0) return true;
    sleepSync(100);
  }
  return listeningPids(port).length === 0;
}

function reclaimOurListener(port) {
  const ours = listeningPids(port).filter(isThisProjectListener);
  if (ours.length === 0) return false;

  console.log(
    `Reclaiming leftover scare-the-spire listener on port ${port} (pid ${ours.join(", ")})`,
  );
  for (const pid of ours) {
    killProcessTree(pid, "SIGTERM");
  }
  if (waitUntilPortFree(port, portReclaimTimeoutMs)) return true;

  for (const pid of listeningPids(port).filter(isThisProjectListener)) {
    killProcessTree(pid, "SIGKILL");
  }
  return waitUntilPortFree(port, 1000);
}

function canBindPort(port) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once("error", (error) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(false);
        return;
      }
      reject(error);
    });
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port);
  });
}

async function allocatePort(preferred, reserved) {
  reclaimOurListener(preferred);
  for (let offset = 0; offset < portSearchLimit; offset += 1) {
    const port = preferred + offset;
    if (reserved.has(port)) continue;
    if (await canBindPort(port)) {
      if (port !== preferred) {
        console.log(`Port ${preferred} is in use; using ${port} instead`);
      }
      return port;
    }
    reclaimOurListener(port);
    if (!reserved.has(port) && (await canBindPort(port))) {
      if (port !== preferred) {
        console.log(`Port ${preferred} is in use; using ${port} instead`);
      }
      return port;
    }
  }
  throw new Error(`No free TCP port found in ${preferred}–${preferred + portSearchLimit - 1}`);
}

function runInitialPatchBuild() {
  const result = spawnSync("pnpm", ["patch:build"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_ENABLE_DEV_TOOLS: "1",
    },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function startMainDev() {
  return spawn("pnpm", ["exec", "next", "dev", "--port", String(mainPort)], {
    cwd: root,
    stdio: "inherit",
    detached: true,
    env: {
      ...process.env,
      PORT: String(mainPort),
    },
  });
}

function isResourcePatchHistoryRoute(pathname) {
  return /^\/(?:[^/]+\/)?patches\/changes\/?$/.test(pathname);
}

function isPatchRoute(pathname) {
  if (isResourcePatchHistoryRoute(pathname)) return false;

  return (
    pathname === "/patches" ||
    pathname.startsWith("/patches/") ||
    pathname === "/_patches" ||
    pathname.startsWith("/_patches/") ||
    /^\/[^/]+\/patches(?:\/|$)/.test(pathname)
  );
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function assetPathForRequest(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.startsWith("/_patches/")
    ? decoded.slice(1)
    : path.join(decoded.replace(/\/$/, "").slice(1), "index.html");
  return path.normalize(path.join(patchAssetsDir, relative));
}

async function servePatchAsset(req, res, pathname) {
  const filePath = assetPathForRequest(pathname);
  if (!filePath.startsWith(patchAssetsDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("Not a file");
    res.writeHead(200, {
      "content-type": contentType(filePath),
      "content-length": stat.size,
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

function proxyToMain(req, res) {
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: mainPort,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Main dev server unavailable: ${error.message}`);
  });
  req.pipe(upstream);
}

function writeResponseHead(socket, response) {
  socket.write(
    `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}\r\n`,
  );
  for (let index = 0; index < response.rawHeaders.length; index += 2) {
    socket.write(`${response.rawHeaders[index]}: ${response.rawHeaders[index + 1]}\r\n`);
  }
  socket.write("\r\n");
}

function proxyUpgradeToMain(req, socket, head) {
  const upstreamReq = http.request({
    hostname: "127.0.0.1",
    port: mainPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
    },
  });

  upstreamReq.on("upgrade", (upstreamRes, upstreamSocket, upstreamHead) => {
    writeResponseHead(socket, upstreamRes);
    if (upstreamHead.length > 0) socket.write(upstreamHead);
    if (head.length > 0) upstreamSocket.write(head);

    const closeBoth = () => {
      upstreamSocket.destroy();
      socket.destroy();
    };

    socket.on("error", closeBoth);
    upstreamSocket.on("error", closeBoth);
    socket.on("close", () => upstreamSocket.destroy());
    upstreamSocket.on("close", () => socket.destroy());

    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });

  upstreamReq.on("response", (upstreamRes) => {
    writeResponseHead(socket, upstreamRes);
    upstreamRes.pipe(socket);
  });

  upstreamReq.on("error", () => {
    if (socket.writable) {
      socket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
    }
    socket.destroy();
  });

  upstreamReq.end();
}

reclaimOurListener(preferredProxyPort);
reclaimOurListener(preferredMainPort);
runInitialPatchBuild();

let mainDev;
let shuttingDown = false;

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `localhost:${proxyPort}`}`);
  if (isPatchRoute(url.pathname)) {
    void servePatchAsset(req, res, url.pathname);
    return;
  }
  proxyToMain(req, res);
});

function listenProxy(port) {
  proxyPort = port;
  server.listen(port);
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const nextPort = proxyPort + 1 === mainPort ? proxyPort + 2 : proxyPort + 1;
    if (nextPort < preferredProxyPort + portSearchLimit) {
      console.log(`Port ${proxyPort} is in use; trying ${nextPort}`);
      setImmediate(() => listenProxy(nextPort));
      return;
    }
  }
  console.error(`Failed to bind patch/main dev proxy on port ${proxyPort}: ${error.message}`);
  shutdown(1);
});

server.on("listening", () => {
  console.log(`Patch/main dev proxy listening on http://localhost:${proxyPort}`);
  console.log(`Main Next dev server listening on http://localhost:${mainPort}`);
});

void (async () => {
  try {
    proxyPort = await allocatePort(preferredProxyPort, new Set());
    mainPort = await allocatePort(preferredMainPort, new Set([proxyPort]));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  mainDev = startMainDev();
  mainDev.on("error", (error) => {
    console.error(`Failed to start main Next dev server: ${error.message}`);
    shutdown(1);
  });
  mainDev.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`Main Next dev server exited: ${signal ?? code ?? "unknown"}`);
    shutdown(code ?? 1);
  });
  listenProxy(proxyPort);
})();

server.on("upgrade", proxyUpgradeToMain);

function killMainDev(signal) {
  if (!mainDev?.pid) return;
  try {
    process.kill(-mainDev.pid, signal);
  } catch {
    killProcessTree(mainDev.pid, signal);
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  killMainDev("SIGTERM");
  process.exitCode = exitCode;
  setTimeout(() => {
    killMainDev("SIGKILL");
    process.exit(exitCode);
  }, 1500).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
