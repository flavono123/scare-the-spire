<!-- 2026-11-09 상태: WP-O(OG)와 WP-DEV(관리 도구)는 병합·운영 배포됨. WP-B(패치 릴)는 step6/patch-reels 브랜치에 있고
WP-Z 때 병합한다(경로 legacy 되돌리기가 없어진 뒤). 운영은 5단계(모든 source = d1, sync off, 직접 쓰기 닫힘, identity cookie)다.
읽기 플래그는 nav·stories·colorful-philosophers·contact·profile·puzzlebox만 d1이고, 나머지는 source = d1이라 D1에서 읽는다. -->

# 6단계(클라이언트 정리) 구현 계획

이 문서는 읽기만 하고 만들었습니다. 파일 수정, 커밋, 배포, 플래그 변경은 하지 않았습니다. 기준은 `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit`, 브랜치 `refactor/supabase-exit`, 커밋 `1557e8b3`입니다. 아래 경로는 모두 이 위치 기준입니다.

비평가가 지적한 미병합 상태는 직접 확인했습니다.
- `step3/reads`는 미병합 커밋 7개입니다. D1에서 GET을 서비스하는 `948ec7a1`(`workers/api/d1-read.ts`, `readStoreFor`)이 여기에 있습니다.
- `step4/prereqs`는 미병합 커밋 6개입니다.
  - `97792fe0`: `API_PATH_DEFAULT`와 `NEXT_PUBLIC_API_PATH_DEFAULT`
  - `f26a818a`: `workers/api/write-gate/me-read.ts`와 Supabase 마이그레이션 `20261109150000_worker_read_actor.sql`
  - `472dbb23`: 검증 키를 D1으로 옮김

두 브랜치가 고치는 파일이 6단계와 겹칩니다(`run-donation.ts`, `api-client.ts`, `runtime-flags.ts`, `patch-comments-client.js`, `build-patch-worker.tsx`, `history-course-run-index.tsx`). 그래서 **두 브랜치를 먼저 병합한 뒤 줄 번호를 다시 잡는 것**이 모든 작업 묶음의 시작 조건입니다. 아래 줄 번호는 `1557e8b3` 기준이라 병합 뒤에는 밀립니다.

---

## 1. 끝 상태

### 1.1 브라우저 번들 (`.cloudflare/assets/**`, `.patch-worker/assets/**`)

**들어 있지 않은 것**
- 문자열 `GoTrueClient`, `SupabaseClient`, `@supabase/`, `realtime-js`, `postgrest`, `supabase.co`
- anon 키(공개 키)
- `/rest/v1`, `/auth/v1`, `/realtime`을 만드는 코드

**들어 있지 않은 모듈**
- `src/lib/supabase.ts`, `src/lib/supabase-timeout.ts`를 지웁니다.
- `surfacePath`, `demoteSurface`, `SurfaceLegacyError`, `shouldUseLegacy`, `writeMayGoLegacy`, `toyboxViaApi`, `identityCookieMode` 분기를 지웁니다.
- Realtime 채널 두 곳(`use-toybox-feed.ts:97-137`, `use-community-stories.ts:176-193`)은 대체 없이 지웁니다(계획 5.4).

**데이터 경로**
- 브라우저의 모든 데이터 호출은 같은 출처 `/api/read|me|write/*`와 `/api/auth/claim`뿐입니다.
- Worker가 409 `surface_legacy`를 주거나, 표식 헤더가 없거나, 버전이 맞지 않으면 legacy로 가지 않습니다. 대신 지금 쓰는 "데이터베이스가 응답하지 않습니다"(`StorageUnavailableNotice`, 패치 정적 클라이언트는 `renderUnavailable`)를 보입니다.
- `supabaseEnabled` 분기는 모두 `true`로 접었습니다. 운영 빌드는 늘 true였으므로(`cloudflare-workers.yml:156-158`) 미리 그린 HTML의 초기 상태(loading, unavailable, ready)가 바이트 단위로 같습니다.

**신원**
- 쿠키 신원만 씁니다. 브라우저는 Bearer 헤더를 보내지 않습니다.
- localStorage `sb-<ref>-auth-token`은 읽기만 하고 지우지 않습니다(계획 5.3). claim 응답에 세션이 오면 그 값을 저장합니다.
- 저장 키는 두 방법으로 찾습니다. 이미 있는 키는 정규식으로 찾고, 새 세션은 토큰 `iss`의 호스트에서 ref를 뽑아 만듭니다. 그래서 `NEXT_PUBLIC_SUPABASE_URL`을 인라인할 필요가 없습니다.
- `slseoun_rf`와 `slseoun_idm` 쿠키는 클라이언트가 읽지 않습니다. Worker는 이전 버전 클라이언트로 되돌릴 때를 위해 계속 보냅니다.

**남는 것**
- 데이터 env 값(`production`/`development`)은 새 모듈 `src/lib/data-env.ts`의 `dataEnv`가 가집니다. 값과 빌드 변수 이름 `NEXT_PUBLIC_SUPABASE_ENV`는 7단계까지 그대로 둡니다. 이 값은 네비 저장 키, 스냅샷 대조, 쓰기 본문 `env`에 쓰이고 Worker `API_DATA_ENV`와 짝이 맞아야 합니다(`d1-write/handlers/toybox.ts:208,547,582,652`).
- 패치 HTML의 `sts-patch-comments-config`는 `{dataEnv}`만 담습니다(URL, 키, `apiPathDefault`를 뺍니다).
- `window.__slseounRuntime.nav` 공유 promise는 남깁니다.

### 1.2 CSP
- `workers/security-headers.ts:21`과 `public/_headers:6`을 똑같이 `connect-src 'self' https://cloudflareinsights.com https://www.youtube.com`으로 바꿉니다. 19행 주석도 지웁니다.
- 정책은 계속 Report-Only입니다.
- main Worker와 패치 Worker를 둘 다 다시 배포합니다.

### 1.3 빌드
- `next build`는 DB를 읽지 않습니다. Next가 만드는 패치 페이지는 결과물로 나가지 않으므로 화면 변화가 없습니다.
- `patch:build`의 릴 데이터는 4절의 결정을 따릅니다. 기본 권장은 D1에서 읽는 것입니다.
- 빌드에 `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`가 필요 없습니다. CI는 이 둘을 main 배포 단계 env로만 옮깁니다. 이 값으로 `API_SUPABASE_*`를 만들기 때문입니다.
- `package.json`에서 `@supabase/supabase-js`를 빼고 lock도 갱신합니다.
- 클라이언트 번들 검사를 새로 두고 `cf:assets`와 `patch:build`에 연결합니다.

### 1.4 OG
- `workers/detail-shell-og.ts`는 PostgREST 대신 `env.DB`를 읽습니다.
- **기본은 꺼짐**입니다. 새 env `DETAIL_SHELL_OG`가 `d1`일 때만 켜집니다. 운영과 testbed에는 이 값을 넣지 않습니다.
- 지금 운영도 Supabase 변수가 없어 꺼져 있습니다(tasks/010 #32, 결정 대기). 그래서 응답 HTML이 지금과 같습니다.

### 1.5 Worker에 남는 것 (7단계까지)
- Supabase 라우트 핸들러, outbox 미러, 2단계 sync 코드, `API_SUPABASE_URL/KEY/DATA_ENV` 배포 변수
  - 이 변수가 없으면 `flagsDisabledReason`이 `not_configured`가 되어 모든 `/api`가 409가 됩니다(`workers/api/flags.ts:138-142`).
- `API_SUPABASE_SECRET_KEY`, claim의 Supabase 익명 가입
- QA 쿠키 처리, 409 legacy 응답

**새로 더하는 것은 세 가지입니다.**
- 신원 env 기본값 `API_IDENTITY_MODE_DEFAULT`
- claim의 refresh 경로
- OG의 D1 읽기

---

## 2. 6단계를 내보내기 전에 운영에서 참이어야 하는 것

**코드와 배포**

| # | 조건 | 확인 방법 |
|---|---|---|
| P1 | `step3/reads`와 `step4/prereqs`가 `refactor/supabase-exit`에 병합되어 운영에 나가 있다. `20261109150000_worker_read_actor.sql`이 운영 Supabase에 적용돼 있다(쿠키만 있는 신원의 `/api/me`를 service 키로 읽음) | `git rev-list --count refactor/supabase-exit..step3/reads`와 `..step4/prereqs`가 0. `docs/release/history/*` 기록 |
| P2 | 3~5단계를 운영에서 마쳤다. 5단계 넘어갈 조건(outbox 비움, 손 대조 일치)을 충족했다 | `docs/release/UNRELEASED.md`와 history 기록 |

**런타임 플래그**(`pnpm flags list --env production --remote`, testbed도 같은 값)

| # | 키 | 값 | 없으면 6단계 클라이언트에서 생기는 일 |
|---|---|---|---|
| P3 | `path.<그룹 9개>` | `api` | 409, 곧 해당 화면 "응답 없음". 2026-11-09에 켬 |
| P4 | `identity.mode` | `cookie` | claim이 409, 곧 쓰기 전부 실패 |
| P5 | `write.<모든 그룹>` | `worker` | 쿠키 신원은 토큰이 없어 anon으로 RLS에 걸림. 곧 forbidden(`router.ts:300`, `supabase-rest.ts:141`) |
| P6 | `source.<쓰기 그룹 7개>`(comments, stories, toybox-feed, history-runs, puzzlebox, profile, contact) | `d1` | 계획상 5단계 결과. `me.*`는 D1 어댑터가 `userId`로 답함(`d1-read.ts`) |
| P7 | `read.nav`, `read.colorful-philosophers` | `d1` | 필수는 아님. 실패하면 Supabase로 넘어가고 미러가 최신이라 동작은 같음. 3단계에서 기대하는 값 |
| P8 | `sync.enabled off`, `write.paused off`, 미러 정상 | — | 5단계 상태 |

**Worker env 기본값**: 플래그 읽기가 실패할 때 쓰는 "안전한 쪽"입니다(계획 7.2).

| # | 변수(`wrangler.jsonc`의 운영·testbed vars) | 값 | 근거 |
|---|---|---|---|
| P9 | `API_PATH_DEFAULT` | `api` | `step4/prereqs` `workers/api/path-default.ts`. 없으면 D1 장애 때 409, 곧 전면 중단 |
| P10 | `API_WRITE_MODE_DEFAULT` | `worker` | `write-flags.ts:39-41`. 기본값이 rls라 쓰기가 실패함 |
| P11 | `API_WRITE_SOURCE_DEFAULT` | `d1` | `d1-write/index.ts:100-102` |
| P12 | `API_IDENTITY_MODE_DEFAULT` | `cookie` | **새 코드(WP-A)**. 지금은 `identity/mode.ts:44,48`이 플래그 읽기에 실패하면 `token`, 곧 `resolve.ts:75-79` `token_invalid` |

지금 `wrangler.jsonc`의 vars에는 `API_RUNTIME_FLAGS`만 있어 P9~P12가 모두 비어 있습니다. 5단계 배포에서 넣지 않았다면 WP-W가 넣습니다.

**비밀값**
- P13: `API_IDENTITY_SECRET`와 `API_SUPABASE_SECRET_KEY`가 있습니다(2026-11-09 기록).
- `API_SUPABASE_LEGACY_JWT_SECRET`은 없습니다. HS256 토큰은 WP-A의 refresh claim이 살립니다.

**운영 D1 데이터 확인**(읽기만 함. `npx wrangler d1 execute slseoun-prod --remote --command "…"`, testbed도 같은 검사)

| # | SQL | 기대값 | 이유 |
|---|---|---|---|
| P14 | `SELECT service, count(*) FROM posts WHERE length(id) NOT BETWEEN 1 AND 64 OR id GLOB '*[^A-Za-z0-9_-]*' GROUP BY service` | 0행 | `isRunId`/`isRowId`에 안 맞는 id는 지금 legacy로만 열림 |
| P15 | `SELECT count(*) FROM threads WHERE length(thread_key) > 200 OR thread_key NOT GLOB '[A-Za-z0-9]*' OR thread_key GLOB '*[^A-Za-z0-9._:-]*'`. `comments.story_id`, `likes.story_id`에도 같은 검사 | 0 | `engagementApiFor`와 패치 `commentsViaApi`의 키 규칙(`engagement-keys.ts:8`) |
| P16 | `SELECT count(*) FROM resource_reactions WHERE resource_type GLOB '*[^a-z_-]*' OR resource_id GLOB '*[^A-Za-z0-9._-]*' OR game_version GLOB '*[^A-Za-z0-9._-]*'`. `resource_reaction_counts`에도 같은 검사 | 0 | `REACTION_PART` 규칙 |

0이 아니면 그 행이 지금 어떻게 보이는지를 다시 보고 해당 작업 묶음에서 그대로 재현합니다.

**운영자 쓰기 경로**
- P17: 아래 쓰기가 D1과 outbox로 가야 합니다. `source=d1` 뒤에도 Supabase에 직접 쓰면 사용자에게 보이지 않습니다. 2단계 sync가 꺼지기 때문입니다.
  - `/dev/admin` 문의 답변과 닉네임 풀
  - `/dev/colorful-philosophers` 주간 글
  - `worldcup:seed`
  - `patch-note-revision` 스킬의 `community_stories` UPDATE
- 이것은 사실 **5단계 전환의 선행 조건**입니다. 5단계에서 하지 않았다면 WP-DEV의 쓰기 쪽 절반을 5단계 전환 전에 먼저 내보냅니다.

**사용자 수작업**
- P18: 4절 A안이면 `CLOUDFLARE_API_TOKEN`(cloudflare-production 환경 secret)에 D1 읽기 권한이 있는지 Cloudflare 대시보드에서 확인합니다. 없으면 권한을 넓히거나 새 secret을 만듭니다. 저장소에서는 권한을 알 수 없습니다.
- 운영 플래그 변경, 배포, 롤백은 `docs/RELEASE_PROCESS.md`에 따라 승인을 받습니다.

---

## 3. 작업 묶음

### 3.0 공통 규칙

- **worktree**
  - 묶음마다 `step6/<이름>` 브랜치를 `.claude/worktrees/step6-<이름>`에 만듭니다. 시작점은 WP0을 병합한 `refactor/supabase-exit`입니다.
  - 고칠 때마다 speculative commit을 남깁니다. 사용자에게 보이는 동작이 바뀌면 `Feature:`/`Expect:`/`QA:` 줄을 쓰고, 아니면 `QA: none`을 씁니다.
  - 병합은 `git merge --no-ff`로 합니다.
  - `docs/release/UNRELEASED.md`는 WP-Z만 고칩니다.
- **파일 소유**
  - 병렬 묶음끼리 같은 파일을 고치지 않습니다.
  - 다른 묶음 소유 파일이 import하는 export는 지우지 않고 그대로 둡니다. 필요하면 늘 api 쪽을 돌려주는 stub으로 둡니다. 지우는 일은 WP-Z가 합니다.
  - 직렬 묶음 WP0(처음)과 WP-Z(마지막)만 다른 묶음 파일을 이어서 고칠 수 있습니다.
- **기계적 치환 규칙**
  - `supabaseEnabled`는 `true`로 바꾸고 식을 단순화합니다. `false`로 바꾸면 미리 그린 HTML이 달라집니다.
  - legacy 분기는 지우고, 그 분기로 가던 조건(키 규칙 실패, legacy 신호)은 "응답 없음"이나 "없음"으로 바꿉니다. 어느 쪽인지는 지금 그 입력이 화면에 내는 결과와 같게 고릅니다.
  - `supabaseEnv` import는 `dataEnv`(`@/lib/data-env`)로 바꿉니다.
- **확인 순서**
  1. 단위 spec
  2. HTML 동일성 검사. 브랜치 빌드와 기준 빌드의 `.cloudflare/assets/_cf_static_pages/**/*.html`, `.patch-worker/assets/**/*.html`을 diff합니다. 해시가 붙은 에셋 이름을 정규화한 뒤 차이가 0이어야 합니다. 예외는 WP-P의 config JSON과 WP-B의 릴 데이터입니다.
  3. testbed
- **testbed는 배포가 하나뿐이라 공유됩니다.**
  - 묶음별 testbed 확인은 그 묶음을 `refactor/supabase-exit`에 병합한 뒤에 한 번에 한 세션만 `pnpm cf:testbed`로 배포하고 확인합니다.
  - 병합 전 확인은 로컬 `pnpm cf:testbed:local --api`와 spec으로 합니다.
  - testbed 플래그와 env는 2절 P3~P12와 같아야 합니다(`pnpm flags list --env testbed --remote`).
- **testbed 브라우저 확인(모든 묶음 공통)**
  - 새 프로필의 Chromium을 `--host-resolver-rules="MAP *.supabase.co ~NOTFOUND"`로 띄웁니다. **`slseoun_qa` 쿠키는 넣지 않습니다.** 이 쿠키가 있으면 Worker가 `/api`를 409로 답해서 검증 대상이 사라집니다.
  - 기록할 것:
    - (a) `*.supabase.co`로 나가는 요청 수. DNS 차단이라 모두 `ERR_NAME_NOT_RESOLVED`로 잡힙니다.
      - 묶음 단계: 자기 화면의 `/rest/v1`와 `/realtime`이 0
      - WP-Z 뒤: 전부 0
    - (b) `securitypolicyviolation` 0
    - (c) `/api/*` 응답 중 409 0
    - (d) 화면에 "데이터베이스가 응답하지 않습니다"가 없음
  - 신원 확인용 두 번째 프로필에는 기존 testbed(dev env) Supabase 세션이 든 localStorage를 넣어 둡니다.
- 기준 주소는 https://scare-the-spire-testbed.flavono123.workers.dev 입니다.

### WP0. 기반(직렬, 맨 먼저)

- **목표**: legacy 신호를 한 곳에서 "응답 없음"으로 바꿉니다. 다른 묶음이 쓸 새 모듈과 계약을 만듭니다.
- **파일**: `src/lib/data-env.ts`(새 파일), `src/lib/db-errors.ts`(새 파일), `src/lib/supabase.ts`, `src/lib/runtime-flags.ts`, `src/lib/api-client.ts`, `src/lib/identity-cookies.ts`, `scripts/api-client.spec.ts`
- **단계**
  1. `data-env.ts`: `export const dataEnv = process.env.NEXT_PUBLIC_SUPABASE_ENV ?? "production"`.
  2. `db-errors.ts`: `isCheckViolation`을 `supabase.ts:11-13`에서 옮깁니다. api 오류도 23514를 갖는 것은 `toybox-api.ts:33-38` `POSTGREST_CODES` 덕분이므로, 그 매핑을 바꾸지 말라는 주석을 답니다.
  3. `supabase.ts`: 위 두 값을 다시 export만 하고, 클라이언트 생성은 WP-Z까지 둡니다.
  4. `runtime-flags.ts`: `surfacePath()`가 늘 `"api"`를 돌려주게 하고(deprecated), `demoteSurface()`는 아무 일도 하지 않게 합니다. 쿠키 파싱과 `defaultSurfacePath`/`NEXT_PUBLIC_API_PATH_DEFAULT`(`step4/prereqs`)를 지웁니다. `slseounRuntime().nav`는 둡니다.
  5. `api-client.ts`: 아래 세 경우 모두 `ApiUnavailableError`를 던지게 합니다(코드 `surface_legacy`, `no_marker`, `bad_version`). `shouldUseLegacy`와 `writeMayGoLegacy`는 늘 false를 돌려주게 하고(deprecated), `SurfaceLegacyError` 클래스는 남기되 던지지 않습니다.
     - 표식 헤더가 없을 때(`:156-163`)
     - 409 `surface_legacy`(`:177-182`)
     - `requireApiVersion`(`:82-85`)
  6. `identity-cookies.ts`: claim 요청 타입을 `{access_token?, refresh_token?}`로 늘립니다. 응답 `session`은 신규 가입과 refresh 성공 때 옵니다. WP-A와 WP-P가 함께 지킬 계약입니다.
- **spec**: `api-client.spec.ts`
  - legacy와 demote를 단언하던 곳을 "unavailable이고 demote 없음"으로 바꿉니다(`:28-92`, `:142-144`, `:186-189`, `:245-254`, `:313-317`). `step3`/`step4`에서 더해진 단언도 같이 봅니다.
  - `surfacePath`가 쿠키와 상관없이 api인지 확인합니다.
- **testbed**: 화면 변화가 없어야 합니다. https://scare-the-spire-testbed.flavono123.workers.dev/ 와 https://scare-the-spire-testbed.flavono123.workers.dev/c-c-c-combo 에서 `slseoun_rf` 쿠키를 지워도 데이터가 뜨는지 봅니다.

### WP-A. 신원(React)과 Worker claim

- **목표**: supabase-js 없이 지금과 같은 uid가 이어지게 합니다. 같은 uid 유지, 탭 간 동기화, 새 사용자 세션 넘기기를 모두 지킵니다.
- **파일**: `src/hooks/use-auth.ts`, `src/lib/api-session.ts`, `src/lib/api-identity.ts`, `src/hooks/use-puzzlebox-scores.ts`, `workers/api/identity/claim.ts`, `workers/api/identity/mode.ts`, `workers/api/identity/supabase-refresh.ts`(새 파일), `scripts/api-identity-client.spec.ts`, `scripts/api-identity.spec.ts`
- **단계**
  1. **`api-identity.ts`**
     - 저장 키는 기존 키를 찾는 방식(`:64-67`)을 쓰고, 없으면 세션 `access_token`의 `iss` 호스트로 만듭니다. `:56`의 `NEXT_PUBLIC_SUPABASE_URL` 읽기는 지웁니다.
     - `storeSupabaseSession(session)`을 더합니다. supabase-js v2 형식(access_token, refresh_token, expires_in, expires_at, token_type, user.id)으로 쓰고, 지우는 함수는 두지 않습니다.
     - `ensureClaimedIdentity`는 `{access_token, refresh_token}`을 보냅니다. 응답 `session`은 저장합니다.
     - 401 `token_invalid`이면 `claim {}`를 한 번 보냅니다.
       - 유효한 쿠키가 있으면 `kept`, 곧 같은 uid입니다. 비평가 1-7(오래된 토큰과 유효한 쿠키)의 경우입니다.
       - 쿠키가 없으면 새로 가입합니다. 오늘 supabase-js가 갱신할 수 없는 세션을 지우고 익명으로 다시 가입하는 결과와 같습니다.
     - `IdentityLegacyError`는 `ApiUnavailableError`로 바꿉니다.
  2. **`api-session.ts`**
     - 쿠키 경로만 남깁니다. `currentAccessToken`(`:18-26`), `apiFetchWithToken`(`:76-91`), `tokenPathAfterClaim`(`:37-39`)과 `:33`·`:55`·`:66`·`:71`의 토큰 대체를 지웁니다.
     - `identity_required`이면 강제로 다시 claim하고 한 번 다시 보냅니다(지금과 같음).
     - Worker가 `token_*`로 답하면 unavailable입니다.
  3. **`use-auth.ts`**
     - `userId`는 `storedSupabaseIdentity()?.uid`, 없으면 `claimedUid()`입니다. 지금의 getSession 다음 fallback 순서를 그대로 지킵니다.
     - `ready`는 마운트 효과에서 true가 됩니다.
     - `ensureUser`는 저장 uid를 쓰고, 없으면 `claimNewIdentity()`를 부른 뒤 세션을 저장합니다. 실패하면 `unavailable=true`로 둡니다. 지금 `catch`(`:78-81`)와 같습니다.
     - `onAuthStateChange`(`:116-121`) 대신 `storage` 이벤트로 `slseoun-identity`와 `sb-*-auth-token`을 감시합니다.
     - `identityCookieMode()` 게이트, `signInAnonymously`, `setSession`을 지웁니다.
  4. **`use-puzzlebox-scores.ts`**
     - `hasSession`(`:168-178`)과 `:215`/`:289`의 토큰 판단을 "저장 uid나 claim 표식이 있음"으로 바꿉니다. 지금도 쿠키 모드 사용자는 저장 세션이 있어 me 경로로 갑니다.
     - legacy RPC 분기를 지웁니다(`:149-160`, `:242-262`, `:305-318`).
     - `encodePuzzleboxBoards`가 null이면 unavailable입니다.
     - `supabaseEnabled` 게이트(`:131`, `:198`, `:236`, `:279`)를 지웁니다.
  5. **`claim.ts`**
     - 본문에 `refresh_token`(길이 상한)을 받습니다.
     - access token 검사가 `token_invalid`일 때만 refresh를 시도합니다. 해당하는 경우는 180일 기한을 넘었거나(`:115`), HS256인데 secret이 없을 때입니다.
     - refresh는 `supabase-refresh.ts`가 합니다. `POST {API_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`를 anon 키로 4초 제한을 두고 보냅니다. `supabase-signup.ts:47-90`과 같은 방식입니다.
     - 새 토큰은 만료를 무시하지 않고 검증하고, 익명 사용자인지 확인합니다. 그 uid로 claim하고 `session`을 돌려줍니다.
     - 400이면 `token_invalid`, 5xx나 시간 초과면 503 `auth_unavailable`입니다.
     - 이 refresh는 오늘 브라우저가 supabase-js로 하던 갱신을 Worker로 옮긴 것입니다. Supabase Auth는 7단계까지 Worker가 쓰므로 계획과 맞습니다.
  6. **`mode.ts`**: 플래그 행이 없거나 읽기에 실패하면 `API_IDENTITY_MODE_DEFAULT === "cookie"`일 때 cookie로 둡니다(`:44`, `:48`, `pageIdentityMode`). kill switch, secret 없음, QA 쿠키는 지금처럼 token입니다.
- **spec**
  - `api-identity-client.spec.ts`를 다시 씁니다. 진짜 supabase-js 연결(`:35-38`)과 `process.exit`(`:233`)을 지우고, 가짜 localStorage와 fetch로 확인합니다.
    - 저장 토큰 claim
    - 기한이 지난 토큰은 refresh 뒤 같은 uid, 그리고 세션 저장
    - refresh 거절이면 `{}`, 그러면 `kept`나 `signed_up`
    - 새 사용자 세션이 `iss`로 만든 키에 저장됨
    - Authorization 헤더가 한 번도 붙지 않음
    - `sb-` 키를 지우지 않음
  - `api-identity.spec.ts`: refresh claim 경로 전체(성공, 400, 5xx, 익명이 아님)와 `API_IDENTITY_MODE_DEFAULT`.
- **testbed**
  - 새 프로필로 https://scare-the-spire-testbed.flavono123.workers.dev/compendium/cards/abrasive 에서 댓글을 씁니다. claim이 `signed_up`이어야 하고, localStorage `sb-…-auth-token`이 생기고, 요청에 Authorization이 없어야 합니다.
  - 기존 세션 프로필로 같은 페이지를 엽니다. claim으로 같은 uid를 받고, 예전 내 댓글에 삭제 버튼이 보여야 합니다.
  - 두 탭을 엽니다. 한 탭에서 claim하면 다른 탭의 userId가 바뀌어야 합니다.
  - https://scare-the-spire-testbed.flavono123.workers.dev/vexing-puzzlebox 에서 기록을 제출하면 순위표에 "내 순위"(is_me)가 보여야 합니다.
  - `slseoun_idm` 쿠키를 지운 뒤에도 같게 동작해야 합니다.

### WP-P. 패치 정적 클라이언트

- **목표**: `patch-comments-client.js`에서 Supabase 직접 호출과 토큰 경로를 없앱니다. config에서 URL과 키를 뺍니다.
- **파일**: `src/components/patches/patch-comments-client.js`, `scripts/build-patch-worker.tsx`(**config JSON `:654-658`만**. define은 WP-Z가 고침), `scripts/api-identity-patch-client.spec.ts`, `scripts/courier-comment-text.spec.ts`(fixture config만), `scripts/patch-client-no-supabase.spec.ts`(새 파일)
- **단계**
  1. 공용 헬퍼를 지웁니다: `authRequest`(`:435-457`), `ensureSession`(`:463-496`), `restRequest`(`:498-526`), `commentsPath`/`commentLikesPath`(`:528-545`).
  2. legacy 분기를 지웁니다: `:703-722`, `:967-1003`, `:1087-1101`, `:1159-1191`, `:1660-1667`, `:1910-1915`, `:1966-1976`, `:2061-2093`.
  3. 자체 `surfacePath`와 demote(`:1381-1396`), 신원 모드 게이트(`:1401-1409`, `:931`, `:1607`), 토큰 경로(`:947-955`, `:1494-1526`, `:1606-1619`)를 지웁니다. `apiWriteAsUser`는 쿠키만 씁니다.
  4. `readConfig`(`:84`)는 URL과 키를 요구하지 않습니다. `!config`로 막던 곳(`:653`, `:1233-1238`, `:2014`)을 없앱니다. `configEnv`(`:1621-1628`)는 `config.dataEnv`를 읽습니다.
  5. `authStorageKey`는 기존 키를 찾고, 없으면 `iss`로 만듭니다. `ensureClaimed`(`:1472-1480`)는 WP0 계약을 따릅니다. `refresh_token`을 보내고, `token_invalid`이면 `{}`를 보내고, 받은 세션을 저장합니다. `:1478`의 쓰기는 유지합니다.
  6. `apiRequest`(`:1546-1600`)는 표식이 없거나 409이면 unavailable 오류를 던집니다(그룹을 내리지 않음). nav 스냅샷이 거부되면 점과 배달부가 없습니다.
  7. `build-patch-worker.tsx:654-658`의 config를 `{ dataEnv: process.env.NEXT_PUBLIC_SUPABASE_ENV ?? "production" }`로 바꿉니다. `apiPathDefault`도 지웁니다.
- **spec**
  - `api-identity-patch-client.spec.ts`(`:13-14`의 CONFIG, `:91-139`)를 쿠키 전용 흐름으로 다시 씁니다.
  - 새 spec은 파일에 `supabase.co`, `/rest/v1`, `/auth/v1`, `Authorization`이 없는지 정적으로 검사합니다.
  - `api-write-retry.spec.ts`는 `node --check`만 하므로 그대로 둡니다.
- **testbed**
  - https://scare-the-spire-testbed.flavono123.workers.dev/patches/2026-11-12 와 https://scare-the-spire-testbed.flavono123.workers.dev/en/patches/2026-11-12 에서 확인합니다.
    - 배달부
    - 릴 버프·너프·재작업 반응
    - 이야기 버튼
    - `/_patches/patch-rich-comments.js`를 막아 정적 댓글 경로를 강제한 뒤 댓글 쓰기, 좋아요, 삭제
  - https://scare-the-spire-testbed.flavono123.workers.dev/patches/2026-09-11 에서도 확인합니다.
  - 페이지 소스의 `sts-patch-comments-config`에 URL과 키가 없어야 합니다.

### WP-N. 네비와 배달부

- **파일**: `src/lib/nav-seen.ts`, `src/lib/nav-snapshot.ts`, `src/hooks/use-nav-seen.ts`, `src/hooks/use-mailbox-reply.ts`, `src/components/comment-courier.tsx`, `src/components/patches/patch-nav-indicators-client.ts`(필요할 때만), `scripts/nav-seen.spec.ts`
- **단계**
  1. legacy 읽기를 지웁니다: `nav-seen.ts:295-339`, `:364`, `comment-courier.tsx:159-172`.
  2. `fetchUnreadSurfaceIds`(`:372-383`)와 `courierRows`(`:175-184`, `:275`)는 `loadNavSnapshot`만 씁니다. 실패하거나 env가 맞지 않으면(`nav-snapshot.ts:38-41,50`) 점이 없고 배달부가 비어 있습니다. 지금 legacy가 장애 때 내는 결과와 같습니다.
  3. 저장 키 접미사(`nav-seen.ts:94-104`, `:257`)와 `use-mailbox-reply.ts:6,14`는 `dataEnv`를 씁니다. **값이 같아야** 읽음 상태가 보존됩니다.
- **spec**: `nav-seen.spec.ts`. 스냅샷만으로 계산하는지, 실패 때 빈 결과인지, 저장 키 문자열이 바뀌지 않았는지 확인합니다.
- **testbed**
  - https://scare-the-spire-testbed.flavono123.workers.dev/ 에서 다른 브라우저로 글을 쓴 뒤 새 글 점이 뜨는지, 그 화면을 방문하면 점이 사라지는지, 배달부에 최신 댓글 12개가 보이는지 봅니다.
  - localStorage `sts-nav-*` 키 이름이 배포 전과 같아야 합니다.

### WP-C. 참여(댓글·좋아요·반응)와 이야기

- **파일**: `src/hooks/use-comments.ts`, `src/hooks/use-comment-likes.ts`, `src/hooks/use-likes.ts`, `src/hooks/use-resource-reactions.ts`, `src/hooks/use-engagement-counts.ts`, `src/hooks/use-community-stories.ts`, `src/lib/api-engagement.ts`, `src/lib/engagement-keys.ts`(주석), `src/components/colorful-philosophers/resource-thread.tsx`, `src/components/story-composer-modal.tsx`
- **단계**
  1. client-data 2절 comments와 stories 표의 legacy 분기를 모두 지웁니다.
  2. `use-community-stories.ts:176-193,212`의 Realtime을 지웁니다(계획 5.4).
  3. `use-community-stories`의 `limit` 타입을 `100 | 200 | 1000`으로 좁힙니다(`stories-api-rules.ts:11`). 호출자 5곳은 이미 이 값을 쓰므로 컴파일로 보장됩니다.
  4. `use-resource-reactions.ts:47-108`의 `fetchResourceReactionCounts`/`saveResourceReaction`은 시그니처를 그대로 두고 `/api/read/engagement?reactions=`와 `PUT /api/write/reactions`로 다시 씁니다. 유일한 사용처는 개발 전용 하이드레이션(WP-B)입니다.
  5. `api-engagement.ts`
     - `unknownBody()` legacy 신호(`:151-154`)를 unavailable로 바꿉니다.
     - `:285` 재export는 남겨 둡니다(WP-Z가 지움).
     - 키 규칙 실패는 빈 스레드로 둡니다. 근거는 P15입니다.
  6. `story-composer-modal.tsx:171,225,236,329-349`의 `storageDisabled` 게이트를 지웁니다. 운영처럼 늘 쓸 수 있게 둡니다. 문구 키는 WP-Z가 지웁니다.
- **spec**: 새 `scripts/engagement-client.spec.ts`(WP-Z가 등록). 키 규칙 실패와 legacy 신호가 unavailable이나 빈 결과인지, 반응 두 함수가 api를 부르는지 확인합니다.
- **testbed**
  - https://scare-the-spire-testbed.flavono123.workers.dev/compendium/cards/abrasive 에서 댓글 목록·쓰기·삭제, 댓글 좋아요, 페이지 좋아요 수, 반응 막대, 다채로운 철학자들 스레드를 봅니다.
  - https://scare-the-spire-testbed.flavono123.workers.dev/byrdispatch 에서 이야기 쓰기·삭제를 봅니다.
  - https://scare-the-spire-testbed.flavono123.workers.dev/patches/changes 에서 이야기 목록을 봅니다.

### WP-D. 다채로운 철학자들, 문의, 프로필

- **파일**: `src/hooks/use-colorful-philosopher-posts.ts`, `src/lib/contact-inquiries.ts`, `src/hooks/use-profile-character-nicknames.ts`, `src/hooks/use-profile-activity.ts`, `src/app/(main)/contact/contact-page.tsx`, `src/components/profile-activity.tsx`, `src/app/colorful-philosophers/**`(counts 전달이 바뀔 때만)
- **단계**
  1. legacy 분기를 지웁니다(client-data 2절).
  2. **uuid가 아닌 글 id는 요청 없이 unavailable**로 둡니다. 지금은 legacy로 가서 PostgREST가 오류를 내고 "응답 없음"이 됩니다(`:154`, `:186-197`). 비평가 1-10의 차이를 내지 않습니다.
  3. `useColorfulPhilosopherWeek(env)`에서 `env !== dataEnv`이면 unavailable입니다. 유일한 호출자는 개발 페이지이고 WP-DEV가 바꿉니다.
  4. `useColorfulPhilosophersNextWeekOpen`(`:120-140`)은 건드리지 않습니다. WP-DEV가 사용처를 옮긴 뒤 WP-Z가 지웁니다.
  5. 사용자 문구 "Supabase is not configured"(`contact-inquiries.ts:72,135`)를 게이트와 함께 지웁니다.
  6. `supabaseEnabled` 게이트를 지웁니다: `contact-page.tsx:65`, `profile-activity.tsx:143,163`, `use-profile-activity.ts:147-157,191-196,225`.
- **spec**: 새 `scripts/contact-profile-client.spec.ts`. uuid가 아닌 id, 다른 env, legacy 신호의 결과를 확인합니다.
- **testbed**
  - https://scare-the-spire-testbed.flavono123.workers.dev/colorful-philosophers 에서 이번 주 글, 댓글 수, 글 상세를 봅니다.
  - https://scare-the-spire-testbed.flavono123.workers.dev/colorful-philosophers/not-a-uuid 에서 배포 전과 같은 안내가 나와야 합니다.
  - https://scare-the-spire-testbed.flavono123.workers.dev/contact 에서 문의를 제출합니다.
  - https://scare-the-spire-testbed.flavono123.workers.dev/profile 에서 문의 목록, 활동 통계·목록, 닉네임을 봅니다. 답변 표시는 WP-DEV 스크립트로 testbed 답변을 넣은 뒤 우편함 점과 읽음 처리까지 봅니다.

### WP-H. 역사 강의서

- **파일**: `src/lib/run-donation.ts`, `src/hooks/use-history-course-engagement.ts`, `src/components/history-course/history-course-run-index.tsx`, `donation-panel.tsx`, `run-upload-zone.tsx`, `run-detail-loader.tsx`, `src/lib/history-course-share-state.ts`, `src/components/combo/combo-history-run-picker.tsx`, `src/app/(main)/history-course/[runId]/page-content.tsx`, `scripts/history-course-engagement-chunks.spec.ts`(새 파일)
- **단계**
  1. legacy 분기를 지웁니다(client-data 2절 history-runs). `step3/reads`가 더한 `fetchDonatedRunRaw`/`getDonatedRunRaw`의 `runs.raw` Supabase 대체도 지웁니다.
  2. `runReadEnvs`(`:89-94`, 개발 빌드가 운영 행을 읽음)를 지웁니다. 개발 도구에서 이 기능은 WP-DEV의 `/api/dev/history-course-runs`가 맡습니다.
  3. `use-history-course-engagement.ts:41-45`
     - id를 중복 없이 모으고, `isRunId`에 맞는 것만 100개씩 나눠 부른 뒤 합칩니다.
     - 규칙 밖 id는 0으로 둡니다. 근거는 P14입니다.
     - 지금 legacy는 1,000행 상한(`.limit(1000)`)이 있어 그보다 클 때만 수가 다를 수 있습니다.
     - `ready`의 `!supabaseEnabled`도 지웁니다.
  4. 사용자 문구 "Supabase 연결이 설정되지 않았습니다."(`:271,330,419`)와 게이트(`:270-680`의 13곳)를 지웁니다. `localCoverSaveAttemptsRemoteSync(true)`로 둡니다.
  5. `[runId]/page-content.tsx:40`: 서버 OG는 fallback만 씁니다. 정적 빌드는 `metadataRecordId`가 undefined라 지금도 읽지 않습니다.
- **spec**: 새 chunk spec(150개, 중복, 규칙 밖 id). 기존 `history-course-index-sort.spec.ts`도 돌립니다.
- **testbed**
  - https://scare-the-spire-testbed.flavono123.workers.dev/history-course 에서 확인합니다. testbed에는 공유 런이 103개 있어 100개를 넘는 경우를 그대로 볼 수 있습니다.
    - 목록의 좋아요·댓글 수
    - 무작위 고르기 카드
    - "업로드 때 공유"로 런 올리기
    - 표지 저장, 닉네임 수정, 삭제
  - 목록 첫 런의 상세(`https://scare-the-spire-testbed.flavono123.workers.dev/history-course/<그 런 id>`)에서 원문 받기를 봅니다.
  - 로컬 IndexedDB 런 재생도 봅니다.

### WP-T1. 장난감 상자 피드와 코오오옴보, 케미컬 X, 변신, 결정 결정

- **파일**: `src/lib/toybox-feed.ts`, `src/lib/toybox-api.ts`, `src/lib/defragment-feed.ts`, `src/hooks/use-toybox-feed.ts`, `src/hooks/use-defragment-feed.ts`, `src/hooks/use-chemical-posts.ts`, `src/hooks/use-combo-posts.ts`, `src/hooks/use-transfigure-posts.ts`, `src/hooks/use-decisions-decisions-posts.ts`, `src/components/chemicalx/post-view.tsx`, `src/lib/toybox-post-og-fields.ts`, `src/app/{c-c-c-combo,chemical-x,this-or-that,transfigure,pagestorm}/[id]/page-content.tsx`, `src/app/defragment/[id]/page-content.tsx`, `src/app/defragment/[id]/[postId]/page-content.tsx`, `scripts/toybox-feed.spec.ts`, `scripts/defragment-feed.spec.ts`
- **단계**
  1. client-data 2절 toybox-feed 표 중 이 파일들의 `else supabase…` 분기를 지웁니다. `defragment-feed.ts:187-213`(runs 피드)도 여기서 지웁니다.
  2. `use-toybox-feed.ts:97-137`의 Realtime을 지웁니다. 운영은 이미 api 경로라 채널을 열지 않으므로 보이는 변화가 없습니다.
  3. `viaApi = false` 기본 인자를 아예 지웁니다(`use-combo-posts.ts:117-121`, `use-transfigure-posts.ts:352-356`).
  4. `apiCursorOk`(`:139-141`) 실패는 unavailable입니다. 커서는 서버가 만든 ISO 시각과 row id입니다.
  5. `toyboxViaApi()`는 true를 돌려주는 stub으로 둡니다. WP-T2 파일이 쓰고, WP-Z가 지웁니다.
  6. `isCheckViolation` import는 `@/lib/db-errors`로 바꿉니다.
  7. `toybox-post-og-fields.ts`는 DB를 읽지 않고 fallback만 돌려줍니다. 정적 셸 결과는 지금과 같습니다.
- **testbed**
  - https://scare-the-spire-testbed.flavono123.workers.dev/c-c-c-combo (최신순·인기순, 더 보기, 쓰기·수정·삭제)
  - https://scare-the-spire-testbed.flavono123.workers.dev/chemical-x
  - https://scare-the-spire-testbed.flavono123.workers.dev/transfigure
  - https://scare-the-spire-testbed.flavono123.workers.dev/decisions-decisions
  - https://scare-the-spire-testbed.flavono123.workers.dev/defragment (글 피드와 런 피드)
  - 각 서비스의 글 상세 하나를 `curl`해서 셸 HTML이 배포 전과 같은지 봅니다.

### WP-T2. 페이지스톰, 최애 토너먼트, 이거 아님 저거?, 조각모음 본문

- **파일**: `src/hooks/use-pagestorm-posts.ts`, `src/hooks/use-pagestorm-toybox.ts`, `src/hooks/use-favorite-tournament-posts.ts`, `src/hooks/use-this-or-that-posts.ts`, `src/hooks/use-this-or-that-likes.ts`, `src/hooks/use-this-or-that-votes.ts`, `src/hooks/use-defragment-posts.ts`, `src/hooks/use-defragment-bodies.ts`, `src/components/defragment/defragment-post-view.tsx`, `scripts/pagestorm.spec.ts`, `scripts/defragment-submit.spec.ts`
- **단계**: client-data 2절 표 중 이 파일들의 legacy 분기와 `supabaseEnabled` 게이트(realtime-ui 4-A·4-B 목록)를 지웁니다. `use-defragment-bodies.ts:83`의 `isRowId` 조건은 규칙 밖이면 "없음"입니다(근거 P14).
- **testbed**
  - https://scare-the-spire-testbed.flavono123.workers.dev/pagestorm (임시 저장 만들기·수정·삭제, 게시, 목록, 상세, 삭제)
  - https://scare-the-spire-testbed.flavono123.workers.dev/this-or-that (글, 좋아요, 투표와 취소, 토너먼트 플레이 완료와 통계)
  - 조각모음 상세의 본문 저장

### WP-B. 빌드 시점 읽기와 패치 릴 (4절 결정에 따름. 아래는 A안 기준)

- **파일**: `src/lib/transfigure-data.ts`, `src/lib/colorful-philosophers-gallery.ts`, `src/lib/build-supabase-read.ts`(→ `src/lib/build-d1-read.ts`로 바꿈), `src/components/patches/patch-detail-page.tsx`, `backstab-transfigure-section.tsx`, `backstab-colorful-philosophers-section.tsx`, `src/app/(main)/patches/[version]/page.tsx`, `src/app/[gameLocale]/patches/[version]/page.tsx`, `src/app/(main)/dev/patch-types/patch-types-dev-page.tsx`, `scripts/build-supabase-read.spec.ts`(→ `scripts/build-d1-read.spec.ts`)
- **단계**
  1. `PatchDetailPage`에 `reels?: "build" | "none"` prop(기본 `"build"`)을 둡니다. Next 라우트 두 곳(`page.tsx:28`, `:34`)은 `"none"`을 넘기므로 `next build`는 읽지 않습니다. `build-patch-worker.tsx:921,941`은 그대로라서 build가 기본입니다.
  2. 로더는 D1에서 읽습니다. 데이터 env가 production이면 `slseoun-prod`, development면 `slseoun-testbed`입니다(`scripts/d1-sync/reconcile.ts:63-76` 방식).
     - 접근은 `wrangler d1 execute --remote --json`(`scripts/runtime-flags.ts`와 같은 방식. 로컬은 OAuth, CI는 기존 `CLOUDFLARE_API_TOKEN`)이나 `scripts/d1-sync/d1-http-client.ts`로 합니다.
     - 행 모양은 `/api`와 같아야 합니다. 변형은 `postObject("transfigure")`(`workers/api/d1-adapters/toybox.ts:98-111`)로 최신 15개를, 철학자 릴은 `Q_F3`/`Q_E5`(`queries.ts:310-311,26-27`)를 씁니다.
     - 운영이 아닌 env의 결과가 비면 production 행을 빌리는 동작(`transfigure-data.ts:45-57`)은 유지합니다.
  3. 실패 규칙은 그대로 옮깁니다(`build-supabase-read.ts:17-39`).
     - 운영 데이터 env면 빌드를 실패시킵니다.
     - 아니면 표본 글과 `THIS BUILD CONTAINS FALLBACK DATA` 경고를 냅니다.
     - 우회 변수는 `ALLOW_BUILD_WITHOUT_D1`로 이름을 바꿉니다. CI 쪽은 WP-Z가 고칩니다.
  4. 개발 전용 하이드레이션을 바꿉니다.
     - `backstab-colorful-philosophers-section.tsx:165-192`: `/api/read/colorful-philosophers/reel`과 WP-C가 바꾼 반응 함수를 씁니다.
     - `backstab-transfigure-section.tsx:102-122`: `/api/read/toybox-feed?service=transfigure&sort=latest`의 앞 15개를 같은 매핑으로 씁니다.
  5. 이 묶음이 정할 `ALLOW_BUILD_WITHOUT_D1` 같은 변수 이름은 WP-Z(CI)와 WP-Q(testbed 실행기)에 넘깁니다.
- **spec**: `build-d1-read.spec.ts`. 응답 없는 D1 stub으로 운영이면 실패, 개발이면 대체, 우회 변수가 있으면 계속 진행하는지 봅니다. `ci.yml:48` 교체는 WP-Z가 합니다.
- **동일성 검사**
  - 브랜치의 `patch:build` 결과와 현재 testbed의 `/patches/2026-11-12`, `/patches/2026-09-11`(14개 언어)를 비교합니다.
  - `/transfigure/<id>` 링크 15개가 같은 순서여야 하고, `data-colorful-philosophers-card` 3개와 그 수가 같아야 합니다.
  - Supabase와 D1 자격 증명 없이 `pnpm cf:build`가 성공하고 Supabase에 연결하지 않아야 합니다.
- **testbed**: https://scare-the-spire-testbed.flavono123.workers.dev/patches/2026-11-12 , https://scare-the-spire-testbed.flavono123.workers.dev/patches/2026-09-11 , https://scare-the-spire-testbed.flavono123.workers.dev/en/patches/2026-11-12 에서 변형 릴은 testbed 최신 15개, 철학자 릴은 로드 뒤 수가 갱신돼야 합니다.

### WP-O. 상세 셸 OG를 D1으로

- **파일**: `workers/detail-shell-og.ts`, `workers/main-worker.ts`(Env 타입 `:9-19`, OG 호출), `scripts/detail-shell-og.spec.ts`, `scripts/check-cloudflare-route-coverage.ts`(`:126-129`)
- **단계**
  1. `resolveSupabaseConfig`(`:197-221`)와 `fetchSupabaseRestSingleRow`(`:223-252`)를 지웁니다. 분기마다 D1에서 읽습니다(build-worker 인벤토리 2.1 표).
     - 일반 글은 `postSql(service)`(`toybox.ts:231-236`)과 `postObject`를 쓰고, 런은 `Q_R5`(`queries.ts:211`)를 씁니다.
     - uuid는 소문자로 바꿉니다.
     - 지금 늘 null인 분기는 null 그대로 둡니다: decisions-decisions(없는 표), defragment, 토너먼트 id.
  2. 켜는 조건은 `env.DETAIL_SHELL_OG === "d1" && env.DB`입니다. wrangler에는 넣지 않으므로 꺼진 상태가 지금과 같습니다. 600ms 제한과 "보강에 성공했을 때만 캐시"는 유지합니다.
  3. route coverage 검사는 `DETAIL_SHELL_OG`가 없는 상태로 돌게 바꿉니다.
- **spec**
  - D1 stub으로 다시 씁니다(`:304-328`).
  - 꺼져 있으면 셸이 바뀌지 않는지 봅니다.
  - 켜져 있으면 지금 Supabase stub fixture와 같은 OG 값이 나오는지 봅니다.
- **testbed**: `curl -sI`와 본문으로 https://scare-the-spire-testbed.flavono123.workers.dev/this-or-that/ 아래 testbed 최신 글 하나를 봅니다. `x-cf-static-page: shell`, `<title>이거 아님 저거? - 슬서운 이야기</title>`, 목록 기본 og:image가 나오고, 배포 전 응답과 바이트까지 같아야 합니다.

### WP-Q. QA와 로컬 개발

- **파일**: `playwright.config.ts`, `scripts/run-cloudflare-testbed.mjs`, `scripts/cloudflare-testbed.spec.ts`, `scripts/contact.spec.ts`, `scripts/dev-patch-proxy.mjs`, `scripts/mobile-qa.mjs`, `scripts/d1-local-seed.ts`(새 파일)
- **단계**
  1. **`playwright.config.ts:33-53`**
     - `PLAYWRIGHT_BLOCK_SUPABASE=1`은 DNS 차단만 하게 바꿉니다. QA 쿠키는 테스트가 직접 넣을 때만 씁니다.
     - 근거: P6·P7 상태의 testbed Worker는 요청을 D1에서 답하므로, 쿠키가 없어도 QA가 공유 Supabase에 주는 부하가 claim 가입과 미러 cron 정도입니다.
     - **Worker의 QA 쿠키 의미는 바꾸지 않습니다.** 쿠키가 있으면 지금도 legacy와 DNS 차단 때문에 "응답 없음"이고, 6단계 뒤에는 409 때문에 같은 "응답 없음"입니다. 그래서 `.codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs:108-111`의 기본 동작도 지금과 같은 결과를 냅니다. 이 파일은 고치지 않습니다.
  2. **`cloudflare-testbed.spec.ts`**
     - `blockSupabase`(`:81-85`)는 경로 차단만 합니다.
     - "Supabase failure uses the shared unavailable state"(`:398-406`)는 그 테스트 안에서 QA 쿠키를 넣어 409 상황을 흉내 냅니다. 기대 화면은 같습니다.
     - 새 테스트를 더합니다.
       - (a) 홈, 카드, 패치, 서비스 피드·상세, 쓰기 흐름을 돌며 `*.supabase.co` 요청이 0인지
       - (b) 409가 0인지
       - (c) 새 컨텍스트로 쓰면 claim 뒤 `sb-` 세션이 저장되는지
       - (d) 역사 강의서 런이 100개를 넘을 때 수가 맞는지
     - CSP 검사(`:48-71`)는 그대로 가드로 둡니다.
  3. `contact.spec.ts`: `**/auth/v1/signup`, `**/rest/v1/contact_inquiries` mock(`:117-121`, `:153-171`)을 `/api/auth/claim`, `/api/write/contact-inquiries`, `/api/me/mailbox` mock으로 바꾸고, 가짜 HS256 세션(`:19-52`)을 정리합니다. `/dev/admin` 확인(`:187-191`)은 WP-DEV가 페이지를 유지하므로 그대로 둡니다.
  4. **로컬 개발**(계획 5.6: 로컬은 `wrangler dev`의 로컬 SQLite)
     - `dev-patch-proxy.mjs`가 `/api/read|me|write/*`와 `/api/auth/claim`을 로컬 main Worker(`wrangler dev --local`, 127.0.0.1:8787)로 넘깁니다. 지금은 next dev로 넘깁니다(`:354-375`, `:444-451`). `/api/link-preview`와 `/api/dev/*`는 계속 next dev로 보냅니다.
     - `d1-local-seed.ts`
       - 로컬 D1에 `d1/migrations`를 적용합니다.
       - `wrangler d1 export slseoun-testbed --remote` 결과를 넣습니다.
       - 로컬 runtime_flags를 P3~P7 값으로 둡니다.
       - Worker 로컬 변수는 `cf:testbed:local --api` 방식(`run-cloudflare-testbed.mjs:105-132,398-402`)으로 `.env.local`의 dev Supabase에서 만들고 `API_IDENTITY_SECRET`도 줍니다.
     - `mobile-qa.mjs:82-90,150`도 같은 프록시를 거치게 합니다.
  5. `run-cloudflare-testbed.mjs:309-311`: WP-B가 정한 빌드 변수(데이터 env와 D1 접근)를 넘깁니다. `:261`은 1번과 맞춥니다.
- **testbed**: 통합 브랜치에서 `pnpm cf:testbed` 전체(smoke와 QA)를 돌립니다. 로컬에서는 `pnpm dev`로 https://scare-the-spire-testbed.flavono123.workers.dev/ 와 같은 화면에 데이터가 뜨는지 봅니다(주소는 `http://127.0.0.1:<dev 포트>/`).

### WP-DEV. 관리·개발 도구와 운영자 쓰기 (계획 5.7)

- **파일**
  - `src/app/(main)/dev/admin/admin-dev-page.tsx`, `src/app/(main)/dev/admin/page.tsx`, `src/components/dev/admin-profile-nicknames.tsx`
  - `src/app/(main)/dev/colorful-philosophers/{actions.ts,colorful-philosophers-dev-page.tsx,page.tsx}`
  - `src/app/(main)/dev/nav-indicators/nav-indicators-dev-page.tsx`, `src/app/(main)/dev/toybox-preview/toybox-preview-dev-page.tsx`
  - `src/app/api/dev/contact-inbox/route.ts`, `src/app/api/dev/history-course-runs/route.ts`, `src/app/api/dev/history-course-runs/[runId]/route.ts`
  - `src/app/api/dev/colorful-philosophers/next-week/route.ts`(새 파일)
  - `src/hooks/use-dev-contact-inbox.ts`, `src/hooks/use-dev-philosophers-next-week.ts`(새 파일), `src/components/site-navbar.tsx`(개발용 점 `:787`, `:797`만), `src/components/history-course/prod-runs-dev-section.tsx`
  - `scripts/lib/d1-remote.ts`(새 파일, 서버 전용), `scripts/admin/{inquiry-reply,nickname-pool,philosopher-post}.ts`(새 파일), `scripts/seed-favorite-tournament-builtins.ts`
  - `.claude/skills/patch-note-revision/SKILL.md:63-70`, `.codex/skills/patch-note-revision/SKILL.md:63-70`
- **단계**
  1. **쓰기**(문의 답변, 닉네임 풀 저장·초기화, 철학자 주간 글 upsert, 월드컵 기본 대회 seed)
     - D1 batch와 outbox 한 줄을 같은 batch로 씁니다(`workers/api/d1-write/outbox.ts` builder 재사용). 미러가 Supabase를 따라오게 해야 저장소 되돌리기 때 잃는 것이 없습니다.
     - 화면의 서버 액션(`admin-dev-page.tsx:643-719`, `actions.ts:83-98`)과 CLI 스크립트가 같은 함수를 씁니다.
     - **이 절반은 5단계 전환 전에 나가야 합니다(P17).**
  2. **읽기**(문의, 닉네임 풀, 글 목록, 다른 env의 주간 글, 운영 런 100개, 다음 주 예약 확인, 미확인 문의 수)
     - 개발 서버가 `d1-remote.ts`로 D1을 읽습니다.
     - `/dev/admin` 화면은 그대로 유지합니다.
     - `get_rls_activity_metrics`(`:539-567`)는 D1에 대응하는 것이 없습니다. Supabase 쪽 지표이므로 7단계까지 개발 서버가 fetch로 PostgREST RPC를 secret 키로 읽습니다. supabase-js는 쓰지 않습니다.
  3. `site-navbar.tsx`의 다음 주 점은 새 개발용 훅(`/api/dev/colorful-philosophers/next-week`)으로 바꿉니다. WP-D의 옛 훅은 WP-Z가 지웁니다.
  4. 스킬 문서의 `supabase db query … UPDATE community_stories`는 "D1(원본)을 고치고 outbox로 미러"하는 스크립트 호출로 바꿉니다.
- **spec**: `scripts/admin-d1-writes.spec.ts`(새 파일). 각 쓰기 batch에 outbox 행이 들어 있는지, Supabase 행 모양과 같은지 확인합니다.
- **testbed**
  - testbed 문의에 `scripts/admin/inquiry-reply.ts --env testbed`로 답변을 넣습니다. 그 사용자가 https://scare-the-spire-testbed.flavono123.workers.dev/ 에서 우편함 점을, https://scare-the-spire-testbed.flavono123.workers.dev/profile 에서 답변을 봅니다.
  - outbox가 비워졌는지, dev Supabase 행에 반영됐는지 손 대조(`scripts/d1-reconcile`)로 확인합니다.
  - 닉네임 풀 변경과 철학자 글 upsert는 https://scare-the-spire-testbed.flavono123.workers.dev/colorful-philosophers 에서 봅니다.

### WP-W. Worker 기본값과 플래그 CLI

- **파일**: `wrangler.jsonc`, `scripts/runtime-flags.ts`(그리고 `step3/reads`의 `scripts/runtime-flag-keys.ts`), `scripts/runtime-flags-guard.spec.ts`(새 파일)
- **단계**
  1. 운영과 testbed vars에 P9~P12를 넣습니다. 5단계 배포에서 이미 넣었다면 건너뜁니다.
  2. `:14-17` 주석을 고칩니다. `"off"`는 6단계 뒤 커뮤니티 기능 전면 중단이고, 되돌리기는 `source.<group>`과 두 Worker 버전 롤백이라는 내용입니다.
  3. CLI가 `path.* legacy`, `identity.mode token`, `write.* rls`를 6단계 뒤에는 `--old-client`(두 Worker를 6단계 이전 버전으로 되돌렸을 때) 없이 거부하게 합니다. 운영 중단을 일으키는 값이 됐기 때문입니다.
- **testbed**: `pnpm flags list --env testbed --remote`로 값을 보고, 거부 동작을 확인합니다. 값은 바꾸지 않습니다.

### WP-Z. 마무리(직렬, 맨 마지막)

- **파일**: `src/lib/supabase.ts`(지움), `src/lib/supabase-timeout.ts`(지움), `src/lib/runtime-flags.ts`, `src/lib/api-client.ts`(stub, `token` 옵션, Bearer `:108-109,136`), `src/lib/toybox-api.ts`(`toyboxViaApi`), `src/lib/api-engagement.ts:285` 재export, `src/hooks/use-colorful-philosopher-posts.ts`(다음 주 훅), `src/messages/service.ts`(`storageDisabled` 등 쓰지 않는 키), `scripts/build-patch-worker.tsx`(define `:691-693`과 `NEXT_PUBLIC_API_PATH_DEFAULT`, 주석 `:1-2`), `workers/security-headers.ts:19-21`, `public/_headers:6`, `scripts/check-client-bundle-supabase.mjs`(새 파일), `package.json`, `pnpm-lock.yaml`, `.github/workflows/cloudflare-workers.yml`, `.github/workflows/ci.yml`, 문서
- **단계**
  1. 남은 import가 0인지 grep으로 확인한 뒤 위 모듈과 stub을 지웁니다. `@supabase/supabase-js`를 빼고 `pnpm install`합니다. 패키지 8개가 빠집니다.
  2. CSP 두 파일을 같은 커밋에서 고칩니다.
  3. 번들 검사는 `.cloudflare/assets`와 `.patch-worker/assets` 전체(js, html)에서 1.1의 문자열과 anon 키 앞부분을 찾습니다. `cf:assets`(`package.json:14`)와 `patch:build`(`:31`)에 붙입니다. Worker 검사(`check-cloudflare-worker-size.mjs:67-77`)는 그대로 둡니다.
  4. 새 spec들을 `test:api` 등에 등록합니다.
  5. **CI**
     - `cloudflare-workers.yml:29-31`의 job env에서 URL과 KEY를 빼고, main 배포 단계(`:282-308`)의 env로 옮깁니다(`:287-289`이 쓰는 값). ENV는 job에 남깁니다.
     - 검증 `:152-158`은 남깁니다.
     - `:32`의 `ALLOW_BUILD_WITHOUT_SUPABASE`는 WP-B 이름으로 바꾸고, `NEXT_PUBLIC_API_PATH_DEFAULT` 참조는 지웁니다.
     - 패치 배포 단계(`:172-190`, `:373-391`)에는 4절 결정에 필요한 env를 넣습니다.
     - `ci.yml:48`의 spec을 바꿉니다.
  6. **문서**
     - `docs/SUPABASE_EXIT_PLAN.md`: 상태, 5.7 문장 정정(4절), 6단계 결과
     - `docs/supabase-exit/{SURFACE_MAP.md,STEP1_DESIGN.md}`
     - `docs/SUPABASE_EXIT_PARALLEL_WORK.md:56-61`(QA 규칙)
     - `AGENTS.md:143`
     - `.codex/skills/feature-implementation/SKILL.md:39-41,243,327`("브라우저에서 Supabase로 읽기"를 `/api`로)
     - `docs/release/UNRELEASED.md`에 기능 기대치(Feature, Expect, QA) 추가
- **확인**
  - `pnpm cf:build && pnpm cf:assets && pnpm cf:size`, `pnpm patch:build && pnpm patch:test`, `test:api`, `test:d1-sync`, `pnpm storybook:build`
  - 3.0의 HTML 동일성 검사
  - `pnpm cf:testbed` 전체
  - 공통 브라우저 확인(supabase.co 요청 0, CSP 위반 0)

### 병합 순서와 배포

1. `step3/reads`와 `step4/prereqs`를 병합합니다.
2. WP0
3. 병렬 묶음 13개: A, P, N, C, D, H, T1, T2, B, O, Q, DEV, W. 신원이 쓰기 확인의 바탕이라 A를 먼저 병합할 것을 권합니다. 병합 뒤 testbed 확인은 한 묶음씩 합니다.
4. WP-Z
5. 정기 배포(`docs/RELEASE_PROCESS.md`)

**배포**
- 한 번의 배포에 두 Worker가 함께 나갑니다. CI는 패치 Worker를 main보다 먼저 배포합니다(`:172-190`). 새 패치 클라이언트는 이전 main Worker의 `/api`와도 동작합니다. 경로는 모두 있고 플래그가 api이기 때문입니다.
- 배포 전에 두 Worker의 직전 버전 id를 기록합니다.

**배포 뒤**
- 운영 https://scare-the-spire.flavono123.workers.dev 를 DNS 차단 브라우저로 공통 확인합니다.
- 넘어갈 조건은 Supabase 로그에서 운영 referer를 가진 `/rest/v1`, `/auth/v1`, `/realtime` 요청이 0건인 것입니다. 오래 열어 둔 옛 탭이 사라질 때까지 기다립니다.

**6단계 뒤 되돌리기**

| 상황 | 수단 | 조건 |
|---|---|---|
| 저장소 문제 | `source.<group>=supabase` | P5, `f26a818a`, 미러 정상. 6단계 클라이언트로 그대로 동작 |
| 클라이언트 버그 | `wrangler rollback`으로 **두 Worker 모두** 기록한 이전 버전으로(사용자 승인) | 이전 클라이언트와 현재 플래그 조합은 동작함 |
| **쓸 수 없는 것** | `path legacy`, `identity.mode token`, `write rls`, `API_RUNTIME_FLAGS=off` | 클라이언트를 이전 버전으로 되돌리기 전에는 전면 중단. WP-W가 CLI에서 막음 |

---

## 4. 결정이 필요한 것

**D1. `patch:build` 릴 데이터를 어디서 받을지.** 셸 패치 2개 × 14개 언어의 변형 릴 15개와 다채로운 철학자들 릴이 대상입니다.

계획 5.7은 "빌드는 DB를 읽지 않고, 글 데이터는 런타임 주입으로만"이라고 씁니다. 그런데 패치 페이지는 hydrate하지 않는 정적 HTML입니다. 변형 회전은 나중에 붙인 카드를 받지 못하고(`patch-comments-client.js:2002-2003`), 철학자 릴은 구운 글이 0개면 영역 자체가 없습니다(`backstab-colorful-philosophers-section.tsx:258`). 그래서 런타임 주입으로는 같은 화면을 만들 수 없습니다.

| 안 | 화면 | 필요한 것 | 걸리는 점 |
|---|---|---|---|
| **A(권장)** 빌드 때 D1 읽기 | 같음 | 기존 `CLOUDFLARE_API_TOKEN`에 D1 읽기 권한(P18, 사용자 확인) | 5.7 문장을 "빌드는 Supabase를 읽지 않는다. 패치 릴만 빌드 때 D1에서 굽는다"로 고쳐야 함 |
| B 빌드 때 배포된 같은 출처 `/api` | 같음 | 새 secret 없음 | 빌드가 사이트 가동에 기댐. testbed는 testbed 주소가 필요 |
| C 요청 시점 주입(5.7 문장 그대로) | 다름 | main Worker의 HTMLRewriter와 Worker 안 카드 렌더 | 새 기능 작업이고 "그대로 이관"을 벗어남 |

`next build` 쪽은 어느 안을 고르든 "읽지 않음"이고 화면 변화가 없습니다. WP-B, WP-Z(CI), WP-Q(testbed 실행기)가 이 결정을 기다립니다. 나머지 묶음은 이 결정과 상관없이 바로 시작할 수 있습니다.

**결정이 아닌 것(지금 동작 그대로 옮김, 근거만 적음)**

| 항목 | 그대로 옮기는 방법 |
|---|---|
| OG 보강 | D1 코드로 옮기되 기본 꺼짐(지금 운영도 꺼짐). 켜는 것은 tasks/010 #32 |
| QA 쿠키 | Worker 의미를 바꾸지 않음. 쿠키가 있을 때의 화면("응답 없음")이 지금과 같음 |
| 갱신 없는 토큰 | Worker refresh claim과 `token_invalid`이면 `{}`. 지금 supabase-js 갱신과 재가입의 결과와 같음 |
| uuid가 아닌 철학자 id, 규칙 밖 키·id | 지금 화면 결과를 재현하고 P14~P16으로 데이터를 확인 |
| 런 id 100개 초과 | 나눠 부르고 합침 |
| 로컬 `pnpm dev`, `qa:mobile` | 로컬 `wrangler dev`와 로컬 D1로 연결(계획 5.6에서 정함) |
| `/dev/admin`과 개발 페이지 | 화면은 유지하고 서버 쪽이 D1을 읽고 씀. 쓰기는 outbox 포함(계획 5.7) |
| 데이터 env | 값과 변수 이름은 7단계까지 유지, 코드 심볼만 `dataEnv`로 |

**주요 파일(절대 경로)**
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/docs/SUPABASE_EXIT_PLAN.md
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/supabase.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/api-client.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/runtime-flags.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/api-session.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/api-identity.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/hooks/use-auth.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/components/patches/patch-comments-client.js
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/build-patch-worker.tsx
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/identity/claim.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/identity/mode.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/write-flags.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/router.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/detail-shell-og.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/security-headers.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/public/_headers
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/wrangler.jsonc
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/playwright.config.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/.github/workflows/cloudflare-workers.yml
- `step3/reads` worktree: /Users/flavono123/P/scare-the-spire/.claude/worktrees/step3-reads
- `step4/prereqs` worktree: /Users/flavono123/P/scare-the-spire/.claude/worktrees/step4-prereqs