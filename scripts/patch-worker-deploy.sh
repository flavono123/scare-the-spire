#!/usr/bin/env bash
# Production patch Worker deploys from CI (.github/workflows/cloudflare-workers.yml).
#
#   scripts/patch-worker-deploy.sh first     the patch-first deploy, before main
#   scripts/patch-worker-deploy.sh refresh   the redeploy after main, for the new manifest
#
# The two run in different jobs and concurrency groups, so a newer push's patch deploy can
# land while an older run is still on its main build. Each deploy records its commit as the
# version message, and neither mode ever puts an older commit over a newer live one:
#   first    skips when the live patch Worker is this commit or a newer one.
#   refresh  rebuilds the newest of this commit and the live one, then checks again
#            before uploading, so the live pages pick up the manifest main just deployed.
#            It skips when this run's first deploy is still live and was built from the
#            same manifest (FIRST_MANIFEST_SHA256, the first job's output).
set -euo pipefail

mode="${1:?usage: patch-worker-deploy.sh first|refresh}"
config=wrangler.patch.jsonc

live_sha() {
  local version
  version="$(npx wrangler deployments status --config "$config" --json | jq -r '.versions | max_by(.percentage) | .version_id')"
  npx wrangler versions view "$version" --config "$config" --json \
    | jq -r '.annotations["workers/message"] // ""' \
    | grep -E '^[0-9a-f]{40}$' || true
}

# True when $2 is a commit that contains $1 (equal included).
contains() {
  [[ -n "$2" ]] && git cat-file -e "$2^{commit}" 2>/dev/null && git merge-base --is-ancestor "$1" "$2"
}

retry() {
  for attempt in 1 2 3; do
    echo "$* (attempt ${attempt}/3)"
    if "$@"; then return 0; fi
    [[ "$attempt" -eq 3 ]] && return 1
    sleep $((attempt * 15))
  done
}

# sha256 of a manifest as the build pins it (JSON.stringify of the parsed body).
manifest_sha256() {
  node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(JSON.parse(s))))' \
    | sha256sum | cut -d' ' -f1
}

deploy() {
  npx wrangler deploy --config "$config" --keep-vars --message "$1"
}

git fetch --quiet origin main
head="$(git rev-parse HEAD)"

case "$mode" in
  first)
    live="$(live_sha)"
    if contains "$head" "$live"; then
      echo "live patch Worker is ${live}, which already contains ${head}: skip"
      exit 0
    fi
    retry pnpm patch:build
    retry deploy "$head"
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
      echo "manifest_sha256=$(manifest_sha256 < .patch-worker/compendium-resource-manifest.json)" >> "$GITHUB_OUTPUT"
    fi
    ;;
  refresh)
    if [[ -n "${FIRST_MANIFEST_SHA256:-}" && "$(live_sha)" == "$head" ]]; then
      manifest_url="${NEXT_PUBLIC_SITE_ORIGIN%/}/generated/compendium-resource-manifest.json"
      if [[ "$(curl -fsS "$manifest_url" | manifest_sha256)" == "$FIRST_MANIFEST_SHA256" ]]; then
        echo "the live patch Worker is ${head}, built from the manifest main serves now: skip"
        exit 0
      fi
    fi
    for round in 1 2 3; do
      live="$(live_sha)"
      target="$head"
      if [[ "$live" != "$head" ]] && contains "$head" "$live"; then target="$live"; fi
      if [[ "$target" != "$(git rev-parse HEAD)" ]]; then
        echo "a newer push is live: refreshing ${target} instead of ${head}"
        lock_changed=false
        git diff --quiet HEAD "$target" -- package.json pnpm-lock.yaml || lock_changed=true
        git checkout --quiet --detach "$target"
        [[ "$lock_changed" == true ]] && pnpm install --frozen-lockfile
      fi
      retry pnpm patch:build
      live="$(live_sha)"
      if [[ "$live" != "$target" ]] && contains "$target" "$live"; then
        echo "${live} went live during the build: round ${round} again"
        continue
      fi
      retry deploy "$target"
      exit 0
    done
    echo "the patch Worker kept moving ahead of this refresh; the newest push refreshes it"
    ;;
  *)
    echo "unknown mode: ${mode}" >&2
    exit 2
    ;;
esac
