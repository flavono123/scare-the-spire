#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://spire-codex.com"
ROOT_DIR="/Users/hansuk.hong/P/scare-the-spire"
DATA_DIR="$ROOT_DIR/data/spire-codex"
IMG_DIR="$ROOT_DIR/public/images/spire-codex"

# Data endpoints to download
DATA_ENDPOINTS=(
  cards characters relics monsters potions powers enchantments
  encounters events keywords intents orbs afflictions modifiers
  achievements epochs stories acts ascensions stats changelogs
)

# Languages: eng (canonical) + kor (primary)
LANGS=(eng kor)

# Image categories from /api/images
IMG_CATEGORIES=(cards characters monsters relics potions icons ancients bosses)

echo "=== Spire Codex Data Downloader ==="
echo "Rate limit: 60 req/min. Using 1s delay between API calls."
echo ""

# --- 1. Download data ---
echo "--- Phase 1: Downloading data endpoints ---"
for lang in "${LANGS[@]}"; do
  dir="$DATA_DIR/$lang"
  mkdir -p "$dir"
  for ep in "${DATA_ENDPOINTS[@]}"; do
    outfile="$dir/$ep.json"
    if [[ -f "$outfile" ]]; then
      echo "[SKIP] $lang/$ep.json (already exists)"
      continue
    fi
    echo "[GET]  $lang/$ep.json"
    curl -sS --compressed -o "$outfile" "$BASE_URL/api/$ep?lang=$lang"
    sleep 1
  done
done

# Download language-independent endpoints (no lang param)
for ep in changelogs languages; do
  outfile="$DATA_DIR/$ep.json"
  if [[ -f "$outfile" ]]; then
    echo "[SKIP] $ep.json (already exists)"
    continue
  fi
  echo "[GET]  $ep.json"
  curl -sS --compressed -o "$outfile" "$BASE_URL/api/$ep"
  sleep 1
done

# Download images index
echo "[GET]  images-index.json"
curl -sS --compressed -o "$DATA_DIR/images-index.json" "$BASE_URL/api/images"
sleep 1

echo ""
echo "--- Phase 2: Downloading images ---"

# Parse image URLs from the index and download
# Use jq to extract URLs per category
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq"
  exit 1
fi

total_images=0
for cat in $(jq -r '.[].id' "$DATA_DIR/images-index.json"); do
  dir="$IMG_DIR/$cat"
  mkdir -p "$dir"

  # Extract image URLs for this category
  urls=$(jq -r --arg cat "$cat" '.[] | select(.id == $cat) | .images[].url' "$DATA_DIR/images-index.json")
  count=$(echo "$urls" | wc -l | tr -d ' ')
  downloaded=0

  echo "[$cat] $count images"

  while IFS= read -r url; do
    filename=$(basename "$url")
    outfile="$dir/$filename"
    if [[ -f "$outfile" ]]; then
      downloaded=$((downloaded + 1))
      continue
    fi
    curl -sS -o "$outfile" "$BASE_URL$url"
    downloaded=$((downloaded + 1))
    total_images=$((total_images + 1))

    # Rate limiting: ~3 images/sec for static files (less strict than API)
    # Sleep every 3rd image
    if ((total_images % 3 == 0)); then
      sleep 1
    fi

    # Progress every 50 images
    if ((total_images % 50 == 0)); then
      echo "  ... downloaded $total_images images so far"
    fi
  done <<< "$urls"

  echo "  [$cat] done ($downloaded/$count)"
done

echo ""
echo "=== Done! ==="
echo "Data: $DATA_DIR"
echo "Images: $IMG_DIR"
echo "Total images downloaded this run: $total_images"
