# 1단계 설계: 같은 출처 API(뒤는 Supabase)

관련 문서:

- [Supabase 탈출 계획](../SUPABASE_EXIT_PLAN.md) 7.2절 원칙, 7.3절 1단계
- [Supabase 사용 지도](SURFACE_MAP.md): 화면 32개와 플래그 그룹 9개, 화면별 엔드포인트·응답 계약

## 상태

2026-11-05: 초안. 이 문서는 모든 화면이 같이 쓰는 기반(런타임 플래그, HTML 주입, `/api` 라우터, Supabase
어댑터, JWT 검증, 클라이언트 헬퍼)과 첫 화면인 네비(`nav`)를 정한다. 다른 화면의 엔드포인트와 응답은
SURFACE_MAP.md 2절을 따르고, 화면을 옮길 때 이 문서 9절에 차례로 더한다.

## 1. 순서

1. 기반: 플래그, 주입, 라우터, 어댑터, JWT, 클라이언트 헬퍼. 모든 플래그가 `legacy`이면 운영 동작이 지금과
   바이트 단위로 같아야 한다(3.4절).
2. `nav`: 네비 새 글 표시와 댓글 배달부. 읽기만 하고 사용자와 무관하다.
3. `comments`: 공용 댓글, 백과사전 묶음, 좋아요, 리소스 반응, 목록 참여 수. 첫 쓰기 화면이라 JWT 경로를 여기서
   처음 쓴다.
4. 나머지 그룹(`toybox-feed`, `colorful-philosophers`, `stories`, `history-runs`, `puzzlebox`, `profile`,
   `contact`).

각 화면은 플래그를 `api`로 켜기 전에 testbed에서 먼저 켠다. 켜는 것과 되돌리는 것은 배포 없이 플래그로 한다.

## 2. Worker 구성

### 2.1 binding과 변수

| 이름 | 종류 | 값 | 비고 |
|---|---|---|---|
| `DB` | D1 binding | 운영 `slseoun-prod`, testbed `slseoun-testbed` | `apac` location hint. 1단계에는 `runtime_flags`만 쓴다 |
| `API_SUPABASE_URL` | var | 프로젝트 URL | 배포할 때 `--var`로 넣는다. 저장소에 적지 않는다(지금도 GitHub secret이다) |
| `API_SUPABASE_KEY` | var | publishable 키(`sb_publishable_…`) | 같음. 클라이언트 번들에 이미 있는 공개 키다 |
| `API_DATA_ENV` | var | 운영 `production`, testbed `development` | 행의 `env` 열. 클라이언트 값을 받지 않는다 |

- 이름을 `API_`로 시작하게 한 이유: [detail-shell-og.ts](../../workers/detail-shell-og.ts)는
  `NEXT_PUBLIC_SUPABASE_*`와 `SUPABASE_*`를 읽는다. 같은 이름을 넣으면 지금 꺼져 있는 OG 보강이 켜지고, 그
  안의 테이블 오류(SURFACE_MAP 8.3절)와 상세 HTML마다의 Supabase 요청이 함께 생긴다. OG는 1단계 범위가 아니다.
- 1단계에는 secret이 없다. 쓰기는 사용자 토큰을 넘기고, JWKS는 공개 값이다.
- 세 var 가운데 하나라도 없으면 `/api`의 Supabase 경로는 503 `not_configured`이고, 플래그와 상관없이 HTML에는
  `api`를 넣지 않는다(3.3절). 변수를 빠뜨린 배포가 화면을 깨지 않게 하려는 것이다.

### 2.2 D1

- `wrangler.jsonc` 최상위와 `env.testbed`에 각각 `d1_databases`를 적는다(named env는 물려받지 않는다).
  `database_id`를 꼭 적는다. 비어 있으면 `wrangler deploy`가 새 DB를 만든다.
- 마이그레이션은 `d1/migrations/`에 둔다(`migrations_dir`). Supabase 마이그레이션(`supabase/migrations/`)과
  섞이지 않게 한다. 스키마는 늘리기만 한다(plan 7.2절).
- 읽기 복제를 켠다. 플래그 읽기는 `withSession("first-unconstrained")`가 있으면 그것으로, 없으면(로컬)
  `prepare`로 한다. 복제 지연(보통 몇 초)만큼 되돌리기가 늦을 수 있다.

## 3. 런타임 플래그

### 3.1 테이블

```sql
CREATE TABLE runtime_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE runtime_flag_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
```

- 키는 `path.<그룹>`이다. 그룹은 SURFACE_MAP 1.2절의 9개다: `nav`, `comments`, `toybox-feed`,
  `colorful-philosophers`, `stories`, `history-runs`, `puzzlebox`, `profile`, `contact`.
- 값은 `legacy` 또는 `api`다. 1단계의 안전한 쪽은 `legacy`이고, 행이 없거나 값을 모르면 `legacy`다.
- 키 이름에 단계 축을 넣는다. 3단계의 읽기 저장소는 `read.<그룹>`(`supabase` 또는 `d1`), 4·5단계는 그때 정한다.
  한 축을 바꾸는 플래그가 다른 축의 값을 함께 바꾸지 않게 하려는 것이다(plan 7.2절 "한 단계에 한 가지만").
- 바꾸는 것은 `scripts/runtime-flags.mjs`로만 한다(`get`, `set <key> <value> --note`, 대상 `--env testbed` 또는
  `--env production`). `runtime_flags` upsert와 `runtime_flag_events` insert를 한 batch로 보낸다. 운영 값을 바꾸는
  것은 사용자 승인 뒤에만 한다.

### 3.2 Worker가 읽는 법

- `SELECT key, value FROM runtime_flags` 한 번으로 전부 읽는다(행 10개 안팎). 아는 키와 값만 받는다.
- isolate 메모리에 30초 둔다. 30초가 지난 값은 그대로 쓰고 `ctx.waitUntil`로 다시 읽는다(한 번에 하나만).
- 메모리에 값이 없을 때만 기다린다. HTML 요청은 150 ms, `/api` 요청은 1초까지 기다리고, 넘거나 실패하면
  `legacy` 기본값을 쓴다. 실패한 결과는 5초만 둔다. 늦게 끝난 읽기는 그대로 캐시를 채운다.
- 문서 요청(GET·HEAD, RSC가 아님)과 `/api` 요청에서만 읽는다. RSC, 정적 asset, 다른 메서드는 읽지 않는다.

### 3.3 HTML 주입

- `mainWorker.fetch` 감싸개에서 한다. 그래서 정적 페이지, 상세 셸, 404, PATCH_WORKER가 돌려준 패치 페이지까지
  모두 덮는다.
- `api`인 그룹이 하나도 없으면 주입하지 않는다. 그때 HTML은 지금과 같다.
- 있으면 content type이 `text/html`이고 본문이 있는 응답(200, 404)의 `<head>` 맨 앞에 넣는다.

  ```html
  <script id="slseoun-runtime-flags" type="application/json">{"v":1,"path":{"nav":"api"}}</script>
  ```

  `api`인 그룹만 적는다. JSON의 `<`는 `<`로 바꾼다. React 19는 `<head>`의 낯선 태그를 하이드레이션에서
  건너뛰고, 상세 셸 OG가 이미 `<head>`에 태그를 넣고 있다(SURFACE_MAP 6.3절).
- 크롤러에도 똑같이 넣는다. 사람과 크롤러가 다른 경로를 타면 오류율 비교가 어긋난다.

### 3.4 ETag와 304

플래그가 바뀌어도 asset ETag는 그대로라서, 손대지 않으면 브라우저가 304를 받고 옛 플래그가 든 HTML을 계속
쓴다. 그래서 주입한 HTML의 ETag에 플래그 판을 붙인다.

- 플래그 판 `ver`: `api`인 그룹을 이름순으로 이은 문자열(`nav=api;...`)의 FNV-1a 32비트 base36. `api`가 없으면
  `ver = 0`이다.
- 나가는 응답(주입했거나 주입할 HTML의 200·HEAD, 그리고 아래 규칙으로 고친 요청의 304): ETag
  `"<원래 값>-rf<ver>"`. 원래 값이 `W/`로 시작하면 그 표시를 유지한다. 원래 ETag가 없으면 붙이지 않는다.
- 들어오는 문서 요청의 `If-None-Match`(목록의 태그마다):

  | 태그 | `ver = 0`일 때 | `ver ≠ 0`일 때 |
  |---|---|---|
  | `-rf<ver>`로 끝남(지금 판) | 해당 없음 | 접미사를 떼고 넘긴다 |
  | `-rf<다른 판>`으로 끝남 | 버린다 | 버린다 |
  | 접미사 없음 | 그대로 넘긴다 | 버린다 |
  | `*` | 그대로 | 그대로 |

  태그를 하나라도 버렸거나 `ver ≠ 0`이면 `If-Modified-Since`도 지운다. 남은 태그가 없으면 `If-None-Match`를
  지운다. 그래서 판이 바뀐 탭은 200으로 새 플래그를 받고, 같은 판이면 304가 그대로 동작한다.
- `ver = 0`인 동안 접미사 없는 태그는 그대로 지나가므로, 모든 플래그가 `legacy`인 운영은 지금과 같다.
- `Cache-Control`(`public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400`)은 바꾸지 않는다.
  stale-while-revalidate로 브라우저가 옛 HTML을 한 번 더 쓸 수 있다. 그 탭은 3.5절의 서버 쪽 강제로 막는다.

### 3.5 서버 쪽 강제

- `/api` 엔드포인트마다 그룹이 있다. 그 그룹의 플래그가 `legacy`면 처리하지 않고 409
  `{ "error": "surface_legacy" }`(`no-store`)를 돌려준다.
- 클라이언트는 409를 받으면 그 페이지가 살아 있는 동안 그 그룹을 `legacy`로 내리고 legacy 경로로 다시 한다.
- 그래서 되돌리기가 열어 둔 탭, 304로 받은 옛 HTML, stale-while-revalidate로 받은 HTML에도 30초(캐시) 안에
  닿는다.

## 4. `/api` 라우터

- 위치: `mainWorker.fetch`에서 `routeRequest`보다 먼저 경로를 본다. `/api/read/`, `/api/me/`, `/api/write/`로
  시작하는 경로만 가져간다. `/api/link-preview`와 `/api/search-index`(별칭)는 지금 길로 간다. `/api/patches…`처럼
  패치 Worker 정규식에 걸리는 이름도 라우터가 먼저 받는다.
- 경로 표: `{ method, path, group, handler }`. 경로는 정확히 맞아야 하고 끝 슬래시를 받지 않는다. 없는 경로는
  JSON 404 `not_found`, 메서드가 다르면 405와 `Allow`. HEAD는 본문 없는 GET, OPTIONS는 204와 `Allow`.
- 모든 응답: `Content-Type: application/json; charset=utf-8`, `X-Robots-Tag: noindex`, 명시한
  `Cache-Control`. CORS 헤더는 보내지 않는다(같은 출처만 읽을 수 있다). `withSecurityHeaders`를 그대로 지난다.
- 오류 형식은 `{ "error": "<code>" }` 하나다.

  | 상태 | code | 언제 |
  |---|---|---|
  | 400 | `invalid` | 쿼리·본문 검사 실패 |
  | 401 | `unauthenticated` | 토큰이 없거나 서명·만료·발급자 검사 실패(쓰기, `/api/me`) |
  | 403 | `forbidden`, `cross_site` | RLS 거절(42501), 교차 사이트 쓰기 |
  | 404 | `not_found` | 경로 없음, 대상 없음(0행) |
  | 405 | `method_not_allowed` | |
  | 409 | `surface_legacy` | 3.5절 |
  | 413 | `too_large` | 본문 상한 초과 |
  | 422 | `check_violation` | 23514 |
  | 429 | `rate_limited` | |
  | 503 | `unavailable`, `not_configured` | Supabase 시간 초과·5xx·연결 실패, 변수 없음. `Retry-After: 30` |

- 교차 사이트 쓰기: GET·HEAD가 아닌 요청은 `Sec-Fetch-Site`가 `same-origin`이거나, 없으면 `Origin`이 요청
  출처와 같아야 한다(link-preview와 같은 규칙). 아니면 403 `cross_site`.
- 공개 읽기는 `Authorization`을 보지 않는다. 개인 필드가 필요한 화면은 `/api/me/*`로 따로 부른다. 그래서 공개
  응답은 사용자마다 달라지지 않고 메모리·브라우저 캐시에 둘 수 있다(SURFACE_MAP 1.2절의 "토큰이 있으면 같은
  응답에 개인 필드"는 이 규칙으로 바꾼다).

## 5. Supabase 어댑터

- `workers/api/supabase-rest.ts`. supabase-js가 아니라 `fetch`로 PostgREST를 부른다(Worker 크기 256 KiB 예산).
- 헤더: `apikey: <API_SUPABASE_KEY>`, `Accept: application/json`. 사용자 토큰이 있을 때만
  `Authorization: Bearer <토큰>`을 넣는다. publishable 키를 Bearer로 넣지 않는다.
- 모든 쿼리에 `env=eq.<API_DATA_ENV>`를 Worker가 붙인다. 쓰기 본문의 `env`와 `user_id`도 Worker가 채운다.
- 시간 제한: 읽기 4초, 쓰기 6초(클라이언트 8초보다 짧게). AbortController로 끊는다.
- 결과는 `{ ok: true, data }` 또는 `{ ok: false, status, code, message }`. PostgREST 오류 JSON의 `code`를 그대로
  두고, 4절 표로 바꾸는 것은 엔드포인트가 한다.
- 화면마다 저장소 인터페이스를 두고(`NavSource` 등) Supabase 구현만 만든다. 3단계에 같은 인터페이스로 D1 구현을
  더한다.
- 같은 데이터를 두 경로가 같은 모양으로 내도록, 행을 화면 모양으로 바꾸는 함수는 `src/lib`의 순수 함수를 같이
  쓴다(Worker가 import). 큰 데이터를 끌고 오는 모듈은 import하지 않는다.

## 6. JWT 검증

- `workers/api/auth.ts`. `Authorization: Bearer <access_token>`만 받는다(URL로 받지 않는다).
- 순서: 세 조각과 base64url 확인 → 헤더 `alg = ES256`, `kid`가 JWKS에 있음 → WebCrypto ECDSA P-256 SHA-256
  서명 확인 → `exp > now - 30초`, `iss = <API_SUPABASE_URL>/auth/v1`, `aud`에 `authenticated`,
  `role = authenticated`, `sub`가 uuid.
- JWKS는 코드에 고정한다(`workers/api/supabase-jwks.ts`, 2026-11-05에 받은 키 하나). 모르는 `kid`면
  `<API_SUPABASE_URL>/auth/v1/.well-known/jwks.json`을 받아 10분 둔다(실패도 1분 둔다). CryptoKey는 isolate마다
  캐시한다.
- 실패는 모두 401 `unauthenticated`. 클라이언트는 supabase-js로 세션을 갱신하고 한 번만 다시 보낸다. Worker는
  토큰을 갱신하지 않는다.
- 검증한 `sub`만 신원으로 쓴다. 클라이언트가 보낸 `user_id`는 받지 않는다.

## 7. 클라이언트

- `src/lib/runtime-flags.ts`: `surfacePath(group): "legacy" | "api"`, `demoteSurface(group)`. 주입된 스크립트를
  처음 부를 때 한 번 읽는다. `document`가 없거나(빌드, 서버) 스크립트가 없으면(`pnpm dev`, 패치 Worker 직접
  접근, 플래그 전부 `legacy`) `legacy`다.
- 규칙: 렌더 중에 플래그를 읽지 않는다. 효과(effect)나 이벤트 처리에서만 읽는다. 렌더에서 읽으면 빌드 HTML
  (`legacy`)과 첫 클라이언트 렌더가 달라져 하이드레이션이 어긋난다.
- `src/lib/api-client.ts`: `apiFetch(group, path, init)`. 절대 경로 `/api/...`만 쓴다. 시간 제한 8초
  (AbortController). 409 `surface_legacy`면 `demoteSurface` 뒤 `SurfaceLegacyError`, 401·403·404·422·429는 코드가
  든 `ApiError`, 네트워크·시간 초과·5xx는 `ApiUnavailableError`.
- legacy로 다시 하는 것은 409일 때뿐이다. 503에 legacy로 가면 같은 Supabase를 브라우저가 한 번 더 부를 뿐이라서,
  지금의 "응답 없음" 화면을 보인다.
- `supabaseEnabled` 검사(빌드에 Supabase 변수가 없으면 false)는 `api` 경로에서는 보지 않는다. Worker가 변수를
  갖는다. 이 검사가 있는 곳은 SURFACE_MAP 6.10절에 적혀 있고, 화면을 옮길 때 함께 고친다.
- 패치 페이지의 정적 클라이언트(`patch-comments-client.js`)는 같은 스크립트를 읽는 작은 함수를 따로 둔다. 번들
  셋(rich, nav-indicators, resource-patch-index)은 `src/lib`의 같은 헬퍼를 번들한다.

## 8. 네비(`nav`)

### 8.1 엔드포인트

`GET /api/read/nav`. 공개, 그룹 `nav`.

```json
{
  "v": 1,
  "generatedAt": "2026-11-05T12:00:00.000Z",
  "latest": {
    "combo": "2026-11-04T09:12:33.120Z",
    "transfigure": null,
    "this-or-that": "…", "favorite-tournament": "…", "chemical-x": "…",
    "decisions-decisions": "…", "pagestorm": "…", "history-course": "…"
  },
  "weekly": { "colorful-philosophers": "2026-11-02" },
  "courier": [{ "id": "…", "storyId": "sts2-codex:card:…", "text": "…", "createdAt": "…" }]
}
```

- `latest`: 8개 테이블마다 `select=created_at&env=eq.<env>&order=created_at.desc&limit=1`. 값은
  `new Date(x).toISOString()`로 맞춘다(PostgREST는 마이크로초와 `+00:00`을 준다. 클라이언트는 문자열로 비교한다).
  실패한 테이블은 `null`이다. 지금도 실패한 표면은 점만 잃는다.
- `weekly`: `colorful_philosopher_posts`의 `week_start <= 이번 주 월요일(KST)` 가운데 최신 `week_start`
  (`YYYY-MM-DD`). 이번 주 계산은 `colorfulPhilosophersWeekStart`와 같은 식이다(spec으로 같음을 확인한다).
- `courier`: `comments`의 최근 14일 12개, `id, story_id, content, created_at`. `text`는
  `courierCommentText(content)`이고 빈 줄은 뺀다. href·출처 이름·토큰은 지금처럼 클라이언트가 `storyId`로 만든다.
- 10개 요청이 모두 실패하면 503 `unavailable`. 일부만 실패하면 200에 `"partial": true`.
- 캐시:
  - Worker 메모리에 60초. 지난 값은 그대로 주고 `waitUntil`로 다시 읽는다. Supabase가 응답하지 않으면 10분까지
    지난 값을 준다. `partial`이면 10초만 둔다.
  - 응답 `Cache-Control: public, max-age=60`(`partial`이면 `max-age=10`). 같은 브라우저의 페이지 이동과 탭이
    1분 동안 다시 부르지 않는다.
- Worker 안 요청은 캐시가 비었을 때 subrequest 10개다(Free 한도 50).

### 8.2 클라이언트

- `src/lib/nav-snapshot.ts`: `loadNavSnapshot()`. 진행 중인 요청을 함께 쓰고, 받은 값을 페이지 메모리에 60초
  둔다. 네비와 배달부가 같은 요청 하나를 쓴다.
- `fetchUnreadSurfaceIds(seen)`(`nav-seen.ts`): `nav`가 `api`면 스냅샷으로 계산한다.
  - 테이블 표면: `latest[id] > since[id]`
  - 철학자: `weeklyPublishedAt(weekly) > since`
  - 패치 노트·니오우스레터: 지금처럼 번들 JSON
  - 409면 legacy로 다시 한다. 503이나 시간 초과면 점 없음(지금 실패 동작과 같다).
- 탭별 60초 unread 캐시(`sts-nav-unread:`)는 그대로 둔다. 두 경로 모두 결과 목록을 저장한다.
- 배달부(`comment-courier.tsx`): `nav`가 `api`면 스냅샷의 `courier`를 쓴다. 배달부를 끈 사용자도 네비 때문에
  같은 응답을 받으므로 요청이 늘지 않는다.
- 패치 페이지: `patch-nav-indicators-client.ts`는 `fetchUnreadSurfaceIds`를 그대로 쓰므로 함께 바뀐다.
  `patch-comments-client.js`의 배달부는 플래그를 읽어 `api`면 `/api/read/nav`의 `courier`를 쓴다.

### 8.3 요청 수

- 지금: Next 페이지마다 Supabase 9~10건과 CORS preflight, 패치 페이지마다 10건(캐시 없음).
- `nav = api`: 브라우저가 1분에 한 번 이하로 `/api/read/nav` 1건(Workers 요청). Supabase는 isolate가 1분에 한 번
  이하로 10건.
- Workers 요청은 페이지 조회만큼 늘 수 있다(브라우저 캐시를 빼면). 넘어갈 조건(하루 6만 건 아래)을
  `pnpm cf:metrics`로 본다.

## 9. 다른 화면을 옮길 때

- 엔드포인트, 응답, 신원은 SURFACE_MAP 2절의 그 화면 표를 따른다. 바꾼 것은 이 절에 적는다.
- 공개 읽기에 개인 필드를 섞지 않는다(4절). 개인 필드는 `/api/me/*` 한 번으로 덧칠한다.
- 쓰기는 `Prefer: return=representation`으로 0행을 404로 구별한다. `contact_inquiries`만 `return=minimal`이다.
- 응답이 128 KB를 넘을 수 있는 화면은 상한이나 페이지를 둔다(SURFACE_MAP 8.2절).
- 화면마다 `workers/api/routes/<그룹>.ts`, 클라이언트는 그 화면의 훅에서 `surfacePath`로 고른다. 라우터 표는
  그룹 파일이 내보내는 목록을 모아 만든다.

## 10. 배포와 testbed

- CI(`.github/workflows/cloudflare-workers.yml`)의 main 배포에 `--var API_SUPABASE_URL:… --var
  API_SUPABASE_KEY:… --var API_DATA_ENV:production`을 더한다. 값은 이미 있는 빌드 env에서 가져온다.
- testbed(`scripts/run-cloudflare-testbed.mjs --remote`)도 같은 세 값을 넣는다. `API_DATA_ENV=development`.
- D1 DB 두 개를 만들고 `database_id`를 `wrangler.jsonc`에 커밋한다. 마이그레이션은 testbed에 먼저 적용한다.
- 로컬 `wrangler dev`는 local D1을 쓴다. Worker 변수는 `.dev.vars`(gitignore)에 둔다.
- `/api` 스모크: `cloudflare-route-smoke.mjs`에 라우터가 살아 있는지만 보는 확인을 더한다(`/api/read/없는경로`가
  JSON 404). 읽기 스모크는 Supabase를 부르므로 넣지 않는다.

## 11. 테스트

- Worker spec(tsx, 지금 방식): 라우터(경로, 메서드, HEAD, OPTIONS, 교차 사이트), 플래그(D1 stub, 시간 제한,
  캐시, 실패 기본값), ETag 규칙 표 전부, 주입(HTMLRewriter stub), Supabase 어댑터(fetch stub으로 URL, apikey,
  Authorization 유무, env 필터), JWT(Node `crypto.subtle`로 만든 ES256 키쌍: 정상, 만료, 다른 kid, 다른 iss,
  HS256 거절), nav 처리기(부분 실패, 전부 실패, 캐시).
- 기존 spec이 깨지지 않는지: `worker-routing.spec.ts`, `security-headers.spec.ts`(HTMLRewriter 없음),
  `check-cloudflare-route-coverage.ts`(binding 없음, fetch 거부). 플래그 코드는 binding이 없으면 기본값으로
  떨어지고 응답을 바꾸지 않는다.
- 로컬 통합: `wrangler dev --local`에서 local D1 플래그를 `api`로 바꿔 HTML 주입, ETag 304, `/api/read/nav`를
  확인한다. 브라우저 QA는 `*.supabase.co`를 막고, Worker를 통한 요청만 공유 Supabase(development 행)에 간다.

## 12. 되돌리기

| 상황 | 수단 |
|---|---|
| 한 화면의 `api` 경로가 이상함 | `scripts/runtime-flags.mjs set path.<그룹> legacy`. 30초 안에 새 HTML과 `/api` 거절(409)이 legacy로 보낸다 |
| D1이 응답하지 않음 | 자동으로 `legacy` 기본값 |
| Worker 코드 버그(주입, 라우터) | `wrangler rollback`(사용자 승인). 스키마는 늘리기만 했으므로 이전 버전도 돈다 |
| 변수를 빠뜨린 배포 | 주입하지 않으므로(2.1절) 모든 화면이 legacy로 남는다 |

## 13. 정하지 않은 것

- Realtime: plan은 1단계에 그대로 둔다. 이벤트가 오지 않으므로 `api` 화면에서 채널을 열지 않는 안이
  있다(SURFACE_MAP 5.1절, 8.4절 15번). `toybox-feed`와 `stories`를 옮길 때 사용자에게 묻는다. `nav`와 `comments`에는
  채널이 없다.
- 화면 하나를 한 번에 읽는 Supabase RPC(`get_nav_latest` 등)는 운영 마이그레이션이라 1단계에는 두지 않는다.
  subrequest로 한다.
