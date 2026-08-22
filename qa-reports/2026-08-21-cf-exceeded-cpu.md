# QA Report — Cloudflare exceededCpu (2026-08-21)

## Scope

One-shot path lookup for the 132 GraphQL `exceededResources` on `scare-the-spire` that day. Patch Worker had 0 errors. This is an incident write-up from stored Workers Logs (3-day Free retention), not a collector run.

## Environment

- Production origin: `https://scare-the-spire.flavono123.workers.dev`
- Worker version: `5e0a98df-be54-47e0-85ae-4232dc3ac7a8`
- Metrics: `pnpm cf:metrics -- --hours 168 --worker all --hourly`
- Logs: Cloudflare Observability events with `$workers.outcome = exceededCpu` (GraphQL name is `exceededResources`)
- User IDs in logs were already `REDACTED`. Unbounded Toy Box / History Course IDs below are `{id}`. IPs, cookies, and headers were not persisted.

## Metrics (7-day window ending 2026-08-22 ~11:40 KST)

| Worker | success | exceededResources | clientDisconnected |
|---|---:|---:|---:|
| `scare-the-spire` | 128,299 | 132 | 185 |
| `scare-the-spire-patches` | 263 | 0 | — |

All 132 resource-limit errors were on **2026-08-21 KST**. Error CPU p50 was **10.000 ms** (Workers Free per-invocation kill). Colo mix: HKG 124, LAX 8.

| KST | GraphQL count | error CPU p99 |
|---|---:|---:|
| 09:27–09:28 | 8 | 12.9–252 ms |
| 12:23–12:25 | 114 | 21–75 ms |
| 13:42 | 5 | 107 ms |
| 19:34 | 5 | 301 ms |

Aug 15–20 and Aug 22 morning had 0 `exceededResources`. Typical volume is ~18k req/day; that 24h window was ~37k.

## Log clusters (events, redacted)

Server/edge failure: `exceededCpu` → HTTP 503, often `cpuTimeMs: 10`. Clients and crawlers **trigger** it by hitting OpenNext-heavy ID routes; they are not a device-only or network-only bug. `clientDisconnected` / log `canceled` is a separate abort bucket.

Service indexes (`/this-or-that`, `/history-course`, `/defragment`, `/transfigure`) already have static shells. **`/{id}` is still OpenNext** (probes return 200 without `x-cf-static-page`).

| KST | Sampled events | Paths |
|---|---:|---|
| 09:27–09:28 | 8 | `/defragment/{combo,transfigure}/{id}` RSC; `/this-or-that/{id}` RSC; `/history-course/{id}` RSC; `/transfigure/{id}` RSC (one invocation 252 ms CPU) |
| 12:23–12:25 | 50 sampled of 114 | **all** `GET /this-or-that/{id}`, mix of document and `?_rsc=` |
| 13:42 | 5 | all `/defragment/transfigure/{id}` RSC |
| 19:34 | 6 sampled vs 5 GraphQL | `/defragment/{chemical_x,this_or_that,transfigure,combo}/{id}` RSC |

Distinct-value listings for the whole day also include many `/compendium/*` paths. That API is distinct values, not counts; event samples for the four GraphQL bursts were the OpenNext ID routes above. Treat crawler walks of static-looking Compendium URLs as a possible extra trigger, not as the noon burst.

Verified bot categories on `exceededCpu` that day included empty (likely humans), Search Engine Crawler, SEO, AI Crawler/Assistant/Search, Page Preview, Accessibility, and Advertising. ASN mix included KR ISPs (KT, SK, LG) and Google / Microsoft / Amazon / RapidSeedbox.

## Operator follow-up

```bash
pnpm cf:logs -- --from 2026-08-21T12:20:00+09:00 --to 2026-08-21T12:30:00+09:00 --outcome exceededCpu
```

Wrangler OAuth cannot call Workers Logs REST. Use a Custom token with Account → Workers Observability → Write (log query, not deploy), or the authenticated Observability MCP.

Product fix (not in this report): static shells for unbounded Toy Box / History Course IDs, same pattern as the indexes.
