type Env = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

function assetPathForUrl(url: URL): string {
  if (
    url.pathname.startsWith("/_patches/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.[a-z0-9]+$/i.test(url.pathname)
  ) {
    return url.pathname;
  }
  return `${url.pathname.replace(/\/$/, "")}/index.html`;
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
