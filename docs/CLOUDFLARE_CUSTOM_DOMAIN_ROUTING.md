# Cloudflare Custom Domain Routing

This document records the target routing shape after buying and attaching a
custom domain. It is not an instruction to change DNS or Wrangler routes before
the domain exists.

## Current Route Shape

The current workers.dev deployment keeps patch pages same-origin by routing
through the main Worker:

```text
request /patches* or /_patches*
  -> scare-the-spire main Worker
  -> PATCH_WORKER service binding
  -> scare-the-spire-patches Worker
  -> static assets from .patch-worker/assets
```

This works as a deployment and rollback fallback, but it invokes the main
Worker before the patch Worker for every patch-page request.

## Target Route Shape

After a custom domain is available, configure route dispatch so patch traffic
goes directly to the patch Worker and all other traffic goes to the main
OpenNext Worker:

```text
example.com/patches*   -> scare-the-spire-patches
example.com/_patches/* -> scare-the-spire-patches
example.com/*          -> scare-the-spire
```

The `PATCH_WORKER` service binding should remain as a workers.dev and rollback
fallback. It should not be the final Worker-invocation-minimizing production
path for patch pages once custom-domain route priority can dispatch by path.

## Guardrails

- Do not move `/patches*` back into the main OpenNext runtime as the primary
  Cloudflare production path.
- Keep `scare-the-spire-patches` asset-first. Patch HTML, CSS, images, fonts,
  and provisional assets must be generated ahead of time under
  `.patch-worker/assets`.
- Runtime code in the patch Worker may map clean URLs to `index.html`, but it
  must not render patch markdown, parse large data files, or query Compendium
  data per request.
- Follow `docs/PATCH_WORKER_DEPLOY_CONTRACT.md` for patch-first resource links,
  patch-local assets, and manifest fail-closed behavior.
