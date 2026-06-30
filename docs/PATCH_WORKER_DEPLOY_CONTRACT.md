# Patch Worker Deploy Contract

Cloudflare patch notes can be deployed before the main Compendium Worker is
fully updated. Treat patch-note publishing and Compendium publishing as related
but independently deployable surfaces.

## Patch-First Resource Links

- Patch pages must not render a clickable Compendium link unless that resource
  exists in the deployed Compendium resource manifest.
- Missing resources must render as hover-only "모음집 준비 중" / "Compendium page
  in progress" previews.
- Pending resources may still use rich patch markup and hover previews, but the
  user must not be able to click through to a 404 Compendium page.
- After the main Worker deploys the matching Compendium content, redeploy the
  patch Worker so those pending previews become normal links.

## Patch-Local Assets

- Provisional assets that exist only for a patch-first publication must live
  under `/_patches/*`.
- Do not guess canonical Compendium asset paths such as
  `/images/sts2/cards/new_card.webp` before the main content owns those assets.
- Once the main Compendium data and assets catch up, switch rich previews back
  to canonical Compendium data and canonical `/images/sts2/*` assets.

## Manifest Contract

- Main builds publish `/generated/compendium-resource-manifest.json`.
- Patch builds use the currently deployed manifest to decide whether each rich
  patch resource is linkable.
- Set `PATCH_COMPENDIUM_MANIFEST_SOURCE=live` for patch-first CI deploys. The
  build reads `PATCH_COMPENDIUM_MANIFEST_URL` when present, otherwise
  `${NEXT_PUBLIC_SITE_ORIGIN}/generated/compendium-resource-manifest.json`.
- If the live manifest cannot be read, patch builds fail closed by treating
  Compendium resources as unavailable instead of enabling links from local data.
- When a push changes both patch notes and Compendium content, deploy the patch
  Worker first with safe pending previews, deploy the main Worker, then redeploy
  the patch Worker to enable newly available links.
