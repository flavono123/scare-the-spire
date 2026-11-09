# 1단계 설계: 같은 출처 API(뒤는 Supabase)

관련 문서:

- [Supabase 탈출 계획](../SUPABASE_EXIT_PLAN.md) 7.2절 원칙, 7.3절 1단계
- [Supabase 사용 지도](SURFACE_MAP.md): 화면 32개와 플래그 그룹 9개, 화면별 엔드포인트·응답 계약

## 상태

- 2026-11-05 초안을 쓰고, 여섯 관점(되돌리기, HTTP·런타임, 보안, 클라이언트, 비용, 플랫폼 사실)의 반박 검토를
  받아 고쳤다. 검토에서 바뀐 큰 결정:
  1. **플래그는 HTML 본문이 아니라 응답 쿠키로 알린다**(3.3절). 수 MB짜리 페이지(패치 0.107.1 2.5 MiB)를 모두
     HTMLRewriter로 다시 쓰면 Free 10 ms CPU에 닿는다(로컬 측정 +6~10 ms). 본문을 건드리지 않으면 ETag 조작,
     하위 자원(`/_patches/*.js`) 304 손실, `<head>` 하이드레이션 문제가 함께 사라진다.
  2. **Worker를 1단계 이전 판으로 되돌려도 열린 탭이 legacy로 돌아온다**(4.3절). 라우터 응답에 표식 헤더를 두고,
     표식 없는 응답은 "라우터 없음"으로 본다.
  3. **네비 스냅샷은 D1 한 행에 두고 isolate 하나만 갱신한다**(8.1절). isolate 메모리 캐시만으로는 크롤러 트래픽에서
     Supabase 부하가 줄지 않는다(지금과 비슷한 하루 2.5만~5만 쿼리). D1 행은 원본이 아니라 캐시라서 지워도 된다.
  4. 운영에서는 배포 때 켜는 스위치(`API_RUNTIME_FLAGS`)가 꺼져 있는 한 D1을 읽지도 않는다(2.1절). 모든 플래그가
     `legacy`인 운영은 바이트와 지연 모두 지금과 같다.
- 2026-11-06 00:03 KST 로컬 확인(`wrangler dev`, local D1 `path.nav=api`, Supabase development 행):
  - 브라우저의 `*.supabase.co`를 막은 채 `/`, `/compendium/cards`, `/patches`에서 네비 점(헤더 10개, 패치 페이지
    11개)과 배달부가 `/api/read/nav` 한 번으로 떴다. 브라우저가 Supabase로 보낸 네비·배달부 쿼리는 0건이다.
  - 같은 순간 Supabase를 직접 읽은 legacy 답과 표면 8개의 점, 최신 시각(밀리초까지), 배달부 id가 모두 같았다.
  - `/api/read/nav`가 1단계 이전 Worker처럼 표식 없는 HTML 404를 주게 하자, 페이지가 legacy로 내려와 같은 점과
    배달부를 보였다.
  - 쿠키는 304와 HEAD에도 붙었고, 파일 경로(`/_patches/*.css`)에는 붙지 않았다. QA 쿠키를 보내면 `/api`는
    409 `qa`이고 페이지는 쿠키를 지웠다. 첫 채우기는 0.46초, 그다음은 메모리에서 6 ms였다.
- 2026-11-06 09:20 KST `comments` 로컬 확인(`wrangler dev`, local D1 `path.comments=api`, Supabase development 행,
  브라우저의 `*.supabase.co` 차단, QA용 익명 사용자 하나): 36개 검사 통과.
  - 백과사전 상세(`/compendium/cards/tear_asunder`): 댓글 1, 철학자 답글 5, 버프 합계 1을 공개 읽기 1건과 개인 덧칠
    1건으로 받았고, 같은 순간 Supabase를 직접 읽은 값과 같았다. 브라우저의 댓글 그룹 Supabase 요청은 0건이다.
  - 쓰기: 댓글 작성(새로고침 뒤에도 보임), 댓글 좋아요·해제(수 1→0), 머리 좋아요·해제, 버프 반응·해제(합계 2→1),
    삭제가 모두 Worker를 거쳤다. 셸 패치 릴 반응·해제, 리치 번들이 없을 때의 정적 클라이언트 작성·삭제도 같다(쓴 뒤 다시
    읽지 않음). 확인이 끝난 뒤 QA 사용자의 행은 0개다.
  - 니오우스레터 2026-08: claim 루트 27개를 공개 읽기 1건으로 읽었다(prefetch 전에는 부하에 따라 4~9건).
  - 몬스터 목록의 참여 수는 `/api/read/engagement-counts` 1건이다.
  - `/api/read|me/engagement`가 표식 없는 404를 주게 하자 페이지가 legacy로 내려와 같은 댓글 1과 답글 5를 보였다.
- 2026-11-06 10:00 KST testbed(`pnpm cf:testbed -- --remote`, `f30676a6`·`1f1a0652`): 플래그가 모두 `legacy`일 때
  스모크 205개와 브라우저 QA 13개 통과. 그 뒤 testbed D1에서 `path.nav`·`path.comments`를 `api`로 켰다(그대로 둔다).
  - 쓰기에 `Authorization: Bearer x.y.z`를 보내 401 `token_invalid`. `wrangler tail`에 남은 Worker 로그는
    `api POST write.comments.create 401 token_invalid` 한 줄이고, 토큰 값과 본문은 없다. tail 이벤트의 `authorization`
    헤더는 Cloudflare가 `REDACTED`로 가린다(4.5절 확인).
  - 로컬 댓글 QA 36개를 testbed 주소로 돌려 35개 통과. 남은 하나는 셸 패치 페이지의 배달부 legacy 쿼리다. testbed 패치
    페이지는 production env로 빌드되어 Worker의 development 스냅샷과 env가 달라 네비가 legacy에 남는다(8.2절, testbed만).
  - CPU(tail `cpuTime`, 30번씩): 백과사전 묶음 중앙 5 ms·p90 10 ms·최대 17 ms, 니오우스레터 27개 스레드 중앙 3 ms·p90
    9 ms, 참여 수 중앙 3 ms·p90 7 ms. 같은 날 운영 main Worker 24시간은 p50 1.8 ms·p99 7.5 ms(16,784건, 오류 0)이고,
    14~17 ms 요청도 결과는 `ok`였다. 호출 수를 6에서 4로 줄여도 꼬리는 줄지 않았다(같은 isolate의 GC 등 잡음이 크다).
- 2026-11-06 10:40 KST `colorful-philosophers` 로컬 확인(`492b8497`, 브라우저 Supabase 차단): 15개 통과. 목록은
  `/week` 1건과 반응 합계 묶음 1건, 상세는 `/post` 1건, 셸 패치 릴은 `/reel` 1건이었고 브라우저의 글·답글·합계 Supabase
  요청은 0건이다. 공개된 글 3개, 답글 수(5·3·1), 릴 카드(최신 공개 주 3장)가 직접 읽은 값과 같았다. `/api/read/
  colorful-philosophers/*`가 표식 없는 404를 주게 하자 목록이 legacy로 같은 글을 보였다.
- 2026-11-06 11:30 KST `contact`·`profile`·`puzzlebox`·`history-runs` 로컬 확인(`ea5e4f9a`, 브라우저 Supabase 차단,
  QA 익명 사용자): 42개 통과. 메일함 점·프로필(닉네임 풀, 통계, 활동, 문의)·순위표(세션이면 `/api/me`, 공개 응답과
  같은 행에 `me`만 없음)·내 순위·런 목록(100행 스트림, 원문 그대로)·참여 수·내 런·런 상세가 Worker를 거쳤고, 브라우저의
  해당 Supabase 요청은 0건이다. 프로필 활동에 QA 댓글이 보였다. 런 공유(201)·다시 공유(422)·다른 기증자(403, RLS)·표지
  저장·묶음 공유(중복 건너뜀)·삭제를 합성 런으로 확인했고, QA 행은 0개로 정리했다. 지울 수 없는 쓰기(문의 제출,
  퍼즐상자 제출)는 spec으로만 확인했다. development 런은 모두 같은 `created_at`(일괄 복사)이라 "최신 100"이 쿼리마다
  다른 부분집합이다(legacy도 같다).
- 2026-11-06 12:10 KST testbed(`12a46bd6`): 스모크 205개·브라우저 QA 13개 통과. testbed D1에서 `colorful-philosophers`,
  `contact`, `profile`, `puzzlebox`, `history-runs`도 `api`로 켰다(그대로 둔다). 네 그룹 QA 42/42, 철학자 14/15, 댓글
  회귀 33/36이고, 남은 것은 testbed 패치 페이지 네비의 env 차이(배달부·주간 글 legacy 쿼리)와 한 번씩만 난 타이밍
  실패다(다시 돌려 통과). CPU(tail): 런 목록 5.5 MB 중앙 2 ms·p90 7 ms·최대 8 ms(JS 스트림 봉투였을 때 133 ms), 런
  상세 중앙 3 ms, 철학자 주간 목록 중앙 4 ms.
- 2026-11-06 14:10 KST `stories`·`toybox-feed` 로컬 확인(`2c2ee19e`, 브라우저 Supabase 차단, QA 익명 사용자): 71개 통과.
  홈 이야기 피드(`limit=100`)와 `/patches/changes`(`limit=1000`)가 Worker 한 번씩이고, 행이 직접 읽은 값과 같다. 장난감 상자
  6개 목록(콤보 11, 변형 8, 이거 vs 저거 4, 월드컵 20, 케미컬X 13, 어려운 결정 3행)과 조각모음 게시판(20행)이 RPC를 직접
  부른 값과 같은 순서로 왔고, 6개 상세와 월드컵 후보 통계, 서류 폭풍 목록·임시 저장(`?draft=`)이 Worker를 거쳤다. 브라우저의
  장난감 상자 Supabase 요청은 0건이다. 이거 vs 저거 좋아요·해제와 투표를 화면에서 눌러 Worker로 갔고, 이야기·임시 저장·
  좋아요·투표의 QA 행은 모두 지웠다. 장난감 상자 경로가 표식 없는 404를 주게 하자 콤보 목록이 legacy RPC로 같은 글을
  보였다. 조각모음 게시판의 두 번째 호출은 화면 아래 더 보기이고 legacy도 RPC를 두 번 부른다. 한 번은 Supabase가 느려
  이야기 쓰기가 6.2초에 503을 받았는데 행은 들어가 있었다(9.6절의 늦은 쓰기와 같은 성질, 지움).
- 같은 날 6관점 검토(검토 6, 반박 검증 14)에서 7건이 남아 고쳤다(`2c2ee19e`): 쓰기 응답의 모르는 버전이 legacy 재전송을
  허용하던 것, 이거 vs 저거 토글이 분당 30 쓰기 예산에 걸리던 것, 월드컵 플레이 256경기 상한, 조각모음 글 장애가 "없는 글"로
  보이던 것(9.8절).
- 2026-11-06 14:30 KST testbed(`b9bec0a3`): 플래그를 바꾸기 전 스모크 205개·브라우저 QA 13개 통과. 그 뒤 testbed D1에서
  `stories`·`toybox-feed`도 `api`로 켰다(그대로 둔다, 9개 그룹 모두 `api`). 로컬과 같은 QA 71/71이고 QA 행은 0개로
  정리했다. CPU(tail, 경로마다 30번): 이야기 1,000행 중앙 2 ms·p90 3 ms·최대 8 ms, 장난감 상자 피드(월드컵 51 KB) 중앙
  2 ms·p90 6 ms·최대 10 ms, 글 하나 중앙 2 ms·p90 6 ms, 월드컵 기본 대회 50 KB 중앙 2 ms·p90 4 ms, 조각모음 게시판·서류
  폭풍 목록 중앙 1 ms. 결과는 모두 `ok`, `exceededCpu` 0이다. development 행은 운영보다 작지만 흘려보내는 경로는 JS가 본문을
  만지지 않아 크기와 CPU가 따로 논다(9.6절 5.5 MB 측정과 같다).
- 2026-11-06 14:50 KST main의 알림 릴리스(6커밋)를 합쳤다(`f04bc854`). main은 미래 날짜 패치 셸이 패치 노트 점을 계속
  켜는 버그를 legacy 계산에서만 고쳤다(`df30437c`). api 경로와 패치 Worker 네비가 쓰는 `unreadFromSnapshot`에도 같은
  `catalogHasNewer`를 넣었다(`79dfa5b2`, spec은 고치기 전 판에서 실패). testbed(`79dfa5b2`) 스모크 205개·브라우저 QA 13개
  통과, 모든 네비 표면을 지금 읽은 것으로 두면 패치 노트 점이 api·legacy 모두 꺼진다. 운영 D1(`slseoun-prod`)에는
  마이그레이션 0001·0002가 아직 적용되지 않았다(승인 대기).
- 2026-11-06 16:40 KST testbed를 development 전용으로 바꿨다(`9531ccb6`, 사용자 결정, 10절). 첫 실행은 testbed D1
  마이그레이션 단계에서 Cloudflare API 7403(일시 오류)로 멈췄고, 같은 산출물로 다시 배포해 스모크 205개·브라우저 QA
  13개가 통과했다. 브라우저 Supabase를 막고 `/patches`, `/patches/neowsletters`, `/patches/2026-09-11`을 열면 설정의
  `supabaseEnv`가 `development`이고, 네비가 `/api/read/nav` 1건으로 뜨며 env 불일치 경고가 없다. 2026-09-11은 릴과
  참여 수도 `/api`로 읽는다. 남은 Supabase 요청은 페이지마다 변형 릴 1건(`transfigure_posts`, development 행)뿐이고,
  이는 9.8절에서 1단계에 옮기지 않기로 한 것이다. 운영 `/patches`는 그대로 `production`이다.
- 2026-11-08 11:50 KST 게이트 전 정리(`e7331d14`~`34125e9a`, CLEANUP_AUDIT 5절)를 testbed에 냈다. 스모크 205개·브라우저
  QA 13개 통과. 정리 전 배포본과 정리 뒤 배포본을 같은 13쪽으로 비교했다. 정리가 바꾼 다섯 그룹(`toybox-feed`,
  `history-runs`, `profile`, `contact`, `colorful-philosophers`)을 legacy로 내린 상태와 api인 상태 모두에서 12쪽이 화면
  요약·요청 목록까지 같고, 패치 페이지는 `transfigure_posts` 요청만 빠졌다. 이제 testbed 패치 페이지의 Supabase 요청은
  0건이다. 다섯 그룹은 다시 `api`로 올려 9개 그룹 모두 `api`다.
- 2026-11-08 14:40 KST 1단계를 운영에 냈다(`ff3760fa`, 사용자 승인, 스위치 `off`). 운영 D1 `slseoun-prod`에 0001·0002를
  push 전에 적용했다. 운영 스모크 205개가 통과했고, 배포 전·후 헤더 비교에서 바뀐 것은 `/api/read|me|write/*`의 JSON
  응답뿐이다. 브라우저는 legacy 경로이고 1단계 `/api` 요청 0건, `slseoun_rf` 쿠키 없음이다. 기록은
  [history/2026-11-08.md](../release/history/2026-11-08.md). 운영 `runtime_flags`는 0행이다(모든 그룹 legacy). 그룹을
  켜려면 먼저 `API_RUNTIME_FLAGS`를 `d1`로 바꾸는 배포가 필요하다.
- 이 문서는 모든 화면이 같이 쓰는 기반과 첫 화면 `nav`를 정한다. 다른 화면은 SURFACE_MAP.md 2절을 따르되,
  이 문서 9절의 규칙이 우선한다.

## 1. 순서

1. 기반: 스위치, 플래그, 쿠키, `/api` 라우터, 어댑터, JWT, 클라이언트 헬퍼. 운영은 스위치를 끈 채 배포한다.
2. `nav`: 네비 새 글 표시와 댓글 배달부. 읽기만 하고 사용자와 무관하다.
3. `comments`: 공용 댓글, 백과사전 묶음, 좋아요, 리소스 반응, 목록 참여 수. 첫 쓰기 화면이다.
4. 나머지 그룹(`toybox-feed`, `colorful-philosophers`, `stories`, `history-runs`, `puzzlebox`, `profile`,
   `contact`).

각 그룹은 testbed에서 먼저 켜고(10절), 넘어갈 조건(12절)을 본 뒤 운영에서 켠다. 운영 플래그를 바꾸는 것은
매번 사용자 승인 뒤에 한다.

## 2. Worker 구성

### 2.1 binding과 변수

| 이름 | 종류 | 운영 | testbed | 비고 |
|---|---|---|---|---|
| `DB` | D1 binding | `slseoun-prod` | `slseoun-testbed` | `apac` location hint. 1단계에는 읽기 복제를 켜지 않는다(2.2절) |
| `API_RUNTIME_FLAGS` | var(`wrangler.jsonc`) | `off` | `d1` | `d1`일 때만 D1 플래그를 읽는다. 그 밖의 값은 모두 `legacy` |
| `API_SUPABASE_URL` | var(`--var`) | 프로젝트 URL | 같음 | 저장소에 적지 않는다(지금도 GitHub secret) |
| `API_SUPABASE_KEY` | var(`--var`) | publishable 키 | 같음 | 클라이언트 번들에 이미 있는 공개 키 |
| `API_DATA_ENV` | var(`--var`) | `production` | `development` | 행의 `env` 열. 클라이언트 값을 받지 않는다 |

- 이름을 `API_`로 시작하게 한 이유: [detail-shell-og.ts](../../workers/detail-shell-og.ts)는
  `NEXT_PUBLIC_SUPABASE_*`와 `SUPABASE_*`를 읽는다. 같은 이름을 쓰면 지금 꺼져 있는 OG 보강이 켜진다. 그 안에는
  테이블 오류(SURFACE_MAP 8.3절)가 있고, 상세 HTML마다 Supabase 요청이 생긴다. OG는 1단계 범위가 아니다.
- isolate마다 한 번 값을 검사한다:
  - URL은 끝 슬래시를 떼고 `^https://[a-z0-9]{20}\.supabase\.co$`에 맞아야 한다. 로컬 테스트용
    `http://127.0.0.1:<port>`는 허용한다.
  - 키는 `sb_publishable_`로 시작해야 한다. secret 키가 들어가면 RLS를 건너뛰므로 거절한다.
  - env는 `production` 또는 `development`여야 한다.

  하나라도 틀리면 그 isolate의 실효 플래그는 모두 `legacy`이고, `/api`는 409 `surface_legacy`(사유
  `not_configured`)를 돌려준다. 변수를 빠뜨린 배포가 이미 열린 탭을 깨지 않게 하려는 것이다(4.3절).
- `--keep-vars` 때문에 한 번 들어간 var는 다음 배포에도 남는다. 그래서 var는 kill switch가 아니다. CI는 세 값을
  매번 넘기고, 비었거나 env가 대상과 다르면 배포 전에 실패한다(10절). kill switch는 D1 플래그와
  `API_RUNTIME_FLAGS`다.
- 1단계에는 secret이 없다. 쓰기는 사용자 토큰을 넘기고, JWKS는 공개 값이다.

### 2.2 D1

- `wrangler.jsonc` 최상위와 `env.testbed`에 각각 `d1_databases`를 적는다(named env는 물려받지 않는다).
  `database_id`를 꼭 적는다. 비어 있으면 `wrangler deploy`가 새 DB를 만든다. spec으로 두 id가 다른지 확인한다.
- 마이그레이션은 `d1/migrations/`(`migrations_dir`). Supabase 마이그레이션(`supabase/migrations/`)과 섞지 않는다.
  스키마는 늘리기만 한다(plan 7.2절).
- 읽기 복제는 1단계에 켜지 않는다. 복제본은 얼마든지 늦을 수 있어서(Cloudflare 문서: "arbitrarily out of
  date"), 켜면 플래그 되돌리기의 상한이 없어진다. 끈 뒤 복제본이 멈추는 데에도 24시간까지 걸린다. 1단계의 D1
  읽기는 플래그 10행과 스냅샷 1행이라 복제로 얻을 것이 없다. 3단계에 데이터 읽기용으로 다시 검토한다. 계획서
  1단계의 "읽기 복제 켜기"는 이 판단으로 바꾼다.
- 1단계 테이블: `runtime_flags`, `runtime_flag_events`(3.1절), `api_cache`(8.1절).

## 3. 런타임 플래그

### 3.1 테이블과 바꾸는 법

```sql
CREATE TABLE runtime_flags (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL, note TEXT NOT NULL DEFAULT '');
CREATE TABLE runtime_flag_events (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, value TEXT NOT NULL, at TEXT NOT NULL, note TEXT NOT NULL DEFAULT '');
```

- 키는 `path.<그룹>`, 값은 `legacy` 또는 `api`. 그룹은 SURFACE_MAP 1.2절의 9개다. 행이 없거나 값을 모르면 `legacy`.
- 키 이름에 단계 축을 넣는다. 3단계의 읽기 저장소는 `read.<그룹>`(`supabase` 또는 `d1`), 4·5단계는 그때 정한다.
  한 축의 플래그가 다른 축을 함께 바꾸지 않게 하려는 것이다(plan 7.2절 "한 단계에 한 가지만").
- Worker는 자기 라우터 표에 경로가 있는 그룹만 `api`로 받는다. 그 그룹의 엔드포인트가 없는 Worker 판으로 되돌려도
  플래그가 그 그룹을 켜지 못한다.
- 바꾸는 것은 `scripts/runtime-flags.ts`로만 한다.
  - `--env testbed|production`과 `--remote|--local`을 둘 다 꼭 받는다. wrangler 4의 `d1 execute`는 기본이
    로컬이라서, 빠뜨리면 운영 되돌리기가 로컬 파일에 써지고 성공으로 보인다.
  - 키와 값을 알려진 목록으로 검사한다. 쓰기 전에 대상 DB 이름을 출력하고, 쓴 뒤 같은 행을 원격에서 다시 읽어
    보여 준다. 운영은 `--confirm-production`을 더 받는다.
  - `runtime_flags` upsert와 `runtime_flag_events` insert를 한 번에 보낸다.

### 3.2 Worker가 읽는 법

플래그 값은 isolate 메모리에 둔다. 상태는 셋이다.

| 상태 | 페이지 요청 | `/api` 요청 |
|---|---|---|
| 신선(읽은 지 30초 안) | 그대로 쓴다 | 그대로 쓴다 |
| 낡음(30초~5분) | 그대로 쓰고 `waitUntil`로 다시 읽는다 | 다시 읽고 기다린다(최대 1초). 실패하면 `legacy` |
| 없음(5분 넘음, 처음, 읽기 실패) | "모름". 쿠키를 바꾸지 않고 `waitUntil`로 읽는다 | 위와 같다 |

- 페이지 요청은 D1을 절대 기다리지 않는다. 1단계에서는 `legacy`가 언제나 안전한 쪽이다.
- `/api` 요청은 30초가 지난 값을 쓰지 않는다. 그래서 되돌리기는 30초 + D1 왕복 안에 모든 isolate의 `/api`에
  닿는다(복제를 켜지 않았으므로 복제 지연은 없다).
- 공개 읽기(`/api/read/*`)는 플래그 읽기와 데이터 읽기를 한 D1 batch로 같이 보내고 끝에서 판단한다. 쓰기와
  `/api/me/*`는 플래그를 먼저 확인한다.
- 다시 읽기는 isolate마다 한 번에 하나다. 진행 표시는 promise가 아니라 2초 뒤 풀리는 시각으로 둔다. 다른 요청의
  promise를 기다리지 않는다. 모든 D1 읽기는 `waitUntil`에 건다(요청이 끝나면 취소되지 않게).
- 읽기에 실패하면 마지막 성공 값을 "낡음"으로 유지하고, 실패를 이어서 하면 10초, 30초, 60초로 간격을 늘린다.
- `API_RUNTIME_FLAGS`가 `d1`이 아니면 D1을 읽지 않고 모두 `legacy`다.
- 페이지 요청이란: GET·HEAD이고, `/api/`가 아니며, 파일 경로가 아니다(`/_patches/`, `/images/`, `/fonts/`, 확장자가
  있는 경로. [patch-worker.ts](../../workers/patch-worker.ts)의 `isFilePath`와 같은 규칙). RSC 요청도 포함한다.
  `Accept`로 판단하지 않는다. 브라우저는 스크립트와 CSS에도 `*/*`를 보낸다.

### 3.3 쿠키로 알리기

- 쿠키 `slseoun_rf`. 값은 `v1`과 `api`인 그룹을 점으로 이은 것이다. 예: `v1.nav.comments`. 그룹은 이름순.
- Worker는 페이지 요청의 응답에서, 실효 플래그를 알 때만, 요청에 실려 온 쿠키 값과 다를 때만
  `Set-Cookie`를 보낸다.
  - `api`인 그룹이 있으면 `slseoun_rf=<값>; Path=/; Max-Age=86400; SameSite=Lax`, https면 `; Secure`.
  - 없으면(모두 `legacy`) 쿠키가 실려 왔을 때만 `Max-Age=0`으로 지운다.
  - 실효 플래그를 모르면(3.2절 "없음") 보내지 않는다. 차가운 isolate가 사용자를 legacy로 흔들지 않게 한다.
- `Set-Cookie`는 304와 HEAD에도 붙는다. 본문과 ETag와 `Cache-Control`은 건드리지 않는다. 그래서 브라우저 캐시의
  304 재검증이 지금 그대로 동작한다.
- 응답 헤더는 `withSecurityHeaders`가 만든 사본에 붙인다. 서비스 binding과 redirect 응답의 헤더는 바꿀 수 없다.
- 쿠키는 기능 쿠키이고 사용자를 식별하지 않는다. 요청마다 약 20바이트가 붙는다. 정적 asset 요청은 Worker를
  거치지 않으므로 쿠키를 받기만 하고 무시한다.
- 크롤러가 쿠키를 받지 않으면 `legacy`로 남는다(지금과 같다).
- 계획서 7.3절의 "플래그는 Worker가 HTML에 넣어 준다"는 이 방식으로 바꾼다. 3단계의 첫 데이터 HTML 주입은 그때
  CPU 문제를 따로 풀어야 한다(앞부분만 읽고 나머지는 native pipe로 흘리는 방식 등). 상태 절의 측정을 참고한다.

### 3.4 QA 쿠키

브라우저 QA의 `*.supabase.co` 차단은 Worker가 대신 부르는 Supabase 요청을 막지 못한다. 그래서 Worker가
아래 쿠키를 따른다.

- `slseoun_qa=no-supabase`: 그 요청의 실효 플래그는 모두 `legacy`이고 `slseoun_rf`를 지운다. `/api`는 Supabase를
  부르지 않고 409를 낸다. Playwright(`PLAYWRIGHT_BLOCK_SUPABASE=1`)와 모바일 QA 스크립트(`--allow-supabase`가 없을
  때)가 사이트 출처에만 넣는다. 사용자에게 해가 없으므로 운영에서도 따른다.
- `slseoun_qa_path=<그룹>.<그룹>`: 그 그룹을 `api`로 고정한다. `API_DATA_ENV=development`일 때만 따른다. testbed
  spec이 D1 플래그 상태와 상관없이 자기가 시험할 경로를 고르게 하려는 것이다.
- 헤더가 아니라 쿠키인 이유: Playwright의 `extraHTTPHeaders`는 다른 출처 요청에도 붙어 preflight를 만든다.
  쿠키는 출처별이다.

## 4. `/api` 라우터

### 4.1 위치와 경로

- `mainWorker.fetch`에서 `routeRequest`보다 먼저 본다. `/api/read/`, `/api/me/`, `/api/write/`로 시작하는 경로만
  가져간다. `/api/link-preview`와 `/api/search-index`(별칭)는 지금 길로 간다. `/api/patches…`처럼 패치 Worker
  정규식에 걸리는 이름도 라우터가 먼저 받는다.
- `wrangler.jsonc`의 assets에 `"run_worker_first": ["/api/*"]`를 둔다(testbed도). `public/api/`에 파일이 생겨도
  라우터를 가리지 않는다. 정적 asset 검사(`check-cloudflare-static-assets.ts`)는 `/api/` 아래 asset이 있으면
  실패한다.
- 경로 표 항목: `{ method, path, group, access: "public" | "me" | "write", handler, query }`. 경로는 정확히 맞아야
  하고 끝 슬래시를 받지 않는다. HEAD는 GET 처리기를 `allowUpstream: false`로 부른다(메모리·D1 캐시로만 답하고
  Supabase를 부르지 않는다). OPTIONS는 204와 `Allow`.
- 쿼리 검사: 항목마다 받는 매개변수와 형식이 있다. 모르는 매개변수, 같은 매개변수가 두 번 나오면 400 `invalid`.
  캐시 키는 정렬하고 중복을 없앤 값으로 만든다. PostgREST URL은 정해진 필터로만 만들고 클라이언트의 `select`,
  `order`, `limit`, `offset`, `or`, `and`를 넘기지 않는다.

### 4.2 응답

- 모든 라우터 응답에 `X-Slseoun-Api: 1`, `Content-Type: application/json; charset=utf-8`, `X-Robots-Tag: noindex`.
  CORS 헤더는 보내지 않는다.
- `Cache-Control`: 기본은 `private, no-store`. `access: "public"`인 성공 응답만 `public, max-age=N`을 쓸 수 있고,
  N은 플래그 TTL(30초)을 넘지 않는다. 오류는 모두 `no-store`.
- 오류 형식: `{ "error": "<code>" }`, 409는 `{ "error": "surface_legacy", "reason": "<사유>" }`.

  | 상태 | code | 언제 |
  |---|---|---|
  | 400 | `invalid` | 쿼리·본문 검사 실패 |
  | 401 | `token_expired` | 토큰 만료, PostgREST의 401(PGRST30x). 클라이언트는 한 번만 갱신하고 다시 보낸다 |
  | 401 | `token_invalid` | 서명·발급자·대상·역할·sub 검사 실패. 갱신하지 않는다 |
  | 403 | `forbidden`, `cross_site` | RLS 거절(42501), 교차 사이트 쓰기 |
  | 404 | `not_found` | 대상이 없음(0행). 경로가 없을 때는 쓰지 않는다 |
  | 405 | `method_not_allowed` | |
  | 409 | `surface_legacy` | legacy로 가라는 뜻(4.3절). 다른 뜻으로 409를 쓰지 않는다 |
  | 413 | `too_large` | 본문 상한 초과(스트림 바이트로 센다) |
  | 422 | `check_violation`, `duplicate` | 23514, 23505 |
  | 429 | `rate_limited` | |
  | 503 | `unavailable`, `auth_unavailable` | Supabase 시간 초과·5xx·연결 실패. 모르는 kid인데 JWKS를 받지 못함. `Retry-After: 30` |

### 4.3 legacy로 돌려보내는 신호

"이 Worker는 이 호출을 처리할 수 없다"는 모두 409 `surface_legacy`다. 사유(`reason`)는 기록용이다.

- `flag`: 그룹 플래그가 `legacy`
- `no_route`: `/api/read|me|write/` 아래의 모르는 경로
- `not_configured`: 2.1절 변수 검사 실패
- `off`: `API_RUNTIME_FLAGS`가 `d1`이 아님
- `qa`: `slseoun_qa=no-supabase`

클라이언트(7절)는 다음을 모두 "legacy로 가라"로 본다: 409 `surface_legacy`, 그리고 `X-Slseoun-Api` 표식이 없는
`/api` 응답. 표식이 없다는 것은 라우터가 없는 Worker(1단계 이전 판으로 되돌린 경우)이거나 Cloudflare 오류
페이지라는 뜻이다. 1단계 이전 Worker는 `/api/*`에 HTML 404를 준다(`main-worker.ts:441-457`).

### 4.4 교차 사이트 쓰기

- 1단계 쓰기는 `Authorization: Bearer` 헤더로만 인증하고 쿠키 신원이 없다. 그래서 CSRF는 구조적으로 성립하지 않는다.
- 그래도 심층 방어로, GET·HEAD가 아닌 요청은 `Sec-Fetch-Site`가 `cross-site`나 `same-site`이면, 또는 `Origin`이
  있는데 요청 출처와 다르면(`null` 포함) 403 `cross_site`다. 둘 다 없으면 받는다(옛 브라우저). JWT 검사와 본문
  읽기보다 먼저 한다. 4단계에 쿠키 신원이 생기면 다시 검토한다.

### 4.5 로그

- 라우터가 남기는 줄은 `api <method> <route id> <status> <code>` 하나다. 경로는 `redactPathname`을 거친다.
- 헤더, 토큰, sub, 요청·응답 본문, PostgREST의 `message`·`details`·`hint`는 남기지 않는다. PostgREST `details`에는
  행 내용(닉네임, 본문, user_id)이 들어 있다. 어댑터는 이 값을 결과에 담지도 않는다.
- `comments`를 켜기 전에 testbed 쓰기 경로에 `Authorization: Bearer x.y.z`를 보내 401을 받고, `pnpm cf:logs --json`에서
  헤더가 남지 않는지 확인한다.

## 5. Supabase 어댑터

- `workers/api/supabase-rest.ts`. supabase-js가 아니라 `fetch`로 PostgREST를 부른다. Worker 번들에 supabase-js가
  들어가면 `cf:size`가 실패하게 한다.
- 헤더: `apikey: <API_SUPABASE_KEY>`, `Accept: application/json`. 사용자 토큰이 있을 때만
  `Authorization: Bearer <토큰>`. publishable 키를 Bearer로 넣지 않는다.
- 공개 읽기 처리기는 토큰 인자가 없는 어댑터를 받는다. 개인 데이터는 `access: "me"`와 `"write"` 처리기만 다룬다.
- 모든 쿼리에 `env=eq.<API_DATA_ENV>`를 Worker가 붙인다. 쓰기 본문의 `env`와 `user_id`도 Worker가 채운다.
- 동시 요청: Workers는 응답 헤더를 기다리는 연결을 한 번에 6개까지만 연다. 나머지는 줄을 서고, 그동안 시간 제한이
  흐른다. 그래서 한 요청 안의 PostgREST 호출은 한 번에 5개까지 보낸다(D1·JWKS 호출 자리를 남긴다). 시간 제한은
  보낼 때 시작한다.
- 시간 제한: 읽기 하나 4초, 쓰기 6초. 한 엔드포인트 전체는 클라이언트 8초보다 짧게. 네비 스냅샷은 8.1절(사용자가
  기다리는 첫 채우기 6초, 뒤에서 도는 갱신 10초).
- 결과는 `{ ok: true, data }` 또는 `{ ok: false, status, code }`. `code`는 PostgREST·Postgres 코드이거나
  `timeout`, `network`, `bad_response`, `http_<상태>`다.
- 화면마다 저장소 인터페이스를 두고(`NavSource` 등) Supabase 구현만 만든다. 3단계에 D1 구현을 더한다.
- 행을 화면 모양으로 바꾸는 함수는 `src/lib`의 import 없는 순수 모듈로 두고 두 경로가 같이 쓴다.
  supabase-js나 큰 JSON을 끌고 오는 모듈(`nav-seen.ts`, `colorful-philosophers.ts`)은 Worker가 import하지 않는다.

## 6. JWT 검증

- `workers/api/jwt.ts`. `Authorization: Bearer <access_token>`만 받는다(URL로 받지 않는다).
- 순서(값싼 검사부터):
  1. 길이 8 KB 이하, 세 조각, base64url
  2. 서명 전 payload로 `iss = <API_SUPABASE_URL>/auth/v1`, `aud`에 `authenticated`, `role = authenticated`,
     `sub`가 uuid, `exp`가 숫자인지 본다. 틀리면 401 `token_invalid`. JWKS를 찾기 전에 걸러서, 아무 토큰으로나
     JWKS를 받게 만들 수 없게 한다.
  3. 헤더 `alg = ES256`, `kid` 128자 이하
  4. 키 찾기: 고정 키 → 받아 둔 JWKS. 둘 다 없으면 JWKS를 받는다. 받는 것은 isolate마다 1분에 한 번까지이고, 어떤
     kid든 같은 쿨다운을 쓴다(kid별 표를 두지 않는다). 진행 중인 받기는 함께 쓴다. 시간 제한 2초, 본문 16 KB.
     받은 뒤에도 없으면 `token_invalid`, 받지 못했으면 503 `auth_unavailable`.
  5. WebCrypto ECDSA P-256 SHA-256 서명 확인. 실패하면 `token_invalid`
  6. `exp - 5 > now`. 아니면 401 `token_expired`(PostgREST에 닿기 전에 만료될 토큰을 미리 걸러 갱신을 부른다).
     `iat`가 `now + 30`보다 뒤면 `token_invalid`
- 고정 키(`workers/api/supabase-jwks.ts`, 2026-11-05에 받은 ES256 키 하나)는 시작값이다. 1단계에서는 PostgREST가
  토큰을 다시 검증하므로 Worker 검사는 심층 방어다. Worker가 유일한 검증자가 되는 4단계 전에 키 목록을 D1로
  옮기고 폐기(revocation) 절차를 둔다.
  - 2026-11-09 만들었다(`step4/prereqs`). D1 `api_verification_keys`(`d1/migrations/0007`, 쿼리 K1~K5)가 고정 키
    위에 얹힌다. 고정 키는 그 kid의 행이 없으면 그대로 믿고, 행이 있으면 행이 정한다. `revoked_at`이 없는 행은 키를
    더하고, 있는 행은 그 kid를 받은 JWKS에 있어도 거절한다(키 찾기 전에, JWKS를 받지 않고). 표가 비었거나 아직 한
    번도 못 읽었으면 고정 키만 믿고 아무것도 폐기하지 않는다(지금과 같다). 읽기 실패는 마지막 성공 값을 둔다.
  - 읽기(K1)는 isolate마다 1분에 한 문장까지다(성공·실패 모두). 토큰을 검증하는 요청(`/api/me`·`/api/write`의
    bearer, claim)만 읽고, 진행 중인 읽기는 시작 뒤 1초까지만 기다린다. 쿠키만 있는 요청은 읽지 않는다.
  - 바꾸기는 `scripts/verification-keys.ts`(`list`, `add --jwk`, `revoke <kid>`, 되돌리기 `unrevoke <kid>`)로만
    한다. `runtime-flags.ts`처럼 `--env`, `--remote|--local`, `--note`가 필요하고 운영 쓰기는 `--confirm-production`.
    폐기 절차: Supabase에서 키를 바꿔 새 세션이 새 키로 서명되게 하고 → 새 키를 `add` → 옛 키를 `revoke`(1분 안에
    모든 isolate). 옛 키로 서명된 access token을 든 브라우저는 `/api/me`·`/api/write`(그 토큰으로 하는 claim도)마다
    `token_invalid`를 받는다. 클라이언트는 `token_invalid`에 갱신하지 않으므로(`token_expired`에만 갱신, 7절) 이 오류는
    supabase-js가 제 일정대로 세션을 갱신할 때(토큰 만료 직전, access token 수명 기본 1시간, 새 토큰은 새 키로 서명)까지,
    또는 갱신된 토큰으로 다시 claim할 때까지 이어진다. 이미 claim한 서명 쿠키 신원은 키와 상관없다. 그래서 정기 회전은
    Supabase에서 바꾼 뒤 access token 수명 이상 기다렸다가 `revoke`하고, 키가 샌 경우에만 바로 `revoke`한다(그만큼
    실패를 감수한다). 고정 키를 폐기했으면 다음 배포에서 `supabase-jwks.ts`에서도 뺀다(첫 D1 읽기가 실패한 isolate는
    고정 키만 보기 때문).
    레거시 HS256(`API_SUPABASE_LEGACY_JWT_SECRET`, claim 전용)은 kid가 없어 이 표로 폐기하지 않고 secret을 지운다.
- 검증한 `sub`만 신원으로 쓴다. 클라이언트가 보낸 `user_id`는 받지 않는다.
- Worker는 토큰을 갱신하지 않는다.

## 7. 클라이언트

- `src/lib/runtime-flags.ts`:
  - `surfacePath(group)`: 부를 때마다 `document.cookie`의 `slseoun_rf`를 읽는다(값이 `v1.`로 시작하지 않으면
    무시). 그리고 이 페이지에서 내린 그룹이면 `legacy`다. 다른 탭의 새 페이지가 쿠키를 바꾸면 열린 탭에도 닿는다.
  - `demoteSurface(group)`: 이 페이지가 살아 있는 동안 그 그룹을 `legacy`로 둔다.
  - 페이지 안 공유 상태(내린 그룹, 네비 스냅샷 요청)는 `window.__slseounRuntime`에 둔다. 패치 페이지에는 서로 다른
    번들(esbuild IIFE 여럿, 정적 `patch-comments-client.js`)이 있어서 모듈 변수로는 공유되지 않는다.
- 규칙: 렌더 중에 플래그를 읽지 않는다. 효과(effect)와 이벤트 처리에서만 읽는다. 렌더 중에 보는
  `supabaseEnabled` 검사(버튼 비활성화 등)는 빌드 상수로 그대로 둔다. CI 빌드에서는 늘 true다
  (`cloudflare-workers.yml`이 env를 확인한다). 효과와 처리기 안의 `supabaseEnabled` 검사만 `api` 경로에서 건너뛴다.
- `src/lib/api-client.ts`: `apiFetch(group, path, init)`. 절대 경로 `/api/...`만 쓴다. 시간 제한 8초.
  - legacy 신호(4.3절)를 받으면 `demoteSurface` 뒤 `SurfaceLegacyError`를 던진다. 호출부는 legacy 경로로 한 번
    다시 한다.
  - 쓰기의 자동 재시도는 처리되지 않았음이 확실할 때만 한다. 409 `surface_legacy`이거나, 표식 없는 404·405(라우터가
    없는 Worker)다. 표식 없는 5xx 뒤에는 쓰기를 legacy로 다시 보내지 않는다. 두 번 쓸 수 있다.
  - 401 `token_expired`: supabase-js로 갱신하고 한 번만 다시 보낸다. `token_invalid`과 503에는 갱신하지 않는다.
  - 그 밖의 4xx는 코드가 든 `ApiError`. 네트워크 오류·시간 초과·표식 있는 5xx는 `ApiUnavailableError`.
- 503에 legacy로 가지 않는다. 같은 Supabase를 브라우저가 한 번 더 부를 뿐이라서, 지금의 "응답 없음" 화면을 보인다.
- 패치 정적 클라이언트(`patch-comments-client.js`)는 같은 쿠키와 `window.__slseounRuntime`을 읽는 작은 함수를
  따로 둔다. `api` 경로에서 세션 갱신이 실패하면 새 익명 가입으로 넘어가지 않는다(지금은 넘어가서 uid를 덮어쓴다).
  이 규칙은 `comments`를 옮길 때 적용한다.

## 8. 네비(`nav`)

### 8.1 엔드포인트

`GET /api/read/nav`. `access: "public"`, 그룹 `nav`, 매개변수 없음.

```json
{
  "v": 1,
  "env": "production",
  "fetchedAt": "2026-11-05T12:00:00.000Z",
  "latest": {
    "combo": "2026-11-04T09:12:33.120Z", "transfigure": null,
    "this-or-that": "…", "favorite-tournament": "…", "chemical-x": "…",
    "decisions-decisions": "…", "pagestorm": "…", "history-course": "…"
  },
  "weekly": { "colorful-philosophers": "2026-11-02" },
  "courier": [{ "id": "…", "storyId": "sts2-codex:card:…", "text": "…", "createdAt": "…" }]
}
```

Supabase 읽기(갱신할 때만):

- `latest`: 8개 테이블마다 `select=created_at&env=eq.<env>&created_at=not.is.null&order=created_at.desc&limit=1`.
  `created_at`이 비어 있는 행을 거르는 이유: Postgres 내림차순은 NULL이 먼저라서, 그런 행 하나가 최신값을 가린다.
  값은 `new Date(x).toISOString()`으로 맞춘다(PostgREST는 마이크로초와 `+00:00`을 주고, 클라이언트는 문자열로
  비교한다).
- `weekly`: `colorful_philosopher_posts`의 `week_start <= 이번 주 월요일(KST)` 가운데 최신 `week_start`.
- `courier`: `comments`의 최근 14일 12개, `id, story_id, content, created_at`. `text`는
  `courierCommentText(content)`를 160자로 자른 것(넘으면 `…`). 빈 줄은 뺀다.
- 테이블 목록과 KST 주 계산은 import 없는 `src/lib/nav-surfaces.ts`에 두고 `nav-seen.ts`·`colorful-philosophers.ts`와
  Worker가 같이 쓴다. 서비스가 늘어도 두 경로가 갈라지지 않는다.
- 10개 호출은 한 번에 5개씩 두 번에 보낸다. 처음 묶음에 배달부와 철학자를 넣는다(색인이 없어 가장 느리다).

캐시(원본은 늘 Supabase이고, 아래는 모두 지워도 되는 캐시다):

- D1 `api_cache` 한 행(`key='nav'`): `body`(위 JSON), `fetched_at`, `lease_until`, `fail_count`, `fail_until`.
- isolate 메모리에 30초. 메모리에 없으면 플래그와 함께 D1 batch 한 번으로 읽는다.
- `fetched_at`이 60초를 넘었으면 갱신 임대를 시도한다. 임대는 조건부 UPDATE(`lease_until < now`이고
  `fail_until <= now`)로, 이긴 isolate 하나만 `waitUntil`에서 Supabase를 읽는다. 나머지는 지금 값을 준다. 그래서
  Supabase의 네비 부하는 트래픽과 상관없이 하루 1,440번 × 10건 이하다.
- 갱신에서 일부 테이블이 실패하면 그 테이블만 지난 값을 유지한다. 실패 때문에 TTL을 줄이지 않는다. 모두 실패하면
  `fail_count`를 올리고 `fail_until`을 60초, 120초, 300초로 늘린다. 모든 isolate가 같이 물러선다.
- 행이 없거나 `fetched_at`이 24시간을 넘었을 때만 요청이 직접 기다린다(임대를 이긴 경우, 전체 6초. 클라이언트 8초에서
  플래그 대기 1초를 뺀 안). 임대를 지면 지난 값을 주고, 값이 아예 없으면 503 `unavailable`.
- 뒤에서 도는 갱신(`waitUntil`)은 아무도 기다리지 않으므로 전체 10초까지 준다. 2026-11-06 00:01 KST 로컬 확인에서
  Supabase가 느린 시간대에 단순 읽기가 건마다 2.4초 걸렸고, 3.5초 마감에서는 10건이 모두 실패했다. 임대는 15초다.
- 응답 `Cache-Control: public, max-age=30`. 503은 `no-store`이고 `Retry-After: 30`.
- 비용: D1 읽기는 메모리에 없을 때 플래그 약 10행 + 1행, 쓰기는 갱신마다 2행(하루 3천 행 이하). Free 한도의 1% 안팎이다.

### 8.2 클라이언트

- `src/lib/nav-snapshot.ts`: `loadNavSnapshot()`. 진행 중인 요청과 받은 값을 `window.__slseounRuntime`에 30초 둔다.
  네비, 배달부, 패치 페이지의 두 스크립트가 요청 하나를 같이 쓴다.
- 응답의 `env`가 빌드의 `supabaseEnv`와 다르면 그 페이지는 `nav`를 legacy로 내린다(경고 로그). 본 시각 저장소도
  env별이라 섞으면 점이 틀린다. testbed는 main·패치 페이지 모두 development로 빌드해 Worker와 같다(10절).
- `fetchUnreadSurfaceIds(seen)`(`nav-seen.ts`)는 어느 경로에서도 거부(reject)하지 않는다.
  - 패치 노트·니오우스레터: 번들 JSON으로, 스냅샷 결과와 상관없이 계산한다.
  - 테이블 표면: `latest[id] > since[id]`. 철학자: `weeklyPublishedAt(weekly) > since`.
  - 스냅샷에 키가 없으면(서버가 모르는 새 서비스) 그 표면만 legacy 쿼리로 본다.
  - legacy 신호면 전체를 legacy로 다시 한다. 503이나 시간 초과면 테이블 표면은 점 없음, 카탈로그 점은 그대로다.
- 탭별 60초 unread 캐시(`sts-nav-unread:`)는 그대로 둔다.
- 배달부(`comment-courier.tsx`): `nav`가 `api`면 스냅샷의 `courier`를 쓴다.
- 패치 페이지: `patch-nav-indicators-client.ts`는 `fetchUnreadSurfaceIds`를 그대로 쓴다. `patch-comments-client.js`의
  배달부는 `api` 분기를 `!config` 검사보다 앞에 둔다(빌드에 Supabase 설정이 없어도 동작하게).

### 8.3 요청 수

- 지금: Next 페이지마다 Supabase 9~10건과 preflight, 패치 페이지마다 10건(캐시 없음). 크롤러가 하루 2.5만~5만 건.
- `nav = api`: 브라우저가 30초에 한 번 이하로 `/api/read/nav` 1건(Workers 요청). Supabase는 계정 전체에서 1분에
  한 번 이하로 10건(하루 1.44만 건 이하).
- Workers 요청은 JS를 실행하는 페이지 조회만큼 는다. 검토 추정: main 하루 1만~2.2만, 비관적으로 3.4만~4만.

## 9. 다른 화면을 옮길 때

- 엔드포인트와 응답은 SURFACE_MAP 2절의 그 화면 표를 따르되, 아래가 우선한다.
- **공개 읽기에는 개인 필드가 없다.** SURFACE_MAP의 `likedByMe`, `mine`, `myLikes`, `viewer`, `viewerKind(s)`,
  `is_me`, `me`, around_me처럼 JWT로 고르는 필드는 `/api/read/*`에서 빼고, 그룹마다 `/api/me/<그룹>` 덧칠 한 번으로
  준다. 공개 응답은 `Authorization`이 있든 없든 바이트가 같아야 한다(spec으로 확인).
- 매개변수는 4.1절 규칙을 따른다. 스레드 키는 `comment-threads.ts`의 문법에 맞고 1 KB 이하, `prefix`는 정해진
  목록(`sts2-codex:<알려진 종류>:`, `neowsletter:<YYYY-MM>:`)에서만, 키 목록은 개수 상한을 둔다.
- 쓰기는 `Prefer: return=representation`으로 0행을 404로 구별한다. `contact_inquiries`만 `return=minimal`이다.
- 첫 쓰기 그룹(`comments`)과 함께 rate limit binding을 더한다(운영과 testbed namespace를 따로). 쓰기는 검증한
  sub로, 캐시에 없는 공개 읽기는 `cf-connecting-ip`로 센다. 읽기와 쓰기의 한도가 달라 binding을 둘로 나눴다(9.1절).
- 응답이 128 KB를 넘을 수 있는 화면은 상한이나 페이지를 둔다(SURFACE_MAP 8.2절).
- 응답 모양은 늘리기만 한다. 필드를 지우거나 뜻을 바꾸려면 새 경로를 만든다. 클라이언트는 모르는 `v`를 legacy
  신호로 본다.
- 파일은 `workers/api/routes/<그룹>.ts`. 라우터 표는 그룹 파일이 내보내는 목록을 모은다.

### 9.1 댓글(`comments`)

SURFACE_MAP 2.2절 5~9번과 10번의 `threads`를 덮는다. 엔드포인트 이름은 SURFACE_MAP 1.2절의 안
(`/api/read/thread`, `codex-thread`)을 아래로 바꾼다. 화면마다 묶음 엔드포인트를 두는 대신, 읽기 하나를 두고
클라이언트가 같은 순간의 요청을 하나로 모은다. 백과사전 상세, 니오우스레터, 장난감 상자 상세가 모두 같은 길을 쓴다.

**공개 읽기** `GET /api/read/engagement` (`access: "public"`, `Cache-Control: private, no-store`)

| 매개변수 | 형식 | 상한 | 응답 |
|---|---|---|---|
| `threads` | 스레드 키를 `,`로 이음 | 64개 | `threads: { <키>: Comment[] }` |
| `likes` | 스레드 키 | 16개 | `likes: { <키>: 수 }` |
| `reactions` | `<종류>:<id>:<버전>` | 64개 | `reactions: { <대상>: { buff, nerf, rework } }`(행이 없으면 0) |
| `philosophers` | `<종류>:<id>` | 4개 | `philosophers: { <자원>: 행[] }`. 그 글들의 답글 스레드와 반응 합계도 `threads`·`reactions`에 넣는다 |

- 하나는 있어야 하고, 쿼리 문자열 전체는 6,000자 이하다.
- 스레드 키는 `^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$`. 2026-11-06 두 env의 `comments`·`likes` 키 전부(372개)가 이 문자만
  쓴다. 대상의 종류는 `[a-z_-]{1,32}`, id는 `[A-Za-z0-9._-]{1,128}`, 버전은 `[A-Za-z0-9._-]{1,32}`. 검사 함수는
  import 없는 `src/lib/engagement-keys.ts`에 두고 Worker와 클라이언트가 같이 쓴다. 클라이언트는 검사를 통과하지 못하는
  키를 legacy로 읽는다(400을 화면 오류로 만들지 않는다).
- `Comment`는 legacy 행과 같은 snake_case 열(`id, story_id, user_id, nickname, content, content_blocks, created_at,
  avatar_id, avatar_kind, palette_id, palette_swapped`)에 `like_count`를 더한 것이다. `user_id`는 지금도 공개 읽기로
  보이고 작성자 표시(`userId === comment.user_id`)에 쓴다. `parent_id`·`meta`는 주지 않는다. 클라이언트 매핑이 그대로다.
- Supabase 호출: 스레드는 `comments?select=<열>,comment_likes(count)&story_id=in.(…)&order=created_at.asc&limit=1000`
  한 번(댓글 좋아요를 행마다 세는 지금 방식 대신 임베드 count). 좋아요 수는 키마다 HEAD `count=exact`. 반응은
  `resource_reaction_counts`를 `resource_id=in.(…)`로 한 번 읽고 대상으로 거른다(지금 `fetchResourceReactionCounts`와
  같다). 철학자 글은 자원마다 `week_start` 내림차순 20개다.
- Supabase 호출 하나가 Worker CPU 약 0.5~1 ms라서(testbed 측정: 호출 0개 중앙 1 ms, 1개 2 ms, 6개 5 ms·p90 8 ms·최대
  14 ms) 호출 수를 줄인다. 반응 합계는 철학자 자원의 id까지 넓혀 한 번에 읽어 각 글의 버전 합계를 따로 읽지 않는다.
  철학자 글을 요청하면 스레드와 답글 스레드를 글을 읽은 뒤 한 쿼리로 읽는다. 백과사전 상세는 글, 합계, 좋아요 수,
  댓글 행의 4번이다. 철학자 글이 없으면 스레드는 첫 묶음에서 바로 읽는다.
- 부분 실패: 한 부분이 실패하면 그 부분을 빼고 `unavailable: ["reactions"]`처럼 이름을 적는다. 지금 훅이 따로 실패하는
  것과 같게 화면의 그 부분만 "응답 없음"이다. 모두 실패하면 503.
- 캐시는 두지 않는다. 쓴 사람이 다시 불러도 자기 댓글이 보여야 한다. 지금도 매번 Supabase를 읽는다. 캐시는 3단계에서 본다.
- 상한: 엔드포인트 전체 6.5초(클라이언트 8초에서 플래그 대기 1초를 뺀 안). 모든 PostgREST 호출이 남은 시간만 쓰고,
  150 ms 아래로 남으면 보내지 않는다. 철학자의 두 번째 묶음은 1초 넘게 남았을 때만 읽는다(못 읽은 것은 위젯이 따로 부른다).
  댓글 행 한 묶음의 본문은 1 MB까지 스트림 바이트로 센다. 넘으면 `threads`를 `unavailable`로 둔다. 행마다 128 KB인
  `content_blocks`를 심어 페이지 읽기를 CPU·메모리 한도로 밀어내지 못하게 하려는 것이다(어댑터 기본 상한은 2 MB).

**개인 덧칠** `GET /api/me/engagement` (`access: "me"`): `threads`, `likes`, `reactions`를 같은 형식으로 받아
`commentLikes: { <키>: 내가 누른 댓글 id[] }`, `likes: { <키>: true|false }`, `reactions: { <대상>: kind|null }`.
댓글 좋아요는 `comment_likes?select=comment_id,comments!inner(story_id)&user_id=eq.<sub>&comments.story_id=in.(…)`
한 번이라 공개 읽기를 기다리지 않는다. sub는 검증한 토큰에서만 온다.

**쓰기** (`access: "write"`, 본문은 `application/json`, 160 KB 이하)

| 경로 | 본문·매개변수 | 하는 일 | 응답 |
|---|---|---|---|
| `POST /api/write/comments` | `{ threadKey, nickname, content, contentBlocks?, author? }` | insert(user_id = sub, env = Worker), `return=representation` | 201 `{ comment }` |
| `DELETE /api/write/comments?id=` | uuid | delete `id`·`user_id = sub`, `return=representation` | `{ deleted: true }`, 0행이면 404 |
| `PUT·DELETE /api/write/comment-likes?id=` | 댓글 uuid | insert(23505는 이미 누름) 또는 delete, 뒤에 HEAD count | `{ liked, count }`, 댓글이 없으면(23503) 404 |
| `PUT·DELETE /api/write/likes?key=` | 스레드 키 | 같음 | `{ liked, count }` |
| `PUT /api/write/reactions` | `{ resourceType, resourceId, gameVersion, kind }`, kind는 buff·nerf·rework·null | null이면 delete. 아니면 PATCH kind, 0행이면 insert, 23505면 PATCH 한 번 더. 이전 kind를 localStorage가 아니라 DB로 정한다 | `{ kind, counts }` |

- 본문 검사: nickname은 trim 뒤 1~20자, content는 2~2,000자(DB CHECK와 지금 클라이언트 검사), `contentBlocks`는 배열
  이나 null이고 JSON 128 KB 이하, `author`는 `avatarId`·`avatarKind`·`paletteId`(64자 이하 문자열 또는 null)와
  `paletteSwapped`(boolean 또는 null). `author`가 없으면 그 열을 보내지 않는다(DB 기본값, 지금 `use-comments.ts`와 같다).
- 오류: 23514 → 422 `check_violation`, 42501 → 403 `forbidden`, PostgREST 401 → 401 `token_expired`, 그 밖의
  4xx → 400 `invalid`, 시간 초과·5xx → 503.
- 쓰기 응답이 새 상태를 돌려주므로 클라이언트는 다시 읽지 않는다. 정적 패치 클라이언트의 "쓰고 다시 읽기 2~3건"도 없어진다.
- 쓰기가 반영된 뒤 수·합계 읽기만 실패하면 200에 `count: null`·`counts: null`을 준다. 실패로 답하면 클라이언트가
  반영된 쓰기를 되돌려 보여 주기 때문이다. 클라이언트는 null이면 낙관적으로 고친 값을 그대로 둔다. 쓰기들도 같은 6.5초
  상한을 쓴다.

**rate limit**: binding 둘을 둔다(9절의 `API_LIMITER` 하나를 바꾼다). 한 binding은 한도가 하나라서 읽기와 쓰기를
나눴다.

- `API_READ_LIMITER`: 60초 600건, 키 `cf-connecting-ip`. 캐시 없는 공개 읽기(`engagement`, `engagement-counts`)에만.
- `API_WRITE_LIMITER`: 60초 30건, 키는 검증한 sub. 쓰기와 `/api/me/*`.
- 운영 namespace `1101`·`1102`, testbed `1201`·`1202`(`1001`·`1002`는 링크 미리보기가 쓴다). 한도는 Cloudflare
  위치마다 따로 세고 대략적이다.
- binding이 없거나 `limit()`이 실패하면 막지 않는다. 막힘은 429 `rate_limited`.
- 이 계정에서 binding을 쓸 수 있는 것은 운영의 `LINK_PREVIEW_LIMITER`가 이미 보여 준다.

**목록 참여 수** `GET /api/read/engagement-counts`: `rpc/get_engagement_counts(p_env)`를 그대로 부르고 지금 훅과 같은
`{ likes, comments }`를 준다. 접두사 거르기는 이야기·베타 아트의 동작을 바꾸므로(SURFACE_MAP 8.4절) 1단계에 두지 않는다.
지금 24 KB다.

**클라이언트**

- `src/lib/api-engagement.ts`: 한 페이지에서 이어 들어온 요청을 한 번의 `/api/read/engagement`(상한을 넘으면 여럿)로
  모은다. 새 요청이 8 ms 동안 없으면 보내고, 첫 요청 뒤 40 ms를 넘기지 않는다. 패치 페이지는 댓글 루트마다 따로 마운트해
  요청이 수십 ms에 걸쳐 들어오기 때문이다(로컬 확인: 니오우스레터 루트 27개가 8 ms 고정 창으로는 9건으로 나뉘었다).
  그래도 루트를 그리는 데 오래 걸리면 묶음이 나뉜다(같은 확인에서 4건). 그래서 패치 리치 번들은 루트를 마운트하기 전에
  즉시 마운트할 루트들의 스레드를 `prefetchEngagement`로 한 번에 묻는다. 진행 중인 같은 키의 요청은 위젯들이 함께
  쓰고, 끝난 뒤 마운트한 위젯은 담아 둔 답을 한 번 꺼낸다. 쓰기는 그 키의 진행 중 요청도 끊는다. 철학자 글이 든 묶음은 돌려받은 스레드·반응을 모두(요청한 것도) 15초 동안 한 번씩 꺼내 쓰게 담아 둔다.
  뒤에 마운트되는 `ReplyLines`와 읽기 전용 막대(지금 버전 글이면 머리와 같은 대상)가 다시 부르지 않는다. 쓰기는 그 키를
  지운다. 개인 덧칠도 같은 방식으로 모은다. 댓글 좋아요 덧칠은 댓글 행을 기다리지 않고 스레드 키로 마운트 때 묻는다.
  legacy 신호면 모은 요청이 모두 legacy로 다시 간다. 모르는 응답 `v`도 legacy 신호다(`engagement-counts` 포함).
- 훅(`use-comments`, `use-comment-likes`, `use-likes`, `use-resource-reactions`, `use-engagement-counts`,
  `resource-thread`)은 효과와 처리기 안에서만 `surfacePath("comments")`를 본다. 반환 모양은 그대로다.
  `useCommentLikes`는 api 경로에서 댓글 행의 `like_count`를 쓰므로 인자에 댓글 행을 받는다.
- 쓰기 토큰은 `supabase.auth.getSession()`에서 꺼낸다. `token_expired`면 `refreshSession()` 뒤 한 번만 다시 보낸다.
  처리되지 않았음이 확실한 legacy 신호(7절)면 같은 쓰기를 legacy로 한 번 보낸다.
- 읽기 전용 반응 막대(철학자 글 아래)는 api 경로에서 내 반응을 읽지 않는다. 보여 주지 않는 값이다.
- 패치 정적 클라이언트: 스레드 읽기·쓰기와 셸 릴 반응 쓰기에 api 분기를 둔다. api 경로에서 저장된 세션의 갱신이
  네트워크·시간 초과·5xx로 실패하면 새 익명 가입으로 넘어가지 않고 "응답 없음"을 보인다(7절). 갱신 토큰이 거절된
  경우(400·401)는 supabase-js처럼 죽은 세션으로 보고 가입한다. 쓰기 응답으로 화면을 고치므로 "쓰고 다시 읽기"가 없다.
  만료된 토큰은 읽기에서 갱신하지 않고 내 좋아요 덧칠만 건너뛴다. 쓰기는 `token_expired`면 한 번 갱신하고 한 번 다시
  보낸다. 첫 쓰기가 새 세션을 만들었거나 삭제가 404면 스레드를 다시 읽는다(내 것 표시가 바뀐다). 셸 릴의 반응 합계는
  api 경로에서 `/api/read/engagement?reactions=`로 읽어 쓰기와 같은 env를 본다.
- testbed 패치 페이지(10절): api 경로에서는 Worker의 `API_DATA_ENV`(development) 행을 읽고 쓴다. 빌드에 구운
  env(production)는 legacy 경로에서만 쓴다. 댓글 쪽 브라우저 저장소(초안, 반응 localStorage)는 env를 키에 넣지 않으므로
  네비처럼 env 검사로 내리지 않는다. 그래서 10절의 열린 질문은 "api 경로는 Worker env를 따른다"로 닫는다.

### 9.2 다채로운 철학자들(`colorful-philosophers`)

SURFACE_MAP 2.2절 19·20번과 10번의 `reel`을 덮는다. 글은 관리 화면(service 키)만 쓰고, 반응과 답글은 `comments`
그룹이다(9.1절). 그래서 이 그룹은 읽기만 있다.

| 경로 | 매개변수 | Supabase | 응답 |
|---|---|---|---|
| `GET /api/read/colorful-philosophers/week` | 없음 | 글 100개(`week_start` 내림차순), 그 글들의 답글 행(`story_id`, 1,000행까지) | `{ v, env, posts: 행[], commentCounts?: { <글 id>: 수 } }` |
| `GET /api/read/colorful-philosophers/post?id=` | 글 uuid | 1행 | `{ v, env, post: 행 \| null }` |
| `GET /api/read/colorful-philosophers/reel` | 없음 | `week_start <= 이번 주(KST)` 12개 | `{ v, env, posts: 행[] }` |

- 행은 지금 쿼리와 같은 열이다. 클라이언트가 지금처럼 `colorfulPhilosopherPostFromRow`로 바꾼다(Worker는
  `colorful-philosophers.ts`를 import하지 않는다).
- 이번 주는 Worker가 `kstWeekStart`(`nav-surfaces.ts`)로 정한다. 목록은 지금처럼 미래 주 예약까지 받아 클라이언트가
  숨긴다. 답글 수는 받은 글 모두를 센다. 어느 주까지 보일지는 클라이언트가 자기 시계로 정하므로, 월요일 경계에서 기기
  시계가 Worker보다 빠르면 Worker가 세지 않은 예약 글이 보일 수 있기 때문이다. 답글 수 읽기가 실패하면 `commentCounts`를
  빼고, 클라이언트는 수 없이(0) 보인다. 브라우저가 Supabase에 다시 묻지 않는다(7절).
- 캐시는 두지 않는다(답글 수가 쓴 사람에게 바로 맞아야 한다). 공개 읽기라 `API_READ_LIMITER`를 쓴다.
- 클라이언트:
  - `useColorfulPhilosopherWeek(env)`는 `env`가 빌드 env일 때만 api 경로를 쓴다. dev 관리 화면은 다른 env를 골라
    부르므로 legacy에 남는다. 답은 `commentCounts`도 돌려주고, `useColorfulPhilosopherCommentCounts(ids, known)`는
    받은 수가 있으면 묻지 않는다.
  - `useColorfulPhilosopherPost(id)`는 id가 uuid일 때 api 경로를 쓴다.
  - 셸 패치 릴(`patch-comments-client.js`의 `refreshReelWeek`)은 `/reel`을 읽는다. 반응 합계는 `comments` 그룹 경로다.
    변형 릴(`transfigure_posts`)은 `toybox-feed` 그룹이라 그대로 두었다가, 정리(CLEANUP_AUDIT 3.3절)에서 요청을
    지웠다. 회전 스크립트가 처음 로드 때 카드를 한 번만 잡아, 뒤에 붙인 카드는 보인 적이 없다.
  - legacy 신호나 모르는 `v`면 그룹을 내리고 같은 화면을 legacy로 다시 읽는다.
- 다음 주 예약 확인(`useColorfulPhilosophersNextWeekOpen`)은 dev 네비에서만 돌므로 옮기지 않는다.

### 9.3 문의(`contact`)

SURFACE_MAP 2.2절 3번(네비 메일함 점)과 29번(문의 쓰기)을 덮는다. 둘 다 세션이 있어야 한다(authenticated만).

| 경로 | 하는 일 | 응답 |
|---|---|---|
| `GET /api/me/mailbox` | 답변이 있고 아직 안 본 내 문의 1행(`env`, `admin_response not null`, `reply_seen_at is null`) | `{ v, env, unseen }`. `reply_seen_at` 열이 없으면(PGRST204, 42703) `false` |
| `POST /api/write/contact-inquiries` | `{ category, message, replyEmail, pagePath, serviceLocale, gameLocale, viewportWidth, viewportHeight }`를 검사해 insert(`return=minimal`) | 201 `{}` |

- 검사는 테이블 CHECK와 같다(분류 6가지, 본문 trim 뒤 10~8,000자, 메일 3~254자와 형식, 제휴는 메일 필수, 서비스 로케일
  ko·en, 게임 로케일 14가지, 화면 크기 1~10,000 정수 또는 null). `pagePath`는 `?`·`#` 앞까지, `/`로 시작하지 않으면
  `/`. 규칙은 import 없는 `src/lib/contact-rules.ts`에 두고 페이지·legacy insert·Worker가 같이 쓴다.
- user_id는 검증한 sub, env는 Worker 값이다. `status`는 보내지 않는다(기본 `new`, 정책이 `new`만 받는다).
- `return=minimal`: authenticated는 `reply_email`·`user_id`·화면 크기 열을 읽을 수 없어 `representation`이면 실패한다.
  같은 이유로 메일함 읽기는 `user_id`로 거르지 않는다(RLS가 자기 행만 보인다).
- 테이블 트리거의 시간당 3건 제한(P0001 `contact_inquiry_rate_limited`)은 429 `rate_limited`로 바꾼다. 클라이언트는
  지금처럼 `ContactInquiryRateLimitError`를 던진다. Worker의 `API_WRITE_LIMITER` 429도 같은 안내가 된다.
- 메일함 읽기가 실패하면 클라이언트는 `null`(점을 그대로 둠)이다. 지금 legacy와 같다.

### 9.4 프로필(`profile`)

SURFACE_MAP 2.2절 28번. SURFACE_MAP의 묶음 `/api/me/profile` 대신 지금 호출마다 경로 하나를 둔다. 프로필은 드물게 보는
화면이라 Worker 요청이 몇 건 늘어도 하루 한도에 영향이 작고, 지금 훅의 실패 단위(통계, 목록, 문의가 따로 "응답 없음")를
그대로 지킬 수 있다.

| 경로 | Supabase | 응답 |
|---|---|---|
| `GET /api/read/profile/nicknames` | `profile_character_nickname_pools`(env 없음, 10행 이하) | `{ v, env, rows }`. 테이블이 없으면(PGRST205, 42P01) `rows: null` |
| `GET /api/me/profile/stats` | `rpc/get_my_profile_activity_stats { p_env }` | `{ v, env, rows }` |
| `GET /api/me/profile/activity?category=&sort=&offset=` | `rpc/get_my_profile_activity { p_env, p_category, p_sort, p_limit: 20, p_offset }` | `{ v, env, rows }` |
| `GET /api/me/profile/inquiries` | `contact_inquiries` 이력 열, 최신순 50개. `reply_seen_at` 열이 없으면 그 열 없이 다시 | `{ v, env, rows, replySeenColumn }` |
| `POST /api/write/profile/inquiries-seen` | 답변이 있고 안 본 내 문의에 `reply_seen_at = Worker 시각` (`return=minimal`) | `{}` |

- RPC는 `auth.uid()`를 읽으므로 사용자 토큰으로 부른다. 분류·정렬·쪽 크기·최대 offset(10,000)은 import 없는
  `src/lib/profile-activity-rules.ts`에 두고 훅과 Worker가 같이 쓴다. 활동 한 쪽은 런 원문이 없어 작다(공개 데이터
  전체가 원문을 빼면 약 1.4 MB, plan 측정). 어댑터의 2 MB 상한을 넘으면 그 쪽만 "응답 없음"이다.
- **바뀌는 것:** 내 문의 목록은 지금 env 필터가 없어 두 env의 행을 보여 준다. Worker는 5절 규칙대로 자기 env만 읽는다.
  운영과 testbed를 같은 브라우저 세션으로 오간 사용자만 차이가 보인다.
- 읽음 표시는 두 번 해도 해가 없지만, 쓰기 규칙대로 처리되지 않았음이 확실할 때만 legacy로 다시 보낸다.

### 9.5 퍼즐상자(`puzzlebox`)

SURFACE_MAP 2.2절 26·27번. RPC 셋(SECURITY DEFINER, `auth.uid()`를 읽음)을 그대로 부른다.

| 경로 | RPC | 응답 |
|---|---|---|
| `GET /api/read/puzzlebox/leaderboard?game=&boards=&board=&offset=&around_me=` | `get_puzzlebox_leaderboard`, 토큰 없이 | `{ v, env, leaderboard }` |
| `GET /api/me/puzzlebox/leaderboard?…`(같은 매개변수) | 같은 RPC, 사용자 토큰으로(`is_me`, `me`) | 같음 |
| `GET /api/me/puzzlebox/standings?game=&boards=` | `get_my_puzzlebox_standings` | `{ v, env, standings }` |
| `POST /api/write/puzzlebox/runs` `{ game, board, run, player }` | `submit_puzzlebox_run` | `{ v, env, result }` |

- `boards`는 페이지가 아는 판과 최고점이다(RPC는 이 판들만 순위를 매긴다). 쿼리에서는 `1:4,2:4` 꼴이고, 판 번호 1~4자리,
  점수 1~6자리, 500개까지다. 규칙은 import 없는 `src/lib/puzzlebox-api-rules.ts`에 둔다. `board`는 `total` 또는 판 번호,
  `offset`은 100,000 이하.
- 지금 supabase-js는 세션이 있으면 토큰을 붙여 순위표에 내 행(`is_me`, `me`)이 들어간다. 그래서 클라이언트는 세션이
  있으면 `/api/me`, 없으면 `/api/read`를 부른다. 공개 경로는 브라우저가 토큰을 보내도 넘기지 않는다(9절).
- 제출의 점수 계산·판 검사·횟수 제한(3초에 한 번, 하루 500판)은 RPC가 한다. 54000은 429 `rate_limited`, 22023(모르는
  판)은 400. 클라이언트는 지금처럼 어떤 실패에도 `null`이고 게임은 기다리지 않는다.
- 클라이언트의 5분 sessionStorage 캐시와 제출 뒤 그 게임 캐시 지우기는 그대로다.

### 9.6 역사 강의서 런(`history-runs`)

SURFACE_MAP 2.2절 22~25번. 런 행에는 원문(`raw`, 행마다 최대 260 KB)이 있다. 목록 100개가 운영 7.9 MB, development
5.5 MB이고 콤보 런 고르기 30개가 3.1 MB다. Worker가 이것을 파싱하면 CPU 한도를 넘는다(plan 측정 27.7 ms). 원문을 빼려면
요약 열(`characters`, `game_elements`)과 687행 backfill이 먼저 있어야 하고, 이는 운영 DB 쓰기라 승인이 필요하다.
1단계는 DB를 바꾸지 않고 **원문이 든 응답과 요청을 파싱하지 않고 흘려보낸다.** 클라이언트는 지금처럼 원문을 받아 직접
파싱한다. 원문을 빼는 일은 3단계(D1 읽기)에서 요약 열과 함께 한다.

| 경로 | Supabase | 응답 |
|---|---|---|
| `GET /api/read/history-runs?view=recent` | 최신 100개, 요약 열과 `raw` | PostgREST 배열 그대로(봉투 없음, env는 `X-Slseoun-Api-Env` 헤더) |
| `GET /api/read/history-runs?view=reference` | `start_time` 최신 30개(콤보 런 고르기) | 같음 |
| `GET /api/read/history-run?id=&view=detail` | 한 행, 상세 열과 `raw` | 같음 |
| `GET /api/read/history-run?id=&view=cover` | `id, raw, cover_spec`(자동 표지 계산) | 같음 |
| `GET /api/read/history-run?id=&view=meta` | `id, character, cover_spec`(OG, "공유됐나") | `{ v, env, rows }` |
| `GET /api/read/history-runs/engagement?ids=` | `history-course:<id>` 키의 likes·comments 행(각 1,000행까지) | `{ v, env, likes: {id: 수}, comments: {id: 수} }` |
| `GET /api/me/history-runs[?id=]` | `donor_user_id = sub`인 이 env의 런 id | `{ v, env, ids }` |
| `POST /api/write/history-runs` | 한 행 insert, 본문 그대로(`return=minimal`) | 201. 이미 있으면 422 `duplicate` |
| `POST /api/write/history-runs/batch` | 행 배열 upsert(`on_conflict=id,env`, 중복 무시), 본문 그대로 | 201 `{ v, env, inserted: [id] }` |
| `PATCH /api/write/history-runs/cover?id=` `{ coverSpec }` | 내 런의 `cover_spec` | `{ v, env, updated }`. 열이 없으면 `reason: "no_column"` |
| `POST /api/write/history-runs/nicknames` `{ nickname }` | 닉네임이 다른 내 런의 `donor_nickname`(null은 건너뜀, 지금과 같다) | `{ v, env }` |
| `DELETE /api/write/history-runs?id=` | 내 런 하나 | `{ v, env, deleted }`. 클라이언트는 지금처럼 오류가 없으면 성공으로 본다 |

- 흘려보내기: 어댑터의 `postgrestStream`은 응답 헤더까지만 시간 제한을 두고 본문을 읽지 않는다. Worker는 PostgREST
  본문 스트림을 `new Response()`에 그대로 넘겨 **JS가 본문 조각을 만지지 않게** 한다. 처음에는 JS 스트림으로 봉투를
  붙이고 바이트를 셌는데, testbed에서 5.5 MB 목록이 CPU 중앙 133 ms(77~204 ms)였다(Free 10 ms, 결과는 `ok`). 그래서
  원문이 든 view는 봉투 없는 배열이고, 크기는 쿼리(100행)와 테이블의 원문 상한이 정한다. 요청 본문도 JS 없이 넘긴다.
  `Content-Length`가 있어야 하고(브라우저는 문자열 본문에 늘 보낸다) 24 MB를 넘으면 413, 없으면 400이다.
  클라이언트 시간 제한은 이 경로만 20초(목록)·30초(업로드)다. I/O 대기는 Worker CPU를 쓰지 않으므로 흘려보내는 호출의
  헤더 시간 제한은 6.5초 예산 대신 15초(읽기)·25초(업로드)다. 업로드의 헤더 시간은 브라우저가 본문을 올리는 시간까지
  포함하기 때문이다. 시간 제한 뒤에 늦게 반영된 쓰기는 지금 legacy의 8초 타임아웃과 같은 성질이다(로컬 확인에서 늦은 묶음
  공유가 삭제 뒤에 행을 다시 넣었다).
- **예외(1단계만):** 원문이 든 쓰기는 본문을 파싱하지 않으므로 Worker가 `env`와 `donor_user_id`를 채우지 못한다(5절
  규칙의 예외). 클라이언트가 지금처럼 채우고, RLS가 `donor_user_id = auth.uid()`를 검사한다. 남은 위험은 사용자가 자기
  런을 다른 env에 쓰는 것뿐이다. 그 밖의 쓰기(표지, 닉네임, 삭제)와 소유 확인은 검증한 sub와 Worker env로 거른다.
  지금 소유 확인과 내 런 목록은 페이지가 준 uid로 읽는다. api 경로는 토큰의 sub만 쓴다.
- `cover_spec`·`donor_nickname` 열이 없을 때의 다시 시도: 읽기는 Worker가 옛 열 목록으로 다시 읽는다. 쓰기는 본문을
  고칠 수 없으므로 다시 시도하지 않는다(운영과 testbed에는 두 열이 있다).
- 공개 목록은 지금처럼 `donor_user_id`를 내보낸다(넓히지 않는다). 참여 수는 지금처럼 행을 세고, runs의 트리거
  카운터로 바꾸는 것은 일치 확인 뒤로 미룬다.
- select 목록의 공백은 어댑터가 지운다(supabase-js와 같다).

### 9.7 이야기(`stories`)

SURFACE_MAP 2.2절 21번과 10번의 `stories`.

| 경로 | Supabase | 응답 |
|---|---|---|
| `GET /api/read/stories?limit=100\|200\|1000[&source=]` | `community_stories` 19열, 최신순 | PostgREST 배열 그대로(9.6절처럼 JS가 본문을 만지지 않는다) |
| `POST /api/write/stories` `{ nickname, sentence, entityType, entityId, patchLineId, source, linkedEntities, author? }` | insert(`return=representation`) | 201 `{ v, env, row }` |
| `DELETE /api/write/stories?id=` | 내 이야기 하나 | `{ v, env, deleted }`. 클라이언트는 지금처럼 목록에서 뺀다 |

- `/patches/changes`의 1,000행은 행마다 `tags`·`linked_entities`가 128 KB까지라 흘려보낸다. limit은 지금 쓰는 세 값만,
  `source`는 패치 id 문자(`[A-Za-z0-9._-]`)만 받는다.
- 행은 Worker가 만든다: user_id = sub, env = Worker 값, `game = "sts2"`, `tags = []`. 문장 2~120자, 닉네임 1~20자,
  연결 128 KB는 테이블 CHECK와 같다. 규칙은 import 없는 `src/lib/stories-api-rules.ts`에 둔다(2026-11-06 두 env의
  25행 키가 모두 맞는다).
- api 경로는 Realtime 채널을 열지 않는다(14절 결정). 패치 정적 작성기(리치 번들이 실패할 때만 쓰임)도 api 분기를 쓴다.

### 9.8 장난감 상자(`toybox-feed`)

SURFACE_MAP 2.2절 11~18번. 장난감 상자 글은 행 하나가 1 MB를 넘기도 한다(어려운 결정의 배치, 서류 폭풍 문서, 2.2절
12번 메모). SURFACE_MAP이 제안한 묶음 응답(피드에 viewer·표지·다음 커서, 서류 폭풍 목록에 썸네일·요약)은 Worker가
행을 파싱해야 해서 9.6절과 같은 CPU 문제에 닿는다. 1단계는 **지금 클라이언트 쿼리마다 같은 일을 하는 경로를 하나씩 두고,
글이 든 응답과 요청은 흘려보낸다.** 클라이언트의 정규화·커서·카운터 코드는 그대로 쓴다. 묶음과 요약은 3단계(D1 읽기)에서
요약 열과 함께 한다.

| 경로 | Supabase | 응답 |
|---|---|---|
| `GET /api/read/toybox-feed?service=&sort=[&score=&created_at=&cursor_id=]` | `get_toybox_feed` 20행 | RPC 배열 그대로 |
| `GET /api/read/defragment-feed?sort=[&커서]` | `get_defragment_feed_v2` 20행 | 같음 |
| `GET /api/read/defragment-runs?sort=latest\|recommended\|comments[&커서]` | 조각모음 게시판의 런 11열, keyset | 같음 |
| `GET /api/read/toybox-post?service=&id=` | 그 서비스 테이블의 한 행 `select *` | 배열 그대로(없으면 `[]`) |
| `POST /api/write/toybox-post?service=` | insert, 본문 그대로(`return=representation`) | 201 배열 그대로 |
| `PATCH /api/write/toybox-post?service=&id=` | 내 글 update, 본문 그대로. 수정 정책이 있는 5개 서비스만 | 배열 그대로(0행이면 `[]`) |
| `DELETE /api/write/toybox-post?service=&id=` | 내 글 하나 | `{ v, env, deleted }` |
| `GET /api/read/favorite-tournament/presets`, `stats?id=` | 기본 대회 전부, 후보 통계 | 배열 그대로 |
| `POST /api/write/favorite-tournament/play` `{ tournamentId, startingSize, championType, championId, matches }` | `complete_favorite_tournament_play`(env는 Worker 값) | `{ v, env, result }` |
| `GET /api/read/pagestorm/posts` | 최신 50개, 목록 12열 | 배열 그대로 |
| `GET /api/me/pagestorm/drafts[?id=]` | 내 임시 저장 최근 20개(목록 열) 또는 하나(`select *`) | 배열 그대로 |
| `POST`·`PATCH`·`DELETE /api/write/pagestorm/drafts[?id=]` | 임시 저장 insert·update·delete | 글 쓰기와 같다 |
| `GET /api/read/defragment-body?service=&id=`, `PUT /api/write/defragment-body` | 덧글 본문 읽기, upsert(`on_conflict=env,source_service,source_id`) | 배열 그대로 |
| `GET /api/read/this-or-that/like-counts?ids=`, `GET /api/me/this-or-that/likes?ids=` | 좋아요 수 뷰, 내 좋아요 | `{ v, env, rows }` |
| `PUT`·`DELETE /api/write/this-or-that/like?id=` | 좋아요 insert(중복은 성공)·delete | `{ v, env, liked }` |
| `GET /api/read/this-or-that/vote-summaries?ids=`(50개까지), `GET /api/me/this-or-that/votes?ids=` | `get_this_or_that_vote_summaries`, 내 투표 | `{ v, env, rows }` |
| `PUT /api/write/this-or-that/vote?id=` `{ choice, surface }`, `DELETE` | 투표 insert(`created_surface`)·delete | `{ v, env, choice }` |

- id 목록은 uuid만, 중복 없이 100개까지(투표 요약은 RPC 한도인 50개). 커서는 셋 다 있거나 없어야 하고 정수, ISO 시각,
  행 id 형식만 받는다. 런 keyset의 `or` 필터는 Worker가 검사한 커서 값으로 만든다(지금은 큰따옴표만 지운다).
- **예외(1단계만):** 글·임시 저장·덧글 본문 쓰기는 본문을 파싱하지 않으므로(9.6절과 같다) Worker가 `env`와 `user_id`를
  채우지 못한다. 클라이언트가 지금처럼 채우고, RLS가 `user_id = auth.uid()`를, 보호 트리거가 카운터와 `created_at`을
  맡는다. 남은 위험은 사용자가 자기 글을 다른 env에 쓰는 것뿐이다. 수정·삭제는 검증한 sub와 Worker env로 거른다. 업로드
  상한은 글 8 MB, 임시 저장 4 MB다.
- 이거 vs 저거 좋아요를 이미 누른 글에 다시 보내면(다른 탭에서 눌렀을 때) legacy는 중복 오류로 단추를 되돌리고 화면을
  "응답 없음"으로 바꾸지만, Worker는 성공으로 답해 눌린 채로 둔다. 좋아요 수와 내 좋아요 읽기는 쌓인 id가 100개를 넘으면
  100개씩 나눠 읽는다. 투표 요약은 지금처럼 50개를 넘으면 실패한다(SURFACE_MAP 14번 메모).
- 옮기지 않은 `use-this-or-that-comment-counts.ts`는 부르는 곳이 없어 경로도 두지 않는다.
- 이거 vs 저거 좋아요·투표 쓰기와 내 좋아요·투표 읽기는 사용자별 쓰기 예산(분당 30) 대신 IP별 읽기 예산(분당 600)으로
  센다. 목록 20장에 연달아 투표하고 더 보기를 누르면 1분에 30건을 넘어 투표가 되돌아가고 "응답 없음"이 되기 때문이다.
  둘 다 한 행짜리 토글이고 `(post_id, user_id, env)` 유일 제약이 막는다(legacy에는 제한이 없다). 라우터는 사용자 경로에도
  `rateLimit: "ip"`를 받는다.
- 월드컵 플레이는 경기 배열의 형식만 보고 개수와 대진은 RPC가 검사한다. 본문 상한은 256 KB다(카드·유물 전부, 약 1,000개
  후보의 경기 120 KB). 처음 둔 256경기 상한은 유물 298개 대회의 기본 판(297경기)을 막았다.
- 쓰기 응답의 버전이 모르는 값이면 그룹을 내리되 legacy로 다시 보내지 않는다(쓰기는 이미 됐다,
  `requireApiVersion(group, body, true)`). 이야기 작성도 같다.
- 조각모음 고유 글 읽기에서 503·시간 초과·429는 legacy의 시간 초과처럼 "응답 없음"을 보인다. 그 밖의 오류는 지금처럼
  "없는 글"이다.
- api 경로는 `${table}_feed` Realtime 채널을 열지 않는다(14절 결정). 채널 실패가 불러온 피드를 "응답 없음"으로 덮던
  일도 api 경로에서는 없다.
- 옮기지 않는 것: RPC가 없을 때의 대체 select, `get_defragment_feed` v1 대체, 열이 없을 때의 다시 시도(운영에 모두 있다),
  SURFACE_MAP 13번 메모의 죽은 경로, 패치 페이지의 변형 릴과 빌드 시점 읽기(`transfigure-data.ts`), 상세 셸 OG(플래그를
  따르지 않는 4개 중 하나, SURFACE_MAP 1.2절). 앞의 셋과 변형 릴 요청은 정리(CLEANUP_AUDIT)에서 지웠다.

## 10. 배포와 testbed

- CI(`.github/workflows/cloudflare-workers.yml`) main 배포에 `--var API_SUPABASE_URL:… --var API_SUPABASE_KEY:…
  --var API_DATA_ENV:production`을 더한다. 값은 이미 있는 빌드 env에서 가져온다. 셋 중 하나라도 비었거나 URL·키
  형식이 2.1절과 맞지 않으면 배포 전에 실패한다.
- testbed(`scripts/run-cloudflare-testbed.mjs --remote`)도 같은 세 값을 넣는다(`API_DATA_ENV=development`).
- `API_RUNTIME_FLAGS`는 `wrangler.jsonc`에 적는다. 운영은 `off`로 시작하고, 운영에서 첫 그룹을 켜기 직전 배포에서
  `d1`로 바꾼다(코드 리뷰를 거친다).
- D1 두 개를 `--location apac`으로 만들고 `database_id`를 커밋한다. 마이그레이션은 `wrangler d1 migrations apply DB
  --remote`(testbed는 `--env testbed`)로 testbed에 먼저 적용한다.
- 로컬 `wrangler dev`는 local D1을 쓴다. Worker 변수는 `.dev.vars`(gitignore)에 두고, 기본 견본에는 `API_SUPABASE_*`를
  넣지 않는다. 로컬 QA가 Worker를 통해 공유 Supabase를 부르지 않게 하려는 것이다. 필요할 때만 따로 넣는다.
- testbed env: development 전용이다(2026-11-06 결정). `run-cloudflare-testbed.mjs --remote`는 main과 패치 빌드 모두에
  `NEXT_PUBLIC_SUPABASE_ENV=development`를 넣는다. checkout의 `.env.local` 값과 상관없다. 그래서 testbed 패치 페이지의
  댓글·네비도 development 행을 읽고 쓰며, 운영 행에는 닿지 않는다. 이전에는 패치 빌드만 production이라 패치 페이지
  `nav`가 8.2절의 env 검사로 legacy에 남고 패치 댓글이 운영 행을 읽고 썼다. 운영 배포(CI, `cf:patch:deploy`)는 그대로
  production이다.
- `/api` 스모크: `cloudflare-route-smoke.mjs`에 `/api/read/없는경로`가 409 `surface_legacy`와 표식 헤더를 주는지 보는
  확인을 더한다(Supabase를 부르지 않는다). 1단계 이전 판으로 되돌린 뒤의 확인을 위해 `--no-api-router`를 둔다
  (`--no-security-headers`와 같은 방식).
- testbed QA도 계정의 하루 10만 요청을 같이 쓴다. 그룹을 켜는 testbed QA는 한 번에 한 그룹, 필요한 경로만 돈다.

## 11. 테스트

- Worker spec(tsx, 지금 방식):
  - 라우터: 경로, 메서드, HEAD(Supabase를 부르지 않음), OPTIONS, 쿼리 검사, 표식 헤더, 409 사유별, 교차 사이트
  - 플래그: 상태 셋, 페이지 요청이 기다리지 않음, `/api`가 30초 넘은 값을 쓰지 않음, 실패 간격, 스위치 `off`
  - 쿠키: 같은 값이면 보내지 않음, 모르면 보내지 않음, 지우기, Secure, 304·HEAD·서비스 binding 응답(바꿀 수 없는
    헤더), 파일 경로·`/api`에는 보내지 않음, QA 쿠키
  - 스위치 `off`의 운영 동등성: 정해 둔 URL들에서 `/api/*`를 뺀 응답의 상태, 헤더, 본문이 라우팅 함수의 결과와 같다
  - 어댑터: URL, apikey, Authorization 유무, env 필터, 5개씩 보내기, 시간 제한
  - JWT: 정상, 만료, 다른 kid, 다른 iss, HS256, 서명 전 검사로 JWKS를 받지 않음, 쿨다운
  - nav: 임대, 부분 실패의 테이블별 유지, 모두 실패의 물러서기, 첫 채우기, 503, 24시간
  - 공개 경로가 `Authorization` 유무에 같은 바이트를 주는지
- 클라이언트 spec(tsx): 스냅샷으로 계산한 점과 legacy 쿼리 의미(`created_at > since`가 있는가)가 같은 fixture에서
  같은지, 카탈로그 점, 모르는 키, env 불일치, `apiFetch`의 legacy 신호(409, 표식 없는 HTML 404)와 재시도 규칙.
- 기존 spec이 깨지지 않는지: `worker-routing.spec.ts`, `security-headers.spec.ts`,
  `check-cloudflare-route-coverage.ts`(binding 없음, fetch 거부). 스위치가 `off`거나 binding이 없으면 응답은 그대로다.
- Playwright: `blockSupabase`와 `PLAYWRIGHT_BLOCK_SUPABASE`를 쓰는 곳은 `slseoun_qa=no-supabase` 쿠키도 넣는다.
  `api` 경로를 시험하는 spec은 `slseoun_qa_path`로 경로를 고정하고 `/api/*`를 mock한다.
- Worker 번들에 supabase-js가 없는지 `cf:size`가 확인한다.

## 12. 넘어갈 조건(1단계, 그룹마다)

- 켠 그룹의 오류율이 `legacy`와 같다.
- Workers 요청이 계정 전체(main, patches, testbed 둘) 합으로 하루 6만 건 아래다. `cf:metrics`는 지금 main과 patches만
  세므로 testbed Worker를 더한다. 서비스 binding 호출이 하루 한도에 따로 세어지는지는 문서에 없으니, 확인 전까지는
  센다고 본다.
- CPU: `exceededCpu`가 0이고 `cpuTimeP99`가 켜기 전 기준선보다 나빠지지 않는다. 처음에 적은 "5 ms 아래"는 지금
  운영(2026-11-06 24시간 p99 7.5 ms)도 맞추지 못하는 값이라 바꿨다. **운영에서 그룹을 켤 때 사용자가 이 조건을 다시
  본다.** 기준선은 켜기 직전 `pnpm cf:metrics -- --worker main --hours 24`로 적는다.
- Worker subrequest와 Supabase API 요청 수가 지금보다 늘지 않는다.

## 13. 되돌리기

| 상황 | 수단 |
|---|---|
| 한 그룹의 `api` 경로가 이상함 | `tsx scripts/runtime-flags.ts set path.<그룹> legacy --env production --remote --note … --confirm-production`(승인 뒤). `/api`는 30초 + D1 왕복 안에 409를 내고, 새 페이지는 쿠키를 지운다. 공개 응답의 브라우저 캐시(최대 30초)가 지나면 열린 탭도 legacy다 |
| 모든 그룹을 한 번에 | `API_RUNTIME_FLAGS`를 `off`로 바꾸는 배포, 또는 모든 `path.*`를 `legacy`로 |
| D1이 응답하지 않음 | 자동으로 `legacy`(`/api`는 409, 페이지는 쿠키를 바꾸지 않음) |
| Worker 코드 버그 | `wrangler rollback`(사용자 승인). 먼저 모든 `path.*`를 `legacy`로 바꾸고 1분 기다린다. 그러면 새 Worker가 409로 열린 탭을 내린다. 1단계 이전 판으로 가더라도 표식 없는 응답을 클라이언트가 legacy 신호로 본다(4.3절). 고친 판을 배포한 뒤에 플래그를 다시 켠다. D1 상태는 Worker 판과 함께 되돌아가지 않는다 |
| 변수를 빠뜨리거나 틀린 배포 | 그 isolate는 409(`not_configured`)로 legacy. CI 검사가 먼저 막는다 |

## 14. 정하지 않은 것

- ~~Realtime~~ 2026-11-06 사용자 결정: `api` 경로 화면은 Realtime 채널을 열지 않는다. 대상 테이블이 publication에
  없어 이벤트가 한 번도 오지 않았고(SURFACE_MAP 5.1절, tasks/010 #42), 남은 것은 연결이 실패하면 받은 피드를
  "응답 없음"으로 덮는 부작용뿐이다. 옮길 기능이 없으므로 3단계의 polling 대체도 두지 않는다. legacy 경로는 그대로
  두고(운영 버그 #42), 리팩토링 묶음이 끝난 뒤 고친다.
- 화면 하나를 한 번에 읽는 Supabase RPC(`get_nav_latest` 등)는 운영 마이그레이션이라 1단계에는 두지 않는다.
- JWT 키 목록을 D1로 옮기고 폐기 절차를 두는 것: 4단계 전.
- ~~testbed 패치 클라이언트의 env: `comments`를 옮길 때(10절).~~ 9.1절에서 닫았다.
