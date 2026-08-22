# QA 리포트 — Cloudflare exceededCpu (2026-08-21)

## 범위

메인 Worker `scare-the-spire`에서 그날 GraphQL `exceededResources` **132건**의 경로를 로그로 한 번 조회한 기록이다. 패치 Worker는 에러 0. 상시 수집기가 아니라, 사고 창에 대해 Workers Logs(Free 보관 **3일**)를 조회한 결과다.

## 환경

- 프로덕션 origin: `https://scare-the-spire.flavono123.workers.dev`
- Worker 버전: `5e0a98df-be54-47e0-85ae-4232dc3ac7a8`
- 집계: `pnpm cf:metrics -- --hours 168 --worker all --hourly`
- 로그: `$workers.outcome = exceededCpu` (메트릭 이름은 `exceededResources`)
- 사용자 ID는 로그에 이미 `REDACTED`. Toy Box / History Course의 비한정 ID는 `{id}`로 표기. IP, 쿠키, 헤더는 남기지 않음.

## 판정: 서버(엣지 포함) 문제이고, 이쪽에서 고칠 수 있다

서버/클라를 크게 나누면 **실패 모드는 서버(Cloudflare 엣지 Worker)**, **유발은 클라·크롤러의 요청**이다. 고치는 쪽은 서버다.

| 층 | 무엇인가 | 이번 사고 |
|---|---|---|
| 실패가 난 곳 | Worker 요청당 CPU 10ms 한도 → `exceededCpu` / HTTP **503** / Error 1102 | 에러 CPU p50이 정확히 **10.000ms**. 기기·Wi-Fi·특정 폰의 렌더 실패가 아님 |
| 요청을 보낸 곳 | 사람(KR ISP) + 검색/AI/프리뷰 크롤러 | 버스트를 **일으킨** 트래픽. 클라가 5xx를 **만든** 것이 아님 |
| 클라 쪽 버킷 | 메트릭 `clientDisconnected`, 로그 `canceled` | 같은 날 185건이 따로 있음. 이번 132건과 **별개** |

우리가 바꿀 수 있는 것: 해당 경로가 OpenNext 폴백을 타지 않게 하는 것. 인덱스(`/this-or-that`, `/history-course`, `/defragment`, `/transfigure`)는 이미 정적 셸이고, **`/{id}`만 아직 OpenNext**다. 프로브는 200이지만 `x-cf-static-page`가 없다. 정오 버스트의 본문은 `/this-or-that/{id}` 문서 + RSC(`?_rsc=`)였다.

고칠 수 없는 것 / 고치면 안 되는 것:

- Cloudflare Workers Free의 요청당 10ms CPU 한도 자체
- 크롤러가 URL을 두드리는 행위 자체 (유료 제품·차단망 없이 “클라를 고친다”는 해법이 아님)
- 이미 지난 `clientDisconnected` (상대가 연결을 끊은 것)

제품 수정(이 리포트의 구현 범위 밖): 인덱스와 같은 방식으로 Toy Box / History Course **ID 상세**에 정적 셸을 깐다. 그 전까지는 같은 경로에 트래픽이 몰리면 같은 503이 다시 난다.

## 메트릭 (7일, 2026-08-22 ~11:40 KST 기준)

| Worker | 성공 | exceededResources | clientDisconnected |
|---|---:|---:|---:|
| `scare-the-spire` | 128,299 | 132 | 185 |
| `scare-the-spire-patches` | 263 | 0 | — |

132건은 전부 **2026-08-21 KST**. colo는 HKG 124, LAX 8. 평소 ~1.8만 req/일, 그날 24h는 ~3.7만. 8/15–20과 8/22 오전은 `exceededResources` 0.

| KST | GraphQL 건수 | 에러 CPU p99 |
|---|---:|---:|
| 09:27–09:28 | 8 | 12.9–252ms |
| **12:23–12:25** | **114** | 21–75ms |
| 13:42 | 5 | 107ms |
| 19:34 | 5 | 301ms |

## 로그 클러스터 (이벤트, 비식별)

| KST | 샘플 | 경로 |
|---|---:|---|
| 09:27–09:28 | 8 | `/defragment/{combo,transfigure}/{id}` RSC, `/this-or-that/{id}` RSC, `/history-course/{id}` RSC, `/transfigure/{id}` RSC (한 건 CPU 252ms) |
| 12:23–12:25 | 114 중 50건 샘플 | **전부** `GET /this-or-that/{id}` (문서 + RSC) |
| 13:42 | 5 | 전부 `/defragment/transfigure/{id}` RSC |
| 19:34 | GraphQL 5 vs 로그 6 | `/defragment/{chemical_x,this_or_that,transfigure,combo}/{id}` RSC |

하루 전체의 distinct 값 목록에는 `/compendium/*`도 섞인다. 그 API는 **건수가 아니라 서로 다른 값**이라, 정오 버스트의 본문으로 쓰지 않는다. 이벤트 샘플이 가리키는 네 창은 위 OpenNext ID 경로다.

`exceededCpu`에 붙은 봇 분류: 빈 값(사람으로 보임), Search Engine / SEO / AI Crawler·Assistant·Search, Page Preview, Accessibility, Advertising. ASN은 KT·SK·LG와 Google·Microsoft·Amazon·RapidSeedbox가 섞여 있다.

## 나중에 비슷한 5xx가 다수일 때, 2번 조사는 어떻게 켜지나

2번은 **백그라운드 수집이 아니다.** 노트북이 꺼져 있으면 돌지 않고, 3일이 지난 로그는 사라진다. “비슷한 5xx 다수”가 보여도 자동으로 `cf:logs`가 돌아가지 않는다. 켜는 방법은 아래뿐이다.

1. **먼저 집계로 창을 잡는다** (`pnpm cf:metrics`, 필요하면 `--hourly`).  
   `exceededResources`가 분 단위로 몰리면 2번 대상이다. `clientDisconnected`만 늘면 2번이 아니라 클라 중단 쪽을 본다.
2. **그 창이 3일 안에 있으면 로그를 조회한다.**

```bash
pnpm cf:logs -- --from <ISO> --to <ISO> --outcome exceededCpu
```

   Wrangler OAuth는 403이다. Custom 토큰(Account → Workers Observability → Write, 배포 권한 아님) 또는 인증된 Observability MCP가 필요하다.

3. **트리거가 될 수 있는 신호** (사람이 치거나, 이후 3번 플레이북이 같은 순서를 탈 때):
   - 폰/브라우저에 Cloudflare 503·Error 1102가 여러 번 보이고, Ray ID·시각이 있다
   - 대시보드 Metrics Errors에 `exceededResources` 스파이크가 있다
   - 배포·패치 직후, 또는 크롤/공유가 몰린 직후에 5xx가 겹친다
   - 에이전트에게 “5xx 다수 / 1102 / exceededResources”를 말하면, 플레이북은 `cf:metrics`로 창을 잡고 `cf:logs`로 path를 남긴 뒤 이 형식의 `qa-reports/`를 쓴다

4. **트리거가 아닌 것**
   - `pnpm cf:errors` (`wrangler tail`): 지금 이 순간만 본다. 어제 창을 다시 찍지 못한다
   - GitHub 일일 스냅샷(계획 4번): 아직 없음. 생기면 “에러가 있었다”는 **1번 신호**만 주고, path는 여전히 2번 CLI(또는 같은 REST)가 필요하다

재현 창이 3일을 넘기면 path는 못 찾고, 메트릭의 시각·건수·CPU p50만 남는다. 그때는 같은 경로를 라이브로 두드리며 `cf:errors`로 맞추는 수밖에 없다.
