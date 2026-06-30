type Env = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

function assetPathForUrl(url: URL): string {
  if (url.pathname === "/patches" || /^\/[^/]+\/patches$/.test(url.pathname)) {
    return `${url.pathname}/index.html`;
  }
  if (!url.pathname.includes(".")) {
    return `${url.pathname.replace(/\/$/, "")}/index.html`;
  }
  return url.pathname;
}

const patchWorker = {
  fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const assetUrl = new URL(request.url);
    assetUrl.pathname = assetPathForUrl(url);
    return env.ASSETS.fetch(new Request(assetUrl, request));
  },
};

export default patchWorker;
