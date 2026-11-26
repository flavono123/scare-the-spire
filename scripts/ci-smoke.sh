# Deploy smoke helpers for .github/workflows/cloudflare-workers.yml. Source it with $origin set.
# Cloudflare error 1027 (account daily request limit) says nothing about the deploy, so a smoke
# that meets it warns and passes. Turn every smoke step off with the repo variable CF_SMOKE=off.

# Prints "limit" when the response is the account daily limit page.
smoke_limit_hit() {
  local status="$1" body="$2"
  [[ "$status" == "429" ]] && grep -q "1027" "$body" && echo limit
}

smoke() {
  local url="${origin}$1" body status attempt
  body="$(mktemp)"

  for attempt in $(seq 1 30); do
    status="$(curl --silent --show-error --output "$body" --write-out "%{http_code}" "$url" || true)"
    echo "smoke ${url}: HTTP ${status} (attempt ${attempt}/30)"
    case "$status" in
      2*|3*) rm -f "$body"; return 0 ;;
    esac
    if [[ "$(smoke_limit_hit "$status" "$body")" == limit ]]; then
      echo "::warning::smoke ${url} skipped: Cloudflare 1027 (account daily request limit)"
      rm -f "$body"
      return 0
    fi
    sleep 5
  done

  rm -f "$body"
  echo "smoke failed for ${url}"
  return 1
}

smoke_static_detail() {
  local url="${origin}$1" mode headers body status attempt static_page content_type expected_content_type

  for mode in html rsc; do
    headers="$(mktemp)"
    body="$(mktemp)"
    for attempt in $(seq 1 30); do
      if [[ "$mode" == "rsc" ]]; then
        status="$(curl --silent --show-error --dump-header "$headers" --header "RSC: 1" --output "$body" --write-out "%{http_code}" "${url}?_rsc=ci" || true)"
        expected_content_type="text/x-component"
      else
        status="$(curl --silent --show-error --dump-header "$headers" --header "Accept: text/html" --output "$body" --write-out "%{http_code}" "$url" || true)"
        expected_content_type="text/html"
      fi

      static_page="$(tr -d '\r' < "$headers" | awk -F ': *' 'tolower($1) == "x-cf-static-page" { print tolower($2) }' | tail -1)"
      content_type="$(tr -d '\r' < "$headers" | awk -F ': *' 'tolower($1) == "content-type" { print tolower($2) }' | tail -1)"
      echo "static smoke ${url} (${mode}): HTTP ${status}, x-cf-static-page=${static_page:-missing}, content-type=${content_type:-missing} (attempt ${attempt}/30)"

      if [[ "$status" == 2* && "$static_page" == "compendium" && "$content_type" == *"$expected_content_type"* ]]; then
        break
      fi

      if [[ "$(smoke_limit_hit "$status" "$body")" == limit ]]; then
        echo "::warning::static smoke ${url} (${mode}) skipped: Cloudflare 1027 (account daily request limit)"
        break
      fi

      if [[ "$attempt" == "30" ]]; then
        rm -f "$headers" "$body"
        echo "static detail smoke failed for ${url} (${mode})"
        return 1
      fi
      sleep 5
    done
    rm -f "$headers" "$body"
  done
}
