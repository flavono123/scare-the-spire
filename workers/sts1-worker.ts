type Env = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

/**
 * Serves the STS1 Compendium detail pages (ko and en, HTML and RSC) and a copy of
 * `/_next/static` from the same build, which left the main Worker to fit the Workers
 * Free file limit (docs/designs/sts1-compendium-worker.md). Only the main Worker
 * calls it, through the STS1_WORKER service binding, and main adds the headers.
 */
const sts1Worker = {
  fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
};

export default sts1Worker;
