import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const root = process.cwd();
const mainPort = Number(process.env.MAIN_DEV_PORT ?? 3001);
const proxyPort = Number(process.env.PORT ?? 3000);
const patchAssetsDir = path.join(root, ".patch-worker/assets");

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
        host: `localhost:${mainPort}`,
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
      host: `localhost:${mainPort}`,
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

runInitialPatchBuild();
const mainDev = startMainDev();

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `localhost:${proxyPort}`}`);
  if (isPatchRoute(url.pathname)) {
    void servePatchAsset(req, res, url.pathname);
    return;
  }
  proxyToMain(req, res);
});

server.listen(proxyPort, () => {
  console.log(`Patch/main dev proxy listening on http://localhost:${proxyPort}`);
  console.log(`Main Next dev server listening on http://localhost:${mainPort}`);
});

server.on("upgrade", proxyUpgradeToMain);

function shutdown() {
  server.close();
  mainDev.kill("SIGTERM");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
