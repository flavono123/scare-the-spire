# Cloudflare Error Diagnostics

Use Workers metrics for historical error counts, Workers Logs for request details, and `wrangler tail` while reproducing an issue. The main Worker and patch Worker are separate services and must be inspected separately.

## Quick CLI workflow

Show invocation outcomes and CPU usage from the last 24 hours:

```bash
pnpm cf:metrics
```

Useful variations:

```bash
pnpm cf:metrics -- --hours 72
pnpm cf:metrics -- --worker main
pnpm cf:metrics -- --worker patch
pnpm cf:metrics -- --hours 6 --json
```

The command uses `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` when present. Otherwise it refreshes and reuses the local `wrangler login` session. It never prints the token.

Watch only new main Worker invocation errors, then reproduce the issue on the phone:

```bash
pnpm cf:errors
```

Watch the patch Worker instead:

```bash
pnpm cf:errors -- --worker patch
```

An application can deliberately return HTTP 500 while the Worker invocation itself is still classified as successful. Use `--all` when investigating that case:

```bash
pnpm cf:errors -- --all
```

JSON output can be retained for later inspection:

```bash
pnpm cf:errors -- --format json | tee cloudflare-errors.ndjson
```

JSON tail output includes client IP addresses and request headers. Treat saved files as sensitive and redact them before sharing.

Do not add `--ip self` when reproducing on a phone. `self` is the computer running Wrangler, not the phone's network address.

## Cloudflare dashboard workflow

1. Open **Workers & Pages** and select `scare-the-spire`.
2. In **Metrics**, choose the relevant time window and open **Errors** in the Summary graph. Check whether the outcome is `exceededResources`, `scriptThrewException`, or `internalError`.
3. Open **Observability** and set the same time window. Workers Free retains stored logs for three days.
4. In the query bar, start with one of these queries:

```text
$metadata.service = "scare-the-spire" AND $workers.event.response.status >= 500
```

```text
$metadata.service = "scare-the-spire" AND $workers.outcome = "exceededResources"
```

5. Open **Invocations**, expand an invocation, and record the request URL, outcome, CPU time, exception, Worker version, and request ID.
6. Repeat with `scare-the-spire-patches` when the failing URL starts with `/patches` or `/_patches`.

If the exact query field is not offered by autocomplete, add the equivalent filters in Query Builder:

- `$metadata.service` equals `scare-the-spire`
- `$workers.event.response.status` greater than or equal to `500`
- or `$workers.outcome` equals `exceededResources`

Save the query as `STS 5xx by path` and group a Count visualization by `$workers.event.request.path` and `$workers.event.response.status`.

Cloudflare documentation:

- [Workers metrics and invocation statuses](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)
- [Workers Logs and retention](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Query Builder](https://developers.cloudflare.com/workers/observability/query-builder/)
- [Wrangler tail](https://developers.cloudflare.com/workers/wrangler/commands/workers/#tail)

## July 16, 2026 incident

The historical Workers metrics query found this cluster on the main Worker:

- Time: `2026-07-16 17:30:23–17:31:03 KST`
- Worker version: `9c01eda1-2e8d-4b19-9ecf-330626eef16b`
- Cloudflare location: `LAX`
- `exceededResources`: 38 requests / 38 errors
- successful invocations in the same 50-second window: 82
- client disconnects in the same window: 6
- error CPU P50/P99: 10.000 ms / 15.819 ms

All 38 errors were concentrated in the same 40-second interval as the production crawl benchmark. This was not exhaustion of the 100,000-request daily allowance. The failures crossed the Workers Free per-invocation CPU limit while the benchmark requested many uncached routes. A phone request during that interval could therefore have received a Cloudflare resource-limit 5xx response.

Metrics cannot identify the exact URL. The stored invocation in Workers Logs, or a future live tail, is required to tie an individual phone failure to its path and Ray ID.

## Information to capture from a phone failure

- exact page URL
- approximate time including timezone
- screenshot of the error page
- Cloudflare Ray ID shown at the bottom of a Cloudflare error page
- whether reload immediately succeeded

The Ray ID and timestamp are the strongest keys for matching the phone response to a stored invocation.
