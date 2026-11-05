# Supabase 탈출 계획

관련 문서:

- [OpenNext Runtime Exit Plan](./OPENNEXT_EXIT_PLAN.md) (main Worker를 정적 전용으로 만든 선례)
- [배포 절차](./RELEASE_PROCESS.md) (지금의 Supabase 마이그레이션 단계가 여기 있다)
- [운영 알려진 문제](../tasks/010-production-known-issues.md)

## 상태

2026-11-04: 계획만 세웠고 구현은 시작하지 않았다. 서비스, 공통 렌더, 데이터 스키마를 모두 건드리는
대규모 리팩토링이므로, 구현을 시작할 때 worktree 승인부터 받는다(CLAUDE.md 규칙).

## 결론

- **이전할 곳**: Cloudflare D1(SQLite)과 지금 쓰는 main Worker의 같은 출처(same-origin) `/api/*` 경로,
  그리고 Worker가 직접 발급하는 익명 신원이다. 새 벤더나 유료 플랜은 필요 없다. 모두 Workers Free 안에서 돈다.
- **초기 로딩 없애기**: 페이지 HTML을 이미 main Worker가 내보내고 있다. 그 응답에 공개 데이터(피드 첫 페이지,
  댓글, 카운트, 네비 새 글 표시)를 JSON으로 넣는다. 그러면 첫 화면이 데이터와 함께 뜬다. 사이트가
  `*.workers.dev` 주소라서 Cloudflare Cache API는 동작하지 않는다(2026-11-05 공식 문서 확인). 그래서 Worker
  메모리에 30~60초 보관하는 캐시를 직접 만든다. 캐시가 비어 있어도 D1 무료 한도 안에서 감당하도록 쿼리를
  색인과 한 번의 batch로 짠다.
- **키 유출과 성능 저하는 관련이 없다.** 아래 2.4절의 로그 근거를 보라. 느려지는 원인은 Free nano 인스턴스의
  메모리·디스크 IO 한계다. 여기에 JS를 실행하는 크롤러(운영 트래픽의 약 9할)와 로컬·testbed QA가 같은 DB를
  두드린다.

## 1. 지금 Supabase에 기대는 것

| 기능 | 규모 | 위치 |
|---|---|---|
| 테이블 읽기·쓰기(PostgREST) | 공개 테이블 약 30개, 코드에서 쓰는 테이블 21개 | `src/hooks/use-*.ts` 34개 등 파일 약 65개 |
| RPC(PL/pgSQL 함수) | 클라이언트가 부르는 함수 12개, 전체 함수 31개, 트리거 8개 이상 | `supabase/migrations/` 61개 |
| 익명 로그인(Supabase Auth) | `signInAnonymously`, 사용자 id가 모든 글의 `user_id` | [use-auth.ts](../src/hooks/use-auth.ts) |
| 접근 규칙(RLS) | 모든 쓰기 권한의 유일한 경계 | 마이그레이션 |
| Realtime(`postgres_changes`) | 2곳 | [use-community-stories.ts](../src/hooks/use-community-stories.ts), [use-toybox-feed.ts](../src/hooks/use-toybox-feed.ts) |
| 빌드 시점 읽기 | `next build`, `patch:build`가 글을 읽는다. 실패하면 샘플 글로 대체된다 | [build-patch-worker.tsx](../scripts/build-patch-worker.tsx) |
| Worker 안의 읽기 | 상세 OG 태그용으로 행 하나를 읽는다 | [detail-shell-og.ts](../workers/detail-shell-og.ts) |
| 관리 기능(secret 키) | 문의 내역, 닉네임 풀, 활동 지표 | `/dev/admin`, 로컬 node 스크립트 |
| 환경 분리 | 운영·testbed·로컬이 프로젝트 하나를 같이 쓰고 `env` 컬럼으로만 구분한다 | 모든 테이블 |

Storage는 쓰지 않는다.

## 2. 진단: 왜 자꾸 "데이터베이스가 응답하지 않습니다"가 뜨나

측정에 쓴 도구: Supabase Management API(로그 `analytics/endpoints/logs`, 일별 요청 수
`usage.api-counts`, 인증 설정)와 Cloudflare GraphQL Analytics(`workersInvocationsAdaptive`).
시각은 KST다.

### 2.1 2026-11-04 장애 실측

- 23:36에 REST, Auth, Management SQL이 모두 20초 안에 응답하지 않았다. 프로젝트 상태는 `ACTIVE_HEALTHY`로
  표시됐다. 23:45에 다시 확인했을 때도 그대로였다.
- Postgres 로그를 보면 21:20부터 `canceling statement due to statement timeout`이 이어졌다.
  `SELECT setting FROM pg_settings` 같은 사소한 쿼리가 11.7초, `pg_stat_statements` 집계가 10~13초
  걸렸다. 무거운 쿼리 하나가 문제가 아니라 **인스턴스 전체가 IO를 기다리며 멈춘 상태**다.
- 바로 전인 20~22시의 시간당 요청은 7,729건과 8,285건이었다. 평소에는 1,300~2,300건이다. 늘어난 요청은
  `localhost:3000` referer에 Pixel 8·iPhone UA를 단 KRAFTON 망 요청, 즉 로컬 모바일 뷰포트 QA다.
  이날 하루 localhost 요청은 15,641건이었다. `.codex/skills/mobile-viewport-qa`의 스크립트는
  `*.supabase.co`를 막지 않는다.

### 2.2 평소 운영 트래픽의 대부분은 크롤러다

2026-11-03 하루 동안 운영 사이트(`scare-the-spire.flavono123.workers.dev`)를 referer로 단 요청은 약
49,000건이었다.

| 출처 | 요청 | IP 수 |
|---|---|---|
| 싱가포르 등록 Tencent Cloud 대역(6 COLLYER QUAY, 16 COLLYER QUAY, ACEVILLE PTE. IP 43.153·43.156·43.173·129.226.x) | 약 30,000 | 수백 |
| Microsoft Corporation(Bing 크롤러 대역 157.55.39.x 포함) | 10,437 | 257 |
| NAVER Cloud, NHN | 약 1,200 | 500 이상 |
| 국내 가정·모바일 ISP와 대학(실사용자로 보이는 것) | 약 3,000~4,000 | 수십 |

- 페이지 한 번에 Supabase 요청이 약 20건 나간다. 네비 새 글 표시용 "최신 글 시각" 쿼리가 10개이고, 브라우저가
  다른 출처로 보낼 때마다 CORS preflight(OPTIONS)가 하나씩 붙는다.
- JS를 실행하는 크롤러가 페이지마다 이 20건을 DB에 그대로 보낸다. 실사용자는 하루 수십 명 수준인데 DB 부하의
  9할은 크롤러가 만든다.
- 11-03 16시에는 Microsoft에서만 1시간에 10,290건이 몰렸다(IP 230개).

### 2.3 Free nano 인스턴스의 한계

- 11-02 지표: RAM 428 MB, swap 약 480 MB 사용, iowait가 CPU 사용 중 가장 크다, steal 0, OOM 없음.
- swap이 디스크를 쓰므로 메모리 부족이 곧 디스크 IO 소모가 된다. 하루 burst 예산을 다 쓰면 기저 IO만 남는다.
  받은 메일("Disk IO Budget을 소진 중")과 같은 현상이다.
- 장애 구간: 10-28 22:10~10-29 02:30, 10-31 00:20~02:30, 10-31 23:35~11-01 02:55, 11-02 09:47~09:52,
  11-04 21:20~(23:45 기준 진행 중). 대부분 저녁에 시작한다. 하루 예산이 저녁쯤 바닥나는 모양과 맞는다.
- Realtime은 logical replication slot을 계속 읽는다. 작은 인스턴스에서는 이것도 부담이다.
- 기존 `migration-010-disk-io-optimizations.sql`의 인덱스로는 이 구조적 한계를 넘지 못한다.

### 2.4 키 유출과의 연관성: 증거 없음

- 2026-10-26 보안 점검에서 git 커밋 4,038개 전체를 검사했고 유출된 시크릿은 없었다.
- secret 키(`sb_secret_…`) 요청은 11-03에 43건이었다. 모두 사용자 본인 IP(SK Broadband 가정망, KRAFTON)의
  `node` 스크립트이고, 대상은 `contact_inquiries`, `profile_character_nickname_pools`,
  `get_rls_activity_metrics`였다.
- referer 없이 API를 직접 부른 요청은 하루 67~1,678건이다. 대부분 브라우저의 Realtime 웹소켓, 사용자의 node
  빌드, Cloudflare Worker의 OG 읽기, Microsoft 크롤러다.
- 쓰기와 RPC는 하루 수십 건뿐이다. 보안 점검이 경고한 `complete_favorite_tournament_play`(입력 크기 상한 없음)는
  11-03에 3건(IP 1개)이었다.
- anon(publishable) 키는 원래 공개되는 키다. 크롤러도 이 키를 써서 정상 경로로 들어온다. "키가 새서 누가 DB를
  두드린다"가 아니라, **누구나 페이지를 열면 DB를 직접 두드리는 구조 자체가 문제**다.

### 2.5 Workers 무료 한도도 이미 넘은 적이 있다

| 날짜 | main | testbed | 계정 합계 |
|---|---|---|---|
| 10-28 | 56,300 | 93,347 | 약 149,900 |
| 10-29 | 71,953 | 92,598 | 약 164,600 |
| 11-01~11-04 | 7,589~17,078 | 0~3,469 | 2만 이하 |

- Workers Free의 하루 10만 요청은 계정 전체 합계다. 10-28과 10-29에는 testbed QA 때문에 이를 넘었다.
- 정적 전용 main Worker가 나간 뒤로는 하루 2만 이하다. 새 API도 이 10만 안에 들어가야 한다.

## 3. 목표와 제약(우선순위 순)

1. **추가 비용 0원**: Workers Free를 유지한다. 새 유료 서비스, 도메인 구매, 결제 수단 등록이 필요한 상품은
   쓰지 않는다.
2. **지금보다 나은 성능**: 공개 데이터는 첫 화면에 로딩 상태 없이 나온다. DB가 느리거나 한도에 걸려도 페이지는
   즉시 뜨고, 마지막 캐시를 보여 준다.
3. **Supabase 의존성 0**: `@supabase/supabase-js`, Supabase Auth, PostgREST, Realtime, Supabase CLI
   마이그레이션, 환경 공유용 `env` 컬럼을 모두 없앤다.
4. **기존 익명 사용자 신원 유지**: 자기 글을 수정·삭제하고 프로필 활동을 보던 사람이 이관 뒤에도 그대로 할 수
   있어야 한다.

## 4. 후보 비교

| 후보 | 추가 비용 | 의존성 | 지연·안정성 | 이식 비용 | 판정 |
|---|---|---|---|---|---|
| **Cloudflare D1 + main Worker** | 0 | 새 벤더 없음(이미 Cloudflare) | 콜드 스타트 없음, Worker와 같은 망, 캐시와 결합 | SQL을 SQLite로 옮기고, RPC·RLS·Auth를 Worker 코드로 | **채택** |
| Neon Free(Postgres) | 0 | 벤더 추가 | 유휴 시 compute가 꺼져서 첫 요청에 콜드 스타트 | SQL·함수는 거의 그대로. Auth·API·Realtime은 결국 직접 만든다 | 초기 로딩 목표와 충돌 |
| Turso Free(libSQL) | 0 | 벤더 추가 | 양호 | D1과 비슷 | D1보다 나은 점 없이 의존성만 는다 |
| Supabase 유료(Pro 이상) | 월 고정비 | 그대로 | 개선 | 없음 | 1순위 제약 위반 |
| Oracle Always Free VM에 Postgres 직접 운영 | 0 | 벤더 추가, 운영 부담 | 단일 서버, 운영·백업을 직접, 유휴 회수 위험 | 작음 | 안정성 목표와 충돌 |
| Supabase Free 유지 + 완화 | 0 | 그대로 | nano 한계는 그대로 | 작음 | 이관 전까지의 임시 조치(0단계)로만 |

D1 Free 한도(2026-11-04 공식 문서 확인): 하루 rows read 500만, rows written 10만(00:00 UTC 초기화), DB 10개,
DB당 500 MB, 계정 5 GB, Worker 호출당 쿼리 50개, 쿼리 30초. 한도를 넘으면 초기화(09:00 KST)까지 쿼리가 오류를
낸다. 읽기 복제(read replication)는 추가 비용이 없다. Time Travel(시점 복원)은 Free에서 7일이고 추가 비용이
없다. Supabase Free에는 자동 백업이 없다. 지금 Supabase 프로젝트 위치는 도쿄(`ap-northeast-1`)다.

## 5. 목표 구조

```text
브라우저 ── 같은 출처 ──> main Worker ──(binding)──> D1 slseoun-prod
  ├ 페이지 HTML: 정적 HTML + 첫 데이터 JSON 주입(Worker 메모리 캐시 30~60초, 만료 뒤 직전 값 응답 + 백그라운드 갱신)
  ├ GET  /api/read/*  공개 읽기(같은 메모리 캐시), 사이트 안 이동·더 보기용
  ├ GET  /api/me/*    쿠키 신원별 개인 데이터(내 좋아요, 내 투표, 프로필 활동)
  └ POST /api/write/* 쿠키 신원 확인 → 입력 검증 → D1 batch(본문과 카운터를 한 트랜잭션에)
/patches* ── PATCH_WORKER ── 정적 패치 페이지. 댓글은 같은 출처 /api/*를 쓴다
```

### 5.1 읽기: 초기 로딩 없애기

- 페이지 이동 요청은 이미 main Worker가 `_cf_static_pages`에서 HTML을 꺼내 응답한다. 같은 호출 안에서
  `HTMLRewriter`로 `<script type="application/json" id="slseoun-initial-data">`를 넣는다. **Worker 호출 수는
  늘지 않는다.**
- 훅은 마운트할 때 이 값을 초기 상태로 쓰므로 스켈레톤이나 로딩 문구가 나오지 않는다.
- 캐시: Cloudflare Cache API는 커스텀 도메인에서만 동작하고 `*.workers.dev`에서는 아무 효과가 없다. 그래서
  Worker 모듈 전역 `Map`에 경로별 키로 보관한다. 만료된 값은 그대로 응답하고 `ctx.waitUntil`로 다시 채운다.
  이 메모리는 Worker 인스턴스(isolate)마다 따로이고, 인스턴스가 내려가면 비워진다. Cloudflare 문서도 전역
  상태에 기대지 말라고 한다. 그래서 적중률은 보장되지 않고, 캐시는 속도를 위한 덤으로 본다. 정합성(쓰기, 권한,
  카운터)은 캐시에 두지 않는다.
- 캐시 예산은 인스턴스당 16 MB로 두고, 넘으면 오래된 키부터 버린다(LRU). 런 원문(`runs.raw`)은 캐시에 넣지
  않는다. 근거는 6.1절의 실측이다.
- D1 조회에는 짧은 시간 제한(예: 300 ms)을 둔다. 제한을 넘거나 D1이 한도 초과면 메모리의 직전 값이나 빈 목록으로
  HTML을 바로 내보낸다. DB 상태가 페이지 표시를 막지 않는다.
- 크롤러는 계속 들어온다. 차이는 두 가지다. 브라우저가 공개 키로 DB에 직접 붙지 않는다. 그리고 페이지 하나가
  쿼리 약 20건이 아니라 Worker 안의 batch 한 번이 된다. D1은 RAM이 모자라 멈추는 구조가 아니다. 그래서 이 정도
  부하는 셀 수 있는 rows read로만 남는다(6절).
- 커스텀 도메인을 붙이면 Cache API, WAF 규칙, Bot Fight Mode를 무료 플랜에서 쓸 수 있다. 하지만 도메인 비용이
  들어 1순위 제약 때문에 쓰지 않는다.
- 네비 새 글 표시는 10개 쿼리를 `surface_latest` 테이블 한 번 읽기로 바꾼다. 쓸 때 갱신하고, 모든 HTML에 넣는다.
- 사이트 안 이동(Next.js soft navigation)은 HTML 대신 RSC 파일을 받으므로 주입이 안 된다. 링크가 보이거나
  마우스를 올리면 `/api/read/*`를 미리 받아 두고(prefetch), 메모리와 localStorage에 직전 값을 보관해 바로
  보여 준다.
- 개인 데이터는 공개 렌더 위에 `/api/me/*` 한 번으로 덧칠한다. 대부분 표시 상태(좋아요를 눌렀는지 등)라서 체감
  로딩은 없다.
- 첫 데이터 JSON에는 크기 상한 128 KB를 둔다(6.1절: 가장 큰 피드 첫 페이지가 79 KB). Free의 10 ms CPU 안에
  머물기 위해서다. 넘는 화면은 목록 요약만 넣고 본문은 `/api/read/*`로 받는다.

### 5.2 쓰기

- 같은 출처 POST다. CORS preflight가 없어진다.
- Worker가 길이, 허용 값, 소유권을 검사한 뒤 D1 `batch()`로 본문과 카운터를 함께 반영한다. 클라이언트가 카운터나
  `created_at`을 직접 쓸 수 없게 된다. 그래서 보안 점검의 RLS 지적(카운트 위조, `defragment_bodies` 선점,
  토너먼트 함수 크기 무제한, 반응 키 바꿔치기)이 구조적으로 사라진다.
- 신원별·IP별 rate limit에는 Workers Rate Limiting binding을 쓴다. `LINK_PREVIEW_LIMITER`로 이미 쓰고 있다.
- 쓴 뒤에는 그 인스턴스의 캐시 키를 지우고, 작성자 화면에는 낙관적으로 바로 반영한다. 메모리 캐시는 인스턴스마다
  따로라서 다른 인스턴스나 지역의 사용자는 TTL(30~60초) 안에 새 값을 본다.

### 5.3 신원: 익명 로그인 대체

- Worker가 UUID를 발급하고 HMAC으로 서명한 `HttpOnly; Secure; SameSite=Lax` 쿠키에 담는다. 같은 출처가 되므로
  쿠키를 쓸 수 있다.
- **기존 사용자 이관(claim)**: 브라우저 localStorage의 `sb-vhscirjiywwmwlafkhjh-auth-token`에 Supabase가
  서명한 access token이 있다.
  1. 클라이언트가 이 토큰을 `/api/auth/claim`에 한 번 보낸다.
  2. Worker가 미리 저장해 둔 공개키로 서명을 검증한다. 만료는 무시하고, `iss`, `sub`, `is_anonymous`를 확인한다.
  3. 같은 `user_id`로 쿠키를 발급하고 localStorage 키를 지운다.
- 이 방식은 Supabase를 끈 뒤에도 동작한다.
- 2026-11-04 확인: 현재 서명 키는 ES256(`in_use`)이고, 이전 키 HS256(`previously_used`)이 있다. ES256 공개키는
  JWKS로 얻는다. 오래 방문하지 않은 사용자의 HS256 토큰까지 받으려면 레거시 JWT secret도 Worker secret으로
  보관해야 한다.
- 위험: 예전 토큰을 훔친 사람이 그 익명 신원을 가져갈 수 있다. 지금 Supabase 익명 계정도 토큰만 있으면 되므로
  위험 수준은 같다. claim 기한을 둔다(예: 180일).

### 5.4 Realtime 대체

두 곳 모두 탭이 보일 때 60초 간격으로, 그리고 탭에 다시 돌아올 때 `/api/read/*`를 다시 받는다. 응답은 메모리
캐시를 거치고, 캐시가 비어도 색인을 탄 읽기 한 번이다. 실시간이 꼭 필요해지면 그때 Durable Object WebSocket을 검토한다.

### 5.5 RPC·트리거·타입 이식

- RPC 12개를 `workers/api/` 아래 TypeScript와 SQLite SQL로 옮긴다. 카운터 트리거는 batch 안의 명시적
  UPDATE로 바꾼다.
- 타입 대응:

  | Postgres | SQLite |
  |---|---|
  | `jsonb` | JSON TEXT + `json_extract` |
  | `timestamptz` | UTC ISO TEXT |
  | `uuid` | TEXT |
  | `boolean` | INTEGER 0/1 |
  | 배열 | JSON TEXT |

- rows read는 스캔한 행 수로 센다. 그래서 `count(*)` 집계는 쓰지 않고 카운터 컬럼이나 카운터 테이블로 대신한다.
  목록 쿼리는 모두 인덱스 정렬 + `LIMIT` + keyset 페이지네이션이다. [toybox-feed-keyset.ts](../src/lib/toybox-feed-keyset.ts)가
  이미 있다.

### 5.6 환경 분리

- D1 DB를 `slseoun-prod`와 `slseoun-testbed`로 따로 둔다. 로컬은 `wrangler dev`의 로컬 SQLite를 쓴다.
  `env` 컬럼은 없앤다.
- 로컬·모바일 QA는 운영 데이터에 한 번도 닿지 않는다(2.1절의 원인 제거).
- testbed Worker 호출도 계정 10만에 들어간다. 대량 QA는 로컬 `wrangler dev`로 돌린다(2.5절의 원인 제거).

### 5.7 관리 기능과 빌드

- 문의 내역(이메일 포함), 닉네임 풀, 활동 지표는 로컬 스크립트에서 `wrangler d1 execute --remote`로 다룬다.
  `/dev`는 지금처럼 운영 빌드에서 막아 둔다. 브라우저 쪽에는 secret 키를 쓰는 경로가 남지 않는다.
- `next build`와 `patch:build`는 DB를 읽지 않는다. 글 데이터는 런타임 주입으로만 들어간다. 그러면 빌드가 DB
  상태와 무관해지고, 샘플 글로 몰래 대체되는 문제도 사라진다.
- [detail-shell-og.ts](../workers/detail-shell-og.ts)의 REST 호출은 D1 binding으로 바꾼다.
- CSP `connect-src`에서 `*.supabase.co`를 뺀다([security-headers.ts](../workers/security-headers.ts)).

## 6. 무료 한도 적합성

| 한도 | 지금 실측 | 이관 후 예상 | 판단 |
|---|---|---|---|
| Workers 요청 10만/일(계정) | main 0.8만~1.7만, testbed 0~0.3만 | 페이지 이동 주입은 추가 0. 사이트 안 이동·개인 데이터·쓰기가 페이지당 1~3건이라 하루 수천~1만 건 추가 | 여유 있음. testbed 대량 QA만 조심 |
| CPU 10 ms/요청 | P50 0.8~1.4 ms | 주입·JSON 직렬화 소폭 증가 | 주입 크기 상한으로 관리 |
| D1 rows read 500만/일 | (Supabase 요청 2만~4.8만/일) | 캐시 적중이면 0. 최악(캐시 전혀 없음)은 main Worker 최대치 페이지 17,000 × 페이지당 100행 = 170만 | 한도의 약 1/3. rows read는 훑은 행 수로 세므로 모든 조회에 색인이 필요하다 |
| D1 rows written 10만/일 | 쓰기·RPC 하루 수십 건 | 같음 | 여유 큼 |
| DB당 500 MB | DB 전체 35 MB(2026-11-05 측정). 가장 큰 테이블은 `runs` 687행 7.6 MB, 그다음은 옮기지 않을 Auth 테이블 | 30 MB 안팎 | 여유 큼. 런 원문이 크게 늘 때만 압축이나 별도 DB를 검토 |

D1 primary 위치는 만들 때 `apac` location hint로 정한다. 나중에 바꿀 수 없다.

### 6.1 화면별 데이터 크기 실측(2026-11-05, 운영 env)

지금 클라이언트가 보내는 쿼리를 그대로 SQL로 돌려 PostgREST가 돌려주는 JSON 길이를 쟀다. 압축률은 실제 REST
응답 두 개를 gzip으로 재서 얻었다. CPU는 같은 JSON을 Node(M 계열 Mac)에서 파싱하고 다시 직렬화한 시간이다.
Worker는 이보다 느릴 수 있으므로 두 배로 잡는다.

| 화면·요청 | 지금 쿼리 | 행 | JSON | 판정 |
|---|---|---|---|---|
| 모든 페이지의 네비 새 글 표시 | 최신 1행 쿼리 10개 | 10 | 1 KB 미만 | `surface_latest` 한 번으로 |
| 장난감 상자 피드 첫 페이지 | `get_toybox_feed` 20개 | 11~20 | 13~79 KB(최대: 어려운 결정 79 KB, 서류 폭풍 72 KB) | 주입 가능. 80 KB 파싱·직렬화 0.33 ms, gzip 14 KB |
| 이야기 최신 100 | `community_stories` | 24 | 13 KB | 주입 가능 |
| 이야기 하나의 댓글 | `comments` `select *` | 최대 12 | 최대 5.7 KB, 평균 0.7 KB | 주입 가능 |
| 좋아요·댓글 수 전체 | `get_engagement_counts` | 271 | 24 KB | 주입 가능 |
| 이아저? 월드컵 후보 통계(대회 하나) | `favorite_tournament_candidate_stats` | 102 | 28 KB | 주입 가능 |
| 다채로운 철학자들 | `colorful_philosopher_posts` 100 | 25 | 10 KB | 주입 가능 |
| **런 목록(역사 강의서)** | `runs` 최근 100, **원문 포함** | 100 | **7.9 MB**(gzip 약 0.5 MB) | **그대로는 불가.** 파싱·직렬화만 27.7 ms로 CPU 10 ms 초과 |
| 런 목록, 원문 제외 | 같은 쿼리에서 `raw` 제외 | 100 | 54 KB | 주입 가능 |
| 코오오옴보의 런 고르기 | `runs` 30, 원문 포함 | 30 | 3.1 MB | 같은 문제 |
| 런 하나의 상세 | `runs` 1행 | 1 | 최대 293 KB(원문 최대 260 KB, 평균 64 KB) | D1 행 2 MB 한도 안. 주입하지 않고 `/api/read/*`로 |

전체 규모: 런 원문을 빼면 공개 테이블 31개의 운영 데이터를 모두 JSON으로 합쳐도 약 1.4 MB다. 런 원문은
584개에 42.8 MB(JSON 기준)다.

한도와 비교:

| 한도(공식 문서, 2026-11-05) | 값 | 우리 최대치 | 판단 |
|---|---|---|---|
| Worker isolate 메모리 | 128 MB(Free·Paid 같음) | 원문 제외 전체 데이터 1.4 MB, 캐시 예산 16 MB | 여유 큼 |
| Worker CPU | 요청당 10 ms(Free) | 주입 최대 80 KB에서 약 0.7 ms(두 배 가정) | 여유 있음. 런 원문 목록만 초과 |
| D1 행·문자열·BLOB 크기 | 2 MB | 런 원문 최대 260 KB | 안. 런 원문이 2 MB를 넘는 경우는 업로드에서 막는다 |
| D1 쿼리 결과 크기 | 50 MB | 런 원문 목록 7.9 MB | 안. 다만 CPU 때문에 어차피 쓰지 않는다 |
| D1 SQL 문 길이 | 100 KB | 런 업로드 INSERT는 원문을 바인딩 값으로 넘긴다 | 원문을 SQL 문자열에 넣지 않는다 |
| D1 호출당 쿼리 수 | 50(Free) | 페이지 주입 batch 2~5개 | 여유 큼 |
| D1 rows read | 훑은 행 수로 센다 | 6절 표 | 모든 조회에 색인 |

이관 때 할 일:

- 런 목록은 원문을 내려보내지 않는다. 목록이 원문에서 꺼내던 값(파티 캐릭터, 총 층수)은 기부할 때 계산해 열로
  저장한다.
- 이 문제는 지금 운영에도 있다. 런 목록을 한 번 열 때마다 Supabase가 런 원문 7.9 MB를 디스크에서 읽는다.
  하루 몇 번뿐이지만(11-02 운영 4번, 11-03 로컬 QA 14번) nano 인스턴스의 디스크 IO를 크게 쓴다.

## 7. 단계별 계획

**0단계: 이관 전까지 버티기(Supabase 유지, 작게)**

1. DB가 살아 있는 시간(오전)에 `supabase db dump`로 스키마와 데이터를 로컬에 받아 둔다. 이관 원본이자, 지금
   우리 손에 있는 유일한 백업이 된다. `auth.users`의 id 목록도 함께 받는다.
2. 모바일 뷰포트 QA 스크립트에서 `*.supabase.co`를 막는다. 막는 방법은 기존 QA 규칙과 같게
   `--host-resolver-rules`를 쓴다.
3. 이것 말고는 곧 지울 코드에 손대지 않는다.

**1단계: 측정과 준비**

- 테이블별 행 수와 크기는 2026-11-05에 쟀다(DB 전체 35 MB). 이관 직전에 다시 확인한다.
- ES256 JWKS와 레거시 HS256 secret을 확보한다. secret은 사용자가 대시보드에서 직접 확인한다.
- D1 `slseoun-prod`와 `slseoun-testbed`를 만들고 `wrangler.jsonc`에 binding을 추가한다.

**2단계: 스키마**

- SQLite DDL을 `migrations/`에 둔다(`wrangler d1 migrations`).
- 인덱스, 카운터 테이블, `surface_latest`를 만든다.

**3단계: API 레이어**

- `workers/api/`: 읽기, 개인 데이터, 쓰기, 신원, claim, rate limit을 만든다.
- 로컬 D1에서 단위·통합 테스트를 돌린다. 기존 RPC의 동작을 기준(fixture)으로 대조한다.

**4단계: 클라이언트 전환**

- 훅 34개를 공용 API 클라이언트로 바꾼다.
- HTML 주입과 초기값, prefetch, Realtime 대신 polling을 넣는다.
- `@supabase/supabase-js`를 제거한다.

**5단계: 이관 리허설**

- dump를 변환 스크립트(Postgres 타입 → SQLite)로 바꿔 testbed D1에 넣는다.
- 테이블별 행 수와 체크섬을 대조한다.
- testbed에서 전체 스모크를 돌리고 claim을 확인한다.

**6단계: 전환**

1. 사이트에 "잠시 읽기 전용" 안내를 띄우고 Supabase 쓰기를 멈춘다.
2. 최종 dump를 받아 운영 D1에 넣고 배포한다.
3. 운영 스모크를 돌린다.
4. 실제 브라우저(기존 익명 세션 보유)로 claim을 확인한다.

**7단계: 정리**

- Supabase는 몇 주 동안 읽기 전용으로 둔다. 일시정지나 삭제는 사용자 승인 뒤에만 한다.
- `supabase/` 디렉터리, `.env.local`의 Supabase 키, CI의 Supabase 확인, `docs/RELEASE_PROCESS.md`의
  Supabase 마이그레이션 절을 D1 마이그레이션 절차로 바꾼다.

## 8. 위험과 대응

| 위험 | 대응 |
|---|---|
| D1 일일 한도에 걸리면 09:00 KST까지 쿼리 오류 | 메모리의 직전 값이나 빈 목록으로 강등, 색인 없는 조회 금지, 일일 사용량을 GraphQL로 확인. 크롤러가 크게 늘면 Worker에서 ASN 차단 |
| DB가 500 MB를 넘음 | 지금 35 MB라 당분간 해당 없음. 런 원문이 크게 늘면 압축하거나 별도 DB로 분리(무료 10개) |
| soft navigation에는 주입이 안 됨 | prefetch, 메모리·localStorage 직전 값 |
| claim하지 못한 사용자는 기존 글의 소유권을 잃음 | 긴 claim 기한, HS256 토큰까지 검증, 문의 창구 |
| 작업량이 큼(훅 34, RPC 12, 테이블 약 30) | worktree에서 단계별로 진행, 주간 배포와 분리 |
| 메모리 캐시가 인스턴스 단위라 다른 인스턴스는 최대 TTL만큼 늦게 보고, 적중률도 보장되지 않음 | TTL 30~60초, 작성자는 낙관적 반영, 한도 계산은 캐시 없음을 기준으로 |

## 9. 결정이 필요한 것

1. 구현을 시작할 때 worktree 사용 승인
2. Realtime을 polling으로 바꾸는 것(체감: 새 글이 최대 1분 늦게 보임)
3. 기존 익명 신원을 claim 방식으로 옮기는 것과 기한
4. 0단계(백업, QA 차단)를 지금 바로 할지
