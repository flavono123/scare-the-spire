# 6단계 사전 조사(2026-11-09, 커밋 1557e8b3 기준 줄 번호)

영역별 조사 6개와 비평. 계획은 [STEP6_PLAN.md](STEP6_PLAN.md).



---

## 조사 1

# 6단계 인벤토리: Realtime 채널과 Supabase에 기대는 화면 상태

## 0. 핵심 요약

- **Realtime 구독 지점은 두 곳뿐이고 둘 다 legacy 경로에만 있다.**
  - `use-toybox-feed.ts:97-137`
  - `use-community-stories.ts:176-192`
  - api 경로에서는 이미 채널을 열지 않는다. 브라우저 쪽 supabase-js 구독은 이 밖에 `use-auth.ts:116-121`의 `onAuthStateChange` 하나가 더 있다. 이것은 Realtime이 아니라 로컬/BroadcastChannel이다(SURFACE_MAP:243).
  - CSP의 `wss://*.supabase.co`는 이 두 채널만을 위한 항목이다.
- **6단계 순서상 가장 위험한 점**: `supabaseEnabled` 검사 가운데 다수가 api 분기보다 먼저 실행된다(아래 4-C).
  - `NEXT_PUBLIC_SUPABASE_URL`이나 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 빌드에서 먼저 빼면 api 경로까지 멈춘다. toybox 피드와 상세는 "데이터베이스가 응답하지 않습니다"가 되고, 쓰기는 아무 일도 하지 않는다.
  - `useAuth.ensureUser`가 null을 돌려주므로 모든 작성이 실패한다.
  - 패치 정적 클라이언트의 댓글 칸도 전부 unavailable이 된다.
  - 따라서 검사(gate)를 먼저 걷어내고 env를 그다음에 빼야 한다.
- **`supabaseEnv`(`NEXT_PUBLIC_SUPABASE_ENV`)는 Supabase 쿼리 밖에서도 쓰인다**(5절).
  - api 응답의 env 대조, localStorage/sessionStorage 키, 패치 클라이언트 config가 여기에 기댄다.
  - `src/lib/supabase.ts`를 지울 때 이 값은 별도 상수로 옮겨 남겨야 한다.

---

## 1. Realtime 채널

| 위치 | 하는 일 | 경로 조건 | 부작용 |
|---|---|---|---|
| `src/hooks/use-toybox-feed.ts:97-137` | `supabase.channel(`${table}_feed`)`이 UPDATE(104-115)와 DELETE(116-127)의 `postgres_changes`를 받는다. `env !== supabaseEnv`이면 무시한다(109). 정리는 `removeChannel`(135)이 한다. | `if (!supabaseEnabled \|\| toyboxViaApi()) return;`(100). deps가 `[table]`뿐이라(137) 플래그가 마운트 뒤에 바뀌어도 다시 판정하지 않는다. | `.subscribe((status) => …)`(128-132)에서 `CHANNEL_ERROR`나 `TIMED_OUT`이 오면 `setUnavailable(true)`가 된다. 이미 받은 피드가 `StorageUnavailableNotice`로 덮인다(tasks/010 #42, SURFACE_MAP:334). |
| 위 훅을 쓰는 곳(table 값) | `use-chemical-posts.ts:101-103`(`chemical_posts`), `use-combo-posts.ts:178-180`(`combo_posts`), `use-this-or-that-posts.ts:125-127`(`this_or_that_posts`), `use-transfigure-posts.ts:456-458`(`transfigure_posts`), `use-decisions-decisions-posts.ts:149-151`(`decisions_decisions_posts`, `src/lib/decisions-decisions.ts:38`), `use-favorite-tournament-posts.ts:108-110`(`favorite_tournament_posts`, `src/lib/favorite-tournament.ts:20`) | 같음 | 이 표들은 publication에 없다. 이벤트는 0건이었다. |
| `src/hooks/use-community-stories.ts:176-192` | `supabase.channel("community_stories")`이 INSERT를 받는다. env와 source로 걸러 앞에 붙인다(186-189). 채널 변수는 147, 정리는 `removeChannel`(212)이 한다. | legacy 경로 함수 `loadLegacy`(159-193) 안에서만 열린다. api 경로(140-144 판정, 195-205)는 채널이 없다. api가 legacy 신호를 주고 `supabaseEnabled`이면 legacy로 가서 채널을 연다(204). | 이벤트 0건이다. unavailable로 덮는 처리는 없다. 이 훅을 쓰는 곳: `story-feed.tsx:1021`, `byrdispatch-story-composer-button.tsx:26`, `patches/patch-note-with-story-actions.tsx:301`, `patches/patch-rich-comments-client.tsx:60`(정적 번들), `patches/resource-patch-index-explorer.tsx:705` |
| `src/hooks/use-auth.ts:116-121, 125` | `supabase.auth.onAuthStateChange` 구독과 해제 | 항상 실행된다(`supabaseEnabled`일 때만, 86) | Realtime은 아니다. supabase-js를 지우면 같이 사라진다. 신원 영역. |
| `workers/security-headers.ts:21` / `public/_headers:6` | `connect-src 'self' https://*.supabase.co wss://*.supabase.co …` | 두 정의는 같아야 한다. `scripts/security-headers.spec.ts`가 `cf:assets`(package.json:14)와 `patch:build`(package.json:31)에서 이를 확인한다. | 위 두 채널이 없어지면 `wss:`가 필요 없다. 브라우저의 legacy REST가 없어지면 `https:`도 필요 없다. 19-20행 주석도 함께 고쳐야 한다. |
| `scripts/check-cloudflare-worker-size.mjs:73` | main Worker 번들에 `realtime-js`, `@supabase/`, `GoTrueClient`가 있으면 실패시킨다. | 빌드 검사 | 6단계 뒤에도 유지하면 되는 가드다. |

문서 쪽 메모:
- `docs/supabase-exit/SURFACE_MAP.md:464`가 가리키는 `use-community-stories.ts:163-179`는 현재 176-192로 밀렸다.
- `CLEANUP_AUDIT.md:123,174`는 "legacy Realtime 채널 두 개를 지우려면 결정이 필요하다"는 상태로 남아 있다.
- 6단계에서 legacy를 지우면 결정 사항(STEP1_DESIGN 14, 계획 5.4 "대체 없음")에 따라 채널이 함께 사라진다. polling을 새로 두지는 않는다.

---

## 2. Supabase 상태에 묶인 "응답 없음" 화면

### 2.1 안내 컴포넌트와 문구
- `src/components/storage-unavailable-notice.tsx:7-47`: 순수 표시 컴포넌트다. Supabase 의존은 없다. `src/components/storage-reload-button.tsx:9-30`도 같다.
- 문구 "데이터베이스가 응답하지 않습니다"(`src/messages/service.ts`)
  - 261, 339, 352, 484, 563, 662, 707, 777, 795, 827, 912, 1515행
  - 패치 정적 클라이언트: `patch-comments-client.js:47`, 영문은 66
  - Supabase를 직접 말하는 문구는 아니므로 D1 뒤에도 쓸 수 있다.
- **env가 없다는 것을 직접 말하는 문구**: `story-composer-modal.tsx:41`("데이터베이스 설정이 없어 작성할 수 없습니다"), 영문은 56(`storageDisabled`)

### 2.2 `unavailable`을 켜는 원인 가운데 Supabase에만 해당하는 것

| 원인 | 위치 | 6단계 뒤 |
|---|---|---|
| Realtime join 실패 | `use-toybox-feed.ts:128-132` | legacy와 함께 사라진다 |
| supabase-js 인증 확인 실패 또는 8초 초과(`auth.getSession`) | `use-auth.ts:46-50, 78-81, 90-111` → `unavailable` | 소비처 4곳(아래)이 "응답 없음"을 보인다. 쿠키 신원으로 바꾸려면 신원 영역 작업이 필요하다. |
| 빌드 env 없음 → 초기 `unavailable = !supabaseEnabled` | 4-B 표 | 검사를 지울 때 초기값을 `false`(또는 loading)로 바꿔야 한다 |
| 패치 정적 config에 URL이나 key가 없음 | `patch-comments-client.js:84` → 1234-1238 | 6단계에서 config의 URL과 key를 빼면 모든 댓글 칸이 unavailable이 된다(2.3) |

`useAuth().unavailable`을 받아 안내를 보이는 곳:
- `src/app/(main)/contact/contact-page.tsx:56, 65, 153-154`
- `src/components/profile-activity.tsx:121, 199-200, 333-334`
- `src/components/this-or-that/post-view.tsx:55, 122, 176, 253`
- `src/components/this-or-that/this-or-that-client.tsx:45, 114, 174-175, 210-216`

### 2.3 패치 정적 클라이언트 `src/components/patches/patch-comments-client.js`
- **config 생성**: `scripts/build-patch-worker.tsx:654-658`이 `<script id="sts-patch-comments-config">`에 `supabaseUrl`, `supabaseAnonKey`, `supabaseEnv`를 빌드 env에서 넣는다.
- **config 읽기**: `readConfig()`(78-89)는 URL이나 key가 없으면 `null`을 돌려준다(84).
- **`null`일 때 api 경로까지 막히는 지점**:
  - `1234-1238`: 모든 페이지 댓글 칸에 `renderUnavailable`(791-815)을 그리고, `bindReelReactions(null)`을 부른 뒤 `return`한다. 그래서 `mountRoot`와 `refreshLiveReels`(api reel 포함)가 실행되지 않는다.
  - `653`: 이야기 작성에서 api 분기(654)보다 앞에서 `throw new Error("Missing database config")`가 난다.
  - `2014`: `bindReelReactions`가 `!config`이면 api 반응 쓰기(2025-)보다 앞에서 return한다.
  - `1660-1667`: courier의 legacy는 config에 기대고, api 경로(1668-1672)는 config 없이 동작한다.
- **config를 데이터 env로 쓰는 곳**: `configEnv`(1621-1628)가 nav 스냅샷 env 대조에 쓰인다. `config.supabaseEnv`는 532, 719, 1097, 1661, 1913, 1968, 2069, 2076(모두 legacy REST)에 나온다.
- **신원 키**: `authStorageKey(config)`(389-391)는 `config.supabaseUrl`로 `sb-<ref>-auth-token`을 만든다. 쿠키 claim(`ensureClaimed` 1472-1480, `cookieSession` 1483-1486)도 이것을 쓴다. `src/lib/api-identity.ts:55-69`에는 키를 훑어 찾는 대체 경로가 있지만 패치 클라이언트에는 없다. 그래서 URL을 빼면 claim에 보낼 토큰을 찾지 못한다(신원 영역과 겹침).

### 2.4 QA와 테스트가 기대하는 legacy "응답 없음"
- `scripts/cloudflare-testbed.spec.ts:81-85`의 `blockSupabase()`
  - `*.supabase.co`를 막는다.
  - `slseoun_qa=no-supabase` 쿠키로 모든 그룹을 legacy로 보낸다(`workers/api/flag-cookie.ts:60-72, 89`, `src/lib/api-surfaces.ts:45-47`).
- 이 헬퍼에 기대는 테스트:
  - 398-406: "Supabase failure uses the shared unavailable state", `/c-c-c-combo/<MISSING_UUID>`
  - 408-: History Course IndexedDB 테스트
- legacy를 지우면 이 쿠키는 의미가 바뀐다. 모든 그룹이 legacy인데 legacy 코드가 없는 상태가 되므로 테스트를 다시 정의해야 한다.

---

## 3. 렌더 중의 `supabaseEnabled` 검사 (STEP1_DESIGN 7: 빌드 상수로 남겨 둔 것)

화면이 env 유무에 따라 다르게 그려지는 곳이다.

| 파일:행 | 렌더 결과 |
|---|---|
| `src/app/(main)/contact/contact-page.tsx:20, 65, 67-73, 153-154` | env가 없으면 폼 대신 `StorageUnavailableNotice`가 나오고 제출이 비활성화된다 |
| `src/components/story-composer-modal.tsx:18, 171, 225, 236, 329-349` | 제출, textarea, 닉네임 입력이 비활성화되고 `storageDisabled` 경고 띠가 나온다(role=alert, data-tone=error) |
| `src/components/history-course/donation-panel.tsx:13, 73` | 패널 전체가 `return null` |
| `src/components/history-course/history-course-run-index.tsx:51, 469, 509-512` | `RandomPickCard`가 숨고 로컬 카드의 `onShare`가 undefined가 된다(공유 버튼 없음) |
| `src/components/history-course/run-upload-zone.tsx:15, 336` | "업로드 때 공유" 체크박스가 숨는다 |
| `src/components/profile-activity.tsx:30, 163, 199-200` | `inquiriesUnavailable`이 되어 문의 칸에 안내가 나온다 |
| `src/app/(main)/dev/admin/admin-dev-page.tsx:573, 879-884` | 서버 dev 전용(`DEV_TOOLS_BUILD`, `page.tsx` 20행). snapshot이 null이 되어 "Supabase 연결 없음"이 나온다 |

---

## 4. 효과와 처리기 안의 `supabaseEnabled` 분류

### 4-A. 렌더에 보이는 훅 초기값과 파생 반환값
env가 없으면 첫 화면이 바로 "응답 없음"이거나 loading이 꺼진 상태로 시작한다.

- `use-auth.ts:38` `ready = !supabaseEnabled`
- `use-toybox-feed.ts:51` loading, `:54` `unavailable = !supabaseEnabled`
- `use-combo-posts.ts:222-223`
- `use-decisions-decisions-posts.ts:175-176`
- `use-favorite-tournament-posts.ts:131, 185-186`
- `use-pagestorm-posts.ts:367-368, 423-424`, `:309` (반환 `loading`)
- `use-this-or-that-posts.ts:168-169`
- `use-transfigure-posts.ts:500-501`
- `use-this-or-that-likes.ts:39-40`
- `use-this-or-that-votes.ts:49`, `:54` (렌더 중 `loading`)
- `use-defragment-feed.ts:35, 38`
- `use-profile-activity.ts:147-148`
- `use-comments.ts:60`
- `use-community-stories.ts:134`
- `use-colorful-philosopher-posts.ts:41, 148`
- `use-likes.ts:67`, `:77` (렌더 중 `userStatusLoading`)
- `use-resource-reactions.ts:123`
- `use-engagement-counts.ts:91` (반환 `loading`)
- `use-history-course-engagement.ts:121` (반환 `ready = !supabaseEnabled || …`)
- 컴포넌트 안: `defragment/defragment-post-view.tsx:56-57`, `chemicalx/post-view.tsx:51`

### 4-B. api 분기보다 먼저 실행되는 검사 (env를 빼면 api 경로도 멈춤)

| 그룹 | 위치 |
|---|---|
| 신원 | `use-auth.ts:42` (`ensureUser` → null), `:86` (세션 효과 없음) |
| toybox-feed 목록 | `use-toybox-feed.ts:61, 140`, `src/lib/toybox-feed.ts:266`, `src/lib/defragment-feed.ts:251`, `use-defragment-feed.ts:43-50, 84` |
| toybox-feed 상세 | `use-combo-posts.ts:226`, `use-decisions-decisions-posts.ts:179`, `use-favorite-tournament-posts.ts:134, 141, 189, 201`, `use-pagestorm-posts.ts:263, 317, 371, 427`, `use-this-or-that-posts.ts:172, 180`, `use-transfigure-posts.ts:504`, `chemicalx/post-view.tsx:58`, `defragment/defragment-post-view.tsx:70`, `use-defragment-posts.ts:159`, `use-defragment-bodies.ts:81`, `use-pagestorm-toybox.ts:63`, `use-this-or-that-likes.ts:45, 63`, `use-this-or-that-votes.ts:65, 83` |
| toybox-feed 쓰기 | `use-combo-posts.ts:62, 287`, `use-decisions-decisions-posts.ts:49, 227`, `use-favorite-tournament-posts.ts:54, 252, 285`, `use-pagestorm-posts.ts:51, 235, 481`, `use-this-or-that-posts.ts:61, 215`, `use-transfigure-posts.ts:328, 564`, `use-chemical-posts.ts:39`, `chemicalx/post-view.tsx:91`, `use-defragment-posts.ts:78, 133`, `use-defragment-bodies.ts:112`, `use-this-or-that-likes.ts:128`, `use-this-or-that-votes.ts:171, 225` |
| comments | `use-comments.ts:126` (add), `:211` (remove), `use-comment-likes.ts:137` (toggle), `use-likes.ts:140` (내 좋아요 효과), `:171` (toggle) |
| stories | `use-community-stories.ts:226` (add), `:307` (remove) |
| colorful-philosophers | `use-resource-reactions.ts:193` (내 반응 효과) |
| contact / profile | `src/lib/contact-inquiries.ts:72, 135, 166, 198`, `use-profile-activity.ts:153-157, 191-196, 225`, `profile-activity.tsx:143` |
| puzzlebox | `use-puzzlebox-scores.ts:131` (submit), `:279` (standings) |
| history-runs | `src/lib/run-donation.ts:270, 325, 403, 418, 464, 502, 541, 569, 602, 626, 649, 668, 680`, `history-course-run-index.tsx:156-160, 183, 299` (`localCoverSaveAttemptsRemoteSync(supabaseEnabled)`, `src/lib/history-course-share-state.ts:41`), `:371`, `run-upload-zone.tsx:147`, `combo/combo-history-run-picker.tsx:141-144` |

### 4-C. 이미 api를 먼저 보거나 `!supabaseEnabled && !viaApi`로 건너뛰는 검사 (STEP1 규칙대로)
- `use-community-stories.ts:145, 204`
- `use-colorful-philosopher-posts.ts:50, 74, 155, 175`
- `use-engagement-counts.ts:28, 78`
- `use-history-course-engagement.ts:45, 108`
- `use-resource-reactions.ts:136, 177`
- `use-puzzlebox-scores.ts:198, 236`
- `comment-courier.tsx:275`
- `use-comments.ts:99, 111` (api 분기가 먼저)
- `use-likes.ts:119, 131`
- `colorful-philosophers/resource-thread.tsx:89, 91`
- `use-profile-character-nicknames.ts:27` (api 뒤)

### 4-D. legacy에만 있는 브라우저 Supabase 읽기 (api 짝 없음)
- `comment-courier.tsx:160` (`legacyCourierRows`)
- `src/lib/nav-seen.ts:296, 315` (legacy unread)
- `use-comment-likes.ts:57, 74`
- `use-colorful-philosopher-posts.ts:126` (다음 주 예약 확인, env를 production으로 고정)
- `use-colorful-philosopher-posts.ts:225` (댓글 수; api 응답에 `known`이 있으면 건너뜀)
- `use-resource-reactions.ts:50` (`fetchResourceReactionCounts`)
- `patches/backstab-colorful-philosophers-section.tsx:165-191`: reel 새로 고침. env가 없으면 빌드 시점 posts가 남는다.
- `patches/backstab-transfigure-section.tsx:95-99, 102-124`: env가 없으면 `BUILTIN_SAMPLE_TRANSFIGURES`가 나온다.

---

## 5. 클라이언트 코드의 `NEXT_PUBLIC_SUPABASE_*` 읽기

| 위치 | 내용 | 6단계 메모 |
|---|---|---|
| `src/lib/supabase.ts:3-4, 6, 8, 20-22` | URL, KEY, `supabaseEnabled`, `supabaseEnv`, `createClient`. env가 없으면 `supabase`는 `null as unknown as SupabaseClient`다. | 파일을 지우면 `supabaseEnv`를 대신할 데이터 env 상수가 필요하다 |
| `src/lib/api-identity.ts:56` | `NEXT_PUBLIC_SUPABASE_URL`로 `sb-<ref>-auth-token` 키를 만든다. 없으면 키를 훑어 찾는다(64-67). | 7단계까지 토큰 claim에 필요하다 |
| `scripts/build-patch-worker.tsx:654-658` (config JSON), `:689-697` (esbuild define: `patch-rich-comments.js` 700-709, `patch-nav-indicators.js` 711-721, `resource-patch-index.js` 733-743) | 정적 패치 번들에 URL, KEY, ENV를 굽는다. rich와 nav 번들은 `supabase.ts`를 거쳐 supabase-js(realtime 포함)를 품는다. | 2.3절 참고 |
| `supabaseEnv`를 쿼리 밖에서 쓰는 곳 | `src/lib/nav-snapshot.ts:4, 50` (api 스냅샷 env 대조), `src/lib/nav-seen.ts:94-104, 257` (저장 키), `src/hooks/use-mailbox-reply.ts:6, 14`, `use-puzzlebox-scores.ts:101, 204, 281` (캐시 키), `use-colorful-philosopher-posts.ts:37, 49` (api 판정), `src/lib/run-donation.ts:57-58, 89-93`, `use-defragment-posts.ts:39`, `use-defragment-bodies.ts:65`, `src/app/(main)/dev/colorful-philosophers/colorful-philosophers-dev-page.tsx:127`, `src/app/(main)/dev/nav-indicators/nav-indicators-dev-page.tsx:71` | 쓰기 본문의 `env`(`src/lib/toybox-api.ts:86, 184` 주석의 "row carries … env")도 클라이언트 값이다(STEP1 9.8 예외) |
| CI | `.github/workflows/cloudflare-workers.yml:29-31` (env 주입), `:156-158` (URL, KEY가 비어 있지 않고 ENV가 production인지 확인. `supabaseEnabled`가 늘 true인 근거) | env를 빼는 커밋은 4-B 정리 뒤에 와야 한다 |

---

## 6. `src/app`에서 env 유무로 달라지는 것 (3절 밖)

- **상세 OG `generate*Metadata`**: `src/app/c-c-c-combo/[id]/page-content.tsx:43`, `chemical-x/[id]:42`, `defragment/[id]:33`, `defragment/[id]/[postId]:51`, `pagestorm/[id]:33`, `this-or-that/[id]:43`, `transfigure/[id]:43`(→ `src/lib/toybox-post-og-fields.ts:19`), `(main)/history-course/[runId]/page-content.tsx:40`(→ `run-donation.ts:464`)
  - 빌드에서는 `metadataRecordId`(`src/lib/static-detail-shell.ts:11-14`)가 셸 세그먼트에 undefined를 주므로 DB를 읽지 않고 fallback이 쓰인다. 실제 OG는 Worker가 붙인다.
  - 다만 `toybox-post-og-fields.ts`는 supabase-js를 import한다.
- **빌드 시점 읽기**: `src/components/patches/patch-detail-page.tsx:848-849`와 `src/app/(main)/dev/patch-types/patch-types-dev-page.tsx:135-136`이 `src/lib/transfigure-data.ts:7-19, 59-72`와 `src/lib/colorful-philosophers-gallery.ts:21-61`을 부른다. 실패 규칙은 `src/lib/build-supabase-read.ts:17-39`에 있다.
  - env가 없으면 production 빌드는 실패한다. 그 밖의 빌드는 샘플 transfigure나 빈 reel로 대체된다.
  - 이 부분은 "next build / patch:build의 DB 읽기 중단" 영역이다.
- **dev 전용 API**: `src/app/api/dev/history-course-runs/route.ts:33-43`, `[runId]/route.ts:42-50`(503 "Supabase is not configured"), `src/app/api/dev/contact-inbox/route.ts:13-18`, `src/app/(main)/dev/colorful-philosophers/actions.ts:20-27`, `admin-dev-page.tsx:154-167`(secret key 경로, 계획 5.7)

## 7. 인접 영역 (이 목록 범위 밖, 위치만)

- `workers/detail-shell-og.ts:62-67, 196-221`(REST 설정)과 `workers/main-worker.ts:13-18`
- `src/lib/api-session.ts:18-26, 80-89`(`supabase.auth.getSession`, `refreshSession`), `use-puzzlebox-scores.ts:168-180`(`hasSession`)

---

## 조사 2

# 6단계 클라이언트 신원·인증 조사 (refactor/supabase-exit, `cbbd8474`)

읽기 전용으로 조사했다. 파일은 고치지 않았고 커밋, 배포, 플래그 변경도 하지 않았다.

## 0. 요약

- **supabase-js는 모든 Next 페이지에서 로드되고 초기화된다.** `src/lib/supabase.ts:20-22`가 모듈 최상위에서 `createClient`를 부르고, 옵션은 `db.retry`만 준다. 그래서 auth 쪽은 기본값(`persistSession`, `autoRefreshToken`, 키 `sb-<ref>-auth-token`)으로 돈다.
  - 루트 레이아웃 `src/app/layout.tsx:6,8`이 `CommentCourier`를 import하고, 이 파일이 `@/lib/supabase`를 직접 import한다(`comment-courier.tsx:26`).
  - 같은 레이아웃의 `SiteNavbar`는 `use-nav-seen`을 거쳐 `nav-seen.ts:13`에서 `@/lib/supabase`를 import한다.
  - `supabaseEnv` 하나만 import해도 `createClient`가 같이 실행된다. 모듈 최상위 부수효과라 tree-shaking으로 빠지지 않는다.
- **로드 시 토큰 갱신과 삭제가 일어난다.** auth-js 2.118.0 `GoTrueClient.js:4081` `_recoverAndRefresh`가 페이지를 열 때마다 저장된 세션을 읽는다. 만료가 가까우면 `*.supabase.co`에 갱신을 요청하고, 세션이 무효이거나 갱신이 실패하면 localStorage 토큰을 지울 수 있다.
  - 지금 브라우저 쪽에서 계획 5.3("토큰은 7단계까지 지우지 않는다")을 어길 수 있는 것은 supabase-js 자신뿐이다.
- **패치 정적 클라이언트는 supabase-js를 쓰지 않는다.** `patch-comments-client.js`는 `fetch`로 Supabase `auth/v1`과 `rest/v1`에 직접 붙는다. 그래도 패치 번들 셋에는 supabase-js가 들어 있다(기존 빌드 산출물 grep으로 확인).
  - `_patches/patch-rich-comments.js`: `useAuth`를 거쳐 들어온다.
  - `_patches/patch-nav-indicators.js`: `nav-seen`을 거쳐 들어온다.
  - `_patches/resource-patch-index.js`: `resource-patch-index-explorer`의 `useAuth`를 거쳐 들어온다.
- **쿠키 모드에도 토큰 경로로 돌아가는 길이 남아 있다.** `identity.mode=cookie`여도 클라이언트는 아래 경우 supabase-js 토큰 경로로 떨어진다.
  - `slseoun_idm` 신호가 없을 때.
  - claim이 legacy로 답했을 때.
  - claim이 `token_invalid`로 거절됐을 때.
  - Worker가 `token_*`로 답했을 때.
- **Worker의 `me` 읽기는 아직 사용자 토큰이 필요하다.** 열린 질문 `STEP4_WRITE_GATE.md:238`의 내용이다.

## 1. 지금 React 경로가 사용자를 얻는 방법

| 위치 | 하는 일 |
|---|---|
| `src/lib/supabase.ts:3-8` | `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`/`ENV`를 빌드 때 인라인한다. `supabaseEnabled`는 두 값이 다 있는지로 정해진다. |
| `src/lib/supabase.ts:20-22` | 모듈 최상위에서 `createClient`를 부른다. auth 기본값이라 저장, 자동 갱신, 탭 간 BroadcastChannel(`GoTrueClient.js:267-269`)이 켜진다. |
| `src/hooks/use-auth.ts:38` | `ready` 초기값이 `!supabaseEnabled`다. |
| `use-auth.ts:41-83` `ensureUser` | 42: Supabase가 꺼져 있으면 `null`을 돌려준다.<br>46-55: `auth.getSession()`에 세션이 있으면 그 uid를 쓴다. claim하지 않는다.<br>58-65: `identityCookieMode()`이면 `signInThroughWorker()`를 부른다.<br>67-76: 그 밖에는 `auth.signInAnonymously()`로 Supabase에 직접 가입한다. |
| `use-auth.ts:14-34` `signInThroughWorker` | 17: `claimNewIdentity()`, 즉 `POST /api/auth/claim {}`를 보낸다.<br>20: `IdentityLegacyError`이면 `null`을 돌려준다. 그러면 위의 `signInAnonymously`로 넘어간다.<br>22-31: Worker가 준 Supabase 세션을 `auth.setSession`으로 supabase-js에 넘긴다. |
| `use-auth.ts:85-127` 마운트 효과 | 90-111: `getSession`의 uid를 쓰고, 없으면 `cookieModeFallbackUid()`(104)를 쓴다.<br>116-121: `onAuthStateChange`로 탭 간·갱신 이벤트를 구독한다. |
| `src/lib/api-session.ts:18-26` `currentAccessToken` | `auth.getSession()`에서 access token을 꺼낸다. |
| `api-session.ts:28-35` `apiFetchAsUser` | 모든 `/api/me`, `/api/write` 호출의 입구다. 33: 쿠키 모드면 cookie 경로, 아니면 token 경로로 보낸다. |
| `api-session.ts:76-91` `apiFetchWithToken` | Bearer 토큰을 붙여 보낸다. `token_expired`이면 `auth.refreshSession()`(84-85) 뒤 한 번 다시 보낸다. |
| `src/lib/supabase-timeout.ts` | auth 호출 8초 타임아웃이다. supabase-js를 import하지 않는다. |
| `src/lib/api-client.ts:108-109, 136` | `ApiFetchInit.token`이 있으면 `Authorization: Bearer`를 붙인다. |
| `src/hooks/use-puzzlebox-scores.ts:168-179` `hasSession` | `auth.getSession()`을 부른다. 289에서 내 순위 조회 여부를 이것으로 정한다. |
| `use-puzzlebox-scores.ts:215, 223-225` | `currentAccessToken()`이 있으면 `/api/me/puzzlebox/leaderboard`, 없으면 `/api/read/...`를 부른다. |
| `use-puzzlebox-scores.ts:131, 198, 236, 279` | `supabaseEnabled`로 동작을 막는다. |

신원 의존 화면이 `supabaseEnabled`를 "저장소가 켜져 있다"는 뜻으로 쓰는 곳:

- `contact-page.tsx:65`
- `profile-activity.tsx:143,163`
- `story-composer-modal.tsx:171,225,236,329-349`
- `donation-panel.tsx:73`
- `history-course-run-index.tsx:156,183,299,371`
- `run-donation.ts:569,602,626`
- `use-resource-reactions.ts:193`

`useAuth` 소비자는 41개 파일이다(`grep -l hooks/use-auth`). 주로 `userId ?? await ensureUser()`를 쓴다.

## 2. 쿠키 신원(4단계) 구조

### 2.1 클라이언트

| 위치 | 하는 일 |
|---|---|
| `src/lib/identity-cookies.ts` | 상수와 타입이다. import가 없어 Worker, 브라우저, 스크립트가 같이 쓴다.<br>`slseoun_id`: HttpOnly, `Path=/api/`.<br>`slseoun_idm=cookie`: 읽을 수 있는 신호.<br>`/api/auth/claim`.<br>localStorage 표식 `slseoun-identity`.<br>`ClaimResponse{v,uid,created,session}`. |
| `src/lib/api-identity.ts:41-43` | `identityCookieMode()`: `slseoun_idm`을 호출마다 읽는다. |
| `api-identity.ts:53-69` `supabaseAuthKey` | `NEXT_PUBLIC_SUPABASE_URL`(56)에서 `sb-<ref>-auth-token`을 만든다. URL이 없으면 정규식으로 localStorage를 훑는다. |
| `api-identity.ts:82-97` `storedSupabaseIdentity` | supabase-js 없이 localStorage 세션 JSON을 직접 읽는다. `currentSession`, `session`, 맨 객체 형식을 모두 받는다. uid는 `user.id`, 없으면 JWT `sub`(71-79)다. |
| `api-identity.ts:100-130` | `claimedUid()`, `rememberClaim`, `forgetClaim`, `cookieModeFallbackUid()`. 쿠키 모드일 때만 표식 uid를 돌려준다. |
| `api-identity.ts:134-182` `postClaim`/`claimOnce` | 152, 161: 마커 헤더가 없거나 409 `surface_legacy`이면 `IdentityLegacyError`를 던진다.<br>166: claim이 성공하면 표식을 저장한다.<br>페이지당 한 번만 보낸다. |
| `api-identity.ts:187-200` `ensureClaimedIdentity` | 표식이 있고 저장 토큰과 같은 uid면 그대로 쓴다.<br>저장 토큰이 없으면 401(`token_invalid`, force면 `identity_required`)을 던지고, force면 표식을 지운다.<br>새 가입은 하지 않는다. |
| `api-identity.ts:205` `claimNewIdentity` | `claim {}`를 보낸다. |
| `api-session.ts:37-74` `apiFetchWithCookie` | Bearer 없이 보낸다.<br>55, 66: claim이 legacy나 `token_invalid`이면 token 경로로 간다.<br>62-69: `identity_required`이면 강제 재claim 뒤 한 번 다시 보낸다.<br>71: `token_invalid`/`token_expired`이면 token 경로로 간다. |

### 2.2 Worker

| 위치 | 하는 일 |
|---|---|
| `workers/api/router.ts:327` | `/api/auth/claim`을 `handleIdentityClaim`으로 보낸다. |
| `router.ts:269` | `/api/me`와 `/api/write`에서 `resolveRequestIdentity`를 부른다. |
| `router.ts:300` | 핸들러에 `token: token ?? ""`를 넘긴다. 쿠키 모드에 Bearer가 없으면 빈 문자열이다. |
| `identity/claim.ts:134-143` | 아래 경우 409 legacy로 답한다. 플래그 꺼짐·설정 없음(134), QA `no-supabase`(137), `API_IDENTITY_SECRET` 없음(138), `identity.mode`가 cookie가 아님(140). |
| `claim.ts:146` | 클라이언트 IP별 쓰기 예산(분당 30)으로 센다. |
| `claim.ts:155-158` + `99-118` | 토큰 claim이다.<br>ES256 고정 JWKS(`supabase-jwks.ts`)로 검증하고, `API_SUPABASE_LEGACY_JWT_SECRET`이 있으면 HS256도 받는다(112).<br>`ignoreExpiry`(111)로 만료는 무시하지만, `exp + 180일`(`CLAIM_WINDOW_SECONDS`, 36)이 지나면 `token_invalid`다.<br>익명 사용자가 아니면 `forbidden`(116)이다. |
| `claim.ts:161-162` | 유효한 쿠키가 있으면 그 uid를 유지한다(`kept`, `session: null`). |
| `claim.ts:164-167` | 새 사용자는 Worker가 Supabase에 익명 가입한다(`identity/supabase-signup.ts:47-90`, `POST /auth/v1/signup`, 4초). 실패하면 503 `auth_unavailable`이다(2026-11-08 결정). Worker가 uid를 직접 만드는 것은 7단계부터다. |
| `identity/cookie.ts:28, 30, 34` | 쿠키 최대 수명 400일, 발급 7일 뒤 재발급(resolve.ts:95), `slseoun_idm` Max-Age는 1일이다. |
| `identity/mode.ts:28-30, 44, 48` | 플래그 꺼짐, secret 없음, QA `no-supabase`, 플래그 읽기 실패이면 `token`이다. **`identity.mode`에는 env 기본값이 없다.** 쓰기 쪽은 `API_WRITE_MODE_DEFAULT`(`write-flags.ts:25,41`)가 있다. |
| `mode.ts:55-59` + `flag-cookie.ts:124-128` | 페이지 응답의 `slseoun_idm`은 isolate 메모리에 플래그가 있을 때만 붙는다. 차가운 isolate의 첫 페이지에는 붙지 않는다. |
| `identity/resolve.ts:75-80` | token 모드: Bearer를 검증한다. |
| `resolve.ts:86-93` | 쿠키 모드에서 쿠키가 없으면 Bearer를 받아 준다. 옛 탭과 아직 claim하지 않은 탭을 위한 것이다. |
| `resolve.ts:97-104` | Bearer가 쿠키와 같은 uid일 때만 토큰을 넘긴다. |
| `scripts/runtime-flags.ts:13, 53, 67` | `identity.mode token|cookie`를 설정한다. |

## 3. 패치 정적 클라이언트 (`src/components/patches/patch-comments-client.js`)

| 위치 | 하는 일 |
|---|---|
| 78-90 `readConfig` | 84: `supabaseUrl`과 `supabaseAnonKey`가 없으면 `null`이다. 그러면 1234-1238에서 모든 댓글 루트가 "응답 없음"이 된다. 설정은 `scripts/build-patch-worker.tsx:654-657`이 HTML에 굽는다. 번들 define은 690-693이다. |
| 389-409 | `authStorageKey`(`config.supabaseUrl`에서 만듦), `readStoredSession`, `writeStoredSession`. supabase-js와 같은 localStorage 키를 읽고 쓴다. |
| 435-456 `authRequest` | publishable 키로 `<supabase>/auth/v1/*`를 직접 부른다. |
| 463-496 `ensureSession` | 470-484: refresh_token으로 갱신한다.<br>488-495: 익명 가입을 직접 한다. |
| 498-525 `restRequest` | legacy PostgREST 직접 호출이다. |
| 930-955 `loadApiState` | 932: userId는 저장 세션 uid, 없고 쿠키 모드면 표식이다.<br>936-946: 쿠키 모드면 `ensureClaimed` 뒤 `/api/me/engagement`를 Bearer 없이 부른다.<br>947-955: token 모드면 살아 있는 토큰으로 부른다. |
| 1398-1426 | 쿠키 신원 상수와 표식. React와 같은 계약이다. |
| 1429-1464 `claimIdentity` | 1447, 1452: legacy 신호이면 `identityLegacy` 오류를 던진다. |
| 1472-1480 `ensureClaimed` | 1478: 새 사용자 세션을 직접 localStorage에 쓴다. supabase-js가 필요 없다.<br>React와 다른 점: force이고 저장 토큰이 없으면 `claim {}`를 보내 바로 새 uid로 가입한다. React는 `identity_required`를 던진다. |
| 1483-1486, 1494-1526 | `cookieSession`, `tokenPathAfterClaim`, `apiWriteWithCookie`. React의 `api-session`과 같은 token 경로 대체가 있다. |
| 1606-1619 `apiWriteAsUser` | 쿠키 모드가 아니거나 대체가 일어나면 `ensureSession`(1611)과 강제 갱신(1616)을 쓴다. |
| legacy 쓰기의 `ensureSession` | 655/703(이야기), 1087(댓글), 1159(좋아요·삭제), 2061-2066(릴 반응). |

## 4. 모든 그룹이 api이고 identity.mode=cookie일 때 아직 supabase-js나 Supabase를 부르는 것

| 이유 | 위치 | 비고 |
|---|---|---|
| import만으로 초기화와 자동 갱신이 돈다 | `supabase.ts:20-22`, 루트 레이아웃, `nav-seen.ts:13`, `comment-courier.tsx:26` 외 import 52곳 | 모든 페이지에서 `*.supabase.co`에 갱신 요청이 갈 수 있다. |
| `slseoun_idm`이 없는 첫 방문의 새 사용자 | `use-auth.ts:58, 67-76` | 차가운 isolate가 신호를 보내지 않는다(mode.ts:55-59). 그러면 `signInAnonymously`로 직접 가입한다. |
| claim이 legacy로 답할 때 | `use-auth.ts:20`, `api-session.ts:55,66` | 플래그 읽기 실패, QA `no-supabase`, secret 없음일 때 생긴다. |
| claim이 `token_invalid`로 거절될 때 | `api-session.ts:37-39, 55` → 76-91 | `exp`에서 180일이 지났거나, HS256인데 legacy secret이 없을 때다. supabase-js `refreshSession`으로 새 토큰을 받아 다음 호출에서 claim한다. legacy secret이 운영에 들어 있는지는 저장소에서 보이지 않는다. |
| Worker가 `token_invalid`/`token_expired`로 답할 때 | `api-session.ts:71` | token 경로로 다시 보낸다. |
| 새 사용자 세션 넘겨주기 | `use-auth.ts:22-31` (`setSession`) | 패치 클라이언트는 이미 직접 쓴다(1478). |
| 내 순위 판단 | `use-puzzlebox-scores.ts:168-179, 215, 289` | 쿠키만 있는 사용자는 `/api/read`로 가서 `is_me`가 빠지고, 내 순위 조회를 건너뛴다. |
| 마운트 시 uid와 탭 간 동기화 | `use-auth.ts:90-121` | `getSession`과 `onAuthStateChange`를 쓴다. |
| 패치 클라이언트 설정 | `patch-comments-client.js:84` | Supabase 키가 없으면 모두 꺼진다. |

## 5. 사용자 토큰에 기대는 Worker `me` 읽기

`me` 읽기는 아직 Supabase PostgREST를 읽고 `token`을 넘긴다. 쿠키 모드에서 클라이언트는 Bearer를 보내지 않으므로 `token`이 `""`이고, 요청은 anon이 된다. `STEP4_WRITE_GATE.md:98`("me 경로는 이 단계에서 바꾸지 않는다")과 `:238`(열린 질문)에 적혀 있다.

| 라우트 | 위치 | 토큰 의존 |
|---|---|---|
| `me.puzzlebox.leaderboard` | `routes/puzzlebox.ts:29-51, 124-130` | RPC `get_puzzlebox_leaderboard`가 `auth.uid()`로 `is_me`와 `me`를 고른다. |
| `me.puzzlebox.standings` | `puzzlebox.ts:53-67` | RPC `get_my_puzzlebox_standings`, `auth.uid()`. |
| `me.profile.stats`, `me.profile.activity` | `routes/profile.ts:36-48, 50-70` | RPC `get_my_profile_activity_stats`, `get_my_profile_activity`. |
| `me.profile.inquiries`, `me.mailbox` | `profile.ts:76-95`, `routes/contact.ts:14-30` | `contact_inquiries` SELECT가 소유자만 볼 수 있다(`supabase/migrations/20260803223103_contact_inquiry_responses.sql:20-24`). |
| `me.pagestorm.drafts` | `routes/toybox.ts:286-294` | 소유자만 SELECT(`20261011193000_pagestorm_drafts.sql:26-27`). |
| `me.history-runs`, `me.engagement`, `me.this-or-that.likes/votes` | `history-runs.ts:136-150`, `comments.ts:370-…`, `toybox.ts:395-404, 436-445` | `user_id`로 거르고 `token`도 넘긴다. 결과는 각 표의 SELECT 정책에 따라 달라진다. 이 정책들은 확인하지 않았다. |

토큰 없이 쓸 수 있는 대체는 이미 있다. `workers/api/d1-adapters/index.ts:36-70`의 `me.*` 어댑터가 `userId`를 받는다(`rows.ts:15-16`). 다만 지금은 그림자 읽기에서만 쓴다(`shadow/shadow.ts:1, 106, 275`). D1 쓰기 핸들러는 `context.user.userId`를 쓰므로(`d1-write/context.ts:25-43`) 쿠키 신원으로 충분하다.

## 6. 브라우저가 supabase-js를 로드하지 않으려면 6단계에서 바꿀 것

1. **`src/lib/supabase.ts`를 클라이언트 그래프에서 뺀다.**
   - 비-supabase 심볼을 옮긴다: `supabaseEnv`, `supabaseEnabled`, `isCheckViolation`, `supabaseClientOptions`.
   - `supabaseEnv` 값은 그대로 둬야 한다. `nav-seen.ts:94-102, 257`의 localStorage 키에 들어가기 때문이다.
   - `supabaseEnabled` 막기를 "api 사용 가능"으로 바꾼다(1절의 화면 목록).
   - `package.json:87`의 의존성은 dev 관리 화면(`admin-dev-page.tsx`, `dev/colorful-philosophers/actions.ts`, `api/dev/*`, `colorful-philosophers-gallery.ts`, `transfigure-data.ts`)이 쓰는 한 남는다. 클라이언트 번들에서 빠지는지가 기준이다.
2. **`use-auth.ts`를 다시 쓴다.**
   - uid는 `claimedUid()`를 쓰고, 없으면 `storedSupabaseIdentity()?.uid`를 쓴다. 아직 claim하지 않은 기존 사용자도 "내 것" 표시가 유지된다.
   - `ensureUser`는 늘 `claimNewIdentity()`를 부른다. `identityCookieMode()`로 막지 않는다.
   - `signInAnonymously`(67-76), `getSession`, `onAuthStateChange`, `setSession`을 지운다.
   - 새 사용자 세션은 localStorage `sb-<ref>-auth-token`에 직접 쓴다. 패치 클라이언트 1478과 같은 방식이고, `supabaseAuthKey`에 쓰려고 `NEXT_PUBLIC_SUPABASE_URL`(또는 ref)은 남긴다.
   - 탭 간 동기화는 `storage` 이벤트(`slseoun-identity`)로 대신한다.
3. **`api-session.ts`는 쿠키 경로만 남긴다.**
   - `currentAccessToken`(18-26)과 `apiFetchWithToken`(76-91)을 지운다.
   - 55, 66, 71의 token 경로 대체를 오류나 재claim으로 바꾼다.
   - `api-client.ts`의 `token`과 Bearer(108-109, 136)는 쓸 곳이 없어진다.
4. **`api-identity.ts`는 그대로 둔다.** 처음부터 supabase-js 없이 쓰였다(20). `IdentityLegacyError`를 잡던 쪽(`use-auth.ts:20`)은 "응답 없음"으로 바뀐다.
5. **`use-puzzlebox-scores.ts`**: `hasSession`과 `currentAccessToken`을 "uid 있음"으로 바꾼다.
6. **패치 클라이언트**를 고친다.
   - `readConfig`(84)가 Supabase 키를 요구하지 않게 하고, `build-patch-worker.tsx:654-657, 690-693`도 맞춘다.
   - `authRequest`, `ensureSession`, `restRequest`, 1606-1619의 token 대체와 legacy 쓰기들을 지운다.
   - `readStoredSession`, `writeStoredSession`, `claimIdentity`, `ensureClaimed`만 남긴다.
   - 패치 번들 셋(`patch-rich-comments`, `patch-nav-indicators`, `resource-patch-index`)은 1·2번이 끝나면 supabase-js가 빠진다.
7. **Worker 신원 쪽에서 정할 것.** Worker 안의 Supabase 어댑터와 claim의 Supabase 가입은 7단계까지 남긴다.
   - 6단계 클라이언트에는 token 경로가 없다. 그래서 `mode.ts:44, 48`과 `claim.ts:134-143`의 legacy/token 답이 쓰기 장애가 된다. `identity.mode`에 env 기본값(`cookie`)을 두는 것이 계획 7.2절 "안전한 쪽" 원칙에 맞는다.
   - QA `no-supabase` 쿠키(`claim.ts:137`, `router.ts:227`)는 6단계 이후 신원과 api를 통째로 막는다. 정리하거나 바꿔야 한다.
   - `slseoun_idm` 신호(`flag-cookie.ts:122-128`)는 계속 보낸다. 이전 Worker 버전으로 되돌릴 때 옛 클라이언트에 필요하다.
8. **`me` 읽기를 토큰 없이 서비스한다.** 5절의 라우트를 D1 어댑터(읽기 원본 d1)나 service 키 + 소유자 필터로 옮긴다. 이것이 6단계의 선행 조건이다.
9. **CSP**: `workers/security-headers.ts:21`에서 `https://*.supabase.co`와 `wss://*.supabase.co`를 뺀다. 1·2·6번보다 먼저 빼면 남은 supabase-js 초기 갱신과 패치 `ensureSession`이 막힌다.
10. **검사와 spec.**
    - 클라이언트 번들 검사를 새로 둔다. `scripts/check-cloudflare-worker-size.mjs:67-75`의 `GoTrueClient|SupabaseClient|@supabase/` 정규식을 `.next/static`과 `.patch-worker/assets/_patches`에 똑같이 적용하면 된다.
    - `scripts/api-identity-client.spec.ts`는 진짜 supabase-js로 토큰 경로를 본다(35-37). `api-identity-patch-client.spec.ts`와 `api-client.spec.ts`도 고쳐야 한다.

## 7. 고칠 때 알아 둘 것

- **계획 5.3(토큰 보존)**: supabase-js를 걷어내면 저장된 `sb-*-auth-token`을 지우는 코드가 클라이언트에 남지 않는다. 토큰은 저절로 7단계까지 남는다. 7단계 삭제는 `api-identity.ts`/패치 클라이언트와 같은 키 규칙으로 한다.
- **claim 기한**: 지금은 supabase-js가 방문할 때마다 토큰을 갱신하므로 저장 토큰의 `exp`는 "마지막 방문 + 1시간"쯤이다. 6단계 뒤에는 갱신이 없으므로, 아직 claim하지 않은 사용자는 6단계 이전 마지막 방문에서 180일 안에만 claim할 수 있다.
  - 그 뒤나 HS256 거절이면 소유권을 잃고 새 uid가 된다.
  - 막으려면 Worker가 refresh_token으로 갱신하는 길(`supabase-signup.ts`와 같은 방식)이나 legacy secret이 필요하다.
  - claim은 `me`나 `write` 호출에서만 일어나므로, 6단계 전에 쿠키 모드를 켜 둔 기간이 길수록 미리 claim하는 사용자가 늘어난다.
- **되돌리기**
  - 이전 Worker 버전(옛 클라이언트)으로 돌아가도 `identity.mode=cookie`가 유지되면 신원은 이어진다. 세션이 없어도 claim이 유효한 쿠키를 보고 `kept`로 답한다(`claim.ts:161-162`).
  - 6단계 중 가입한 사용자의 Supabase 세션을 localStorage에 넘겨 두는 것은 token 모드로 돌아갈 때만 필요하다.
  - 6단계 클라이언트로는 `identity.mode=token`으로 되돌릴 수 없다.
- **`pnpm dev`(next dev)**: Worker가 없어 `/api/auth/claim`이 없다. 6단계 뒤에는 신원이 동작하지 않으므로 로컬 확인은 `wrangler dev`로 해야 한다.

---

## 조사 3

# 패치 페이지와 따로 묶이는 클라이언트: 6단계 인벤토리

R = `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit`. 표의 경로는 모두 R 기준입니다. 저장소는 읽기만 했습니다. 번들 구성은 esbuild metafile로 확인했고, 그 빌드는 scratchpad(`/private/tmp/claude-502/-Users-flavono123-P-scare-the-spire/05d90378-9b11-4d2c-9b88-1196a51c9c23/scratchpad/patchgraph/`)에서만 돌렸습니다.

## 0. 요약

- 패치 페이지 하나에 스크립트 6개가 실립니다(`build-patch-worker.tsx:654-658`).
  - `patch-nav-indicators.js`, `patch-rich-comments.js`, `resource-patch-index.js`(`/patches/changes`만) 세 번들이 supabase-js 전체를 담고 있습니다. 번들마다 약 217 KB이고, realtime-js·auth-js·postgrest-js까지 들어 있습니다.
  - nav-indicators 번들은 292 KB 중 217 KB가 supabase-js입니다.
  - `patch-global-search.js`, `patch-static-card-preview.js`, `patch-static-spine.js`에는 Supabase가 없습니다.
- 묶지 않고 복사되는 `patch-comments.js`(= `src/components/patches/patch-comments-client.js`)는 Supabase REST와 Auth를 `fetch`로 직접 부릅니다. Realtime은 쓰지 않습니다.
- `patch:build`가 DB를 읽는 곳은 하나입니다. 셸 패치(type `wither`/`gambit`)를 그릴 때 `patch-detail-page.tsx:844-850`가 `transfigure_posts`, `colorful_philosopher_posts`, `resource_reaction_counts`를 읽습니다. 이 코드는 `next build`도 함께 탑니다.
- 패치 Worker(`workers/patch-worker.ts`)와 `scripts/copy-patch-worker-assets.mjs`는 Supabase를 쓰지 않습니다. CSP를 붙이는 일만 합니다.
- **함정 1**: 번들 안의 공용 훅은 api 경로에서도 빌드 상수 `supabaseEnabled`로 쓰기와 신원을 막습니다. esbuild define(`build-patch-worker.tsx:691-692`)만 먼저 지우면 패치 페이지의 댓글·좋아요·이야기 쓰기가 조용히 꺼집니다.
- **함정 2**: 정적 클라이언트는 설정 JSON에 `supabaseUrl`과 `supabaseAnonKey`가 없으면 모든 댓글을 "응답 없음"으로 그립니다(`patch-comments-client.js:84`, `:1233-1238`).

## 1. 패치 페이지가 서빙되고 플래그를 받는 길

| 단계 | 위치 | 하는 일 |
|---|---|---|
| 라우팅 | `workers/main-worker.ts:57-67`, `:480-481` | `/patches*`, `/_patches/*`, `/<locale>/patches*`, `/images/neowsletters/*`를 `env.PATCH_WORKER.fetch`로 넘깁니다. |
| 응답 감싸기 | `workers/main-worker.ts:525-529` | 패치 응답에도 `withSecurityHeaders`를 붙이고, 이어서 `withFlagCookie`를 붙입니다. |
| 플래그 쿠키 | `workers/api/flag-cookie.ts:142-162` | 페이지 요청(`isPageRequest`, `:52-58`)에 `slseoun_rf=v1.<groups>`와 `slseoun_idm=cookie`(신원 모드)를 `Set-Cookie`로 붙입니다. `/_patches/*.js`처럼 확장자가 있는 파일 경로(`:38-46`)에는 붙이지 않습니다. |
| 쿠키를 못 받는 경우 | `wrangler.patch.jsonc`(routes·`workers_dev` 지정 없음, testbed는 `workers_dev: true`), `pnpm dev`의 `scripts/dev-patch-proxy.mjs:299-311,354`, `pnpm patch:dev`(`package.json:24`, 패치 Worker만 `wrangler dev`) | 패치 Worker를 자기 호스트로 직접 열거나 로컬 dev로 열면 쿠키와 `/api` 라우터가 둘 다 없어서 지금은 legacy로 갑니다. 운영 패치 Worker의 workers.dev 노출 여부는 Cloudflare에서 확인하지 않았습니다. |
| 정적 클라이언트의 플래그 읽기 | `patch-comments-client.js:1381-1396` | `document.cookie`에서 `slseoun_rf`를 따로 파싱합니다. `v1`이면서 그룹이 들어 있으면 api입니다. `runtime-flags.ts`와 달리 모르는 그룹이 섞여도 쿠키 전체를 버리지 않습니다. 내린 그룹은 `window.__slseounRuntime.demoted`에 둡니다. |
| 정적 클라이언트의 신원 모드 읽기 | `patch-comments-client.js:1401-1409` | `slseoun_idm=cookie` 여부를 봅니다. |
| 번들의 플래그 읽기 | `src/lib/runtime-flags.ts:31-55` → `src/lib/api-surfaces.ts` `parseFlagCookieValue` | 같은 쿠키와 같은 `window.__slseounRuntime`을 씁니다. 네비 스냅샷 promise(`runtime.nav`)를 정적 클라이언트와 번들이 함께 씁니다(`patch-comments-client.js:1630-1656`, `src/lib/nav-snapshot.ts:45-58`). |
| 번들의 신원 모드 읽기 | `src/lib/api-identity.ts:41-43` | `slseoun_idm`을 읽습니다. |

## 2. 빌드: `scripts/build-patch-worker.tsx`, `package.json`, CI

| 위치 | 하는 일 | 6단계 |
|---|---|---|
| `build-patch-worker.tsx:1-2` | `load-build-env`를 맨 처음 import합니다. 주석은 `src/lib/supabase.ts`가 import될 때 env를 읽기 때문이라고 설명합니다. | 사이트 origin, 분석 토큰, manifest env 때문에 load는 계속 필요합니다. 주석만 바뀝니다. |
| `:654-658` | 모든 패치 HTML과 404 페이지(`:754-782`)의 body에 `<script id="sts-patch-comments-config">{supabaseUrl, supabaseAnonKey, supabaseEnv}</script>`를 굽습니다. anon 키가 모든 패치 HTML에 공개됩니다. 이어서 스크립트 6개 태그를 붙입니다. | URL과 키를 뺍니다. 데이터 env 값(`production`/`development`)은 네비 env 검사(4절)에 아직 쓰므로 Supabase와 무관한 이름으로 남길지 정해야 합니다. |
| `:665-675` | `patch-comments-client.js`, `patch-static-spine-client.js`, spine-player를 묶지 않고 복사합니다. | — |
| `:677-685`, `:723-731` | static-card-preview와 global-search를 IIFE로 묶습니다. define이 없고 Supabase도 없습니다. | 바꿀 것 없음 |
| `:687-697` | `patchClientEnvDefines`: `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`/`_ENV`(그리고 SITE 값)를 정의합니다. | URL/KEY define은 번들 안에서 `supabaseEnabled` 참조가 모두 없어진 뒤에 지웁니다. ENV는 네비 저장 키 접미사로 계속 쓰입니다(4절). |
| `:699-709`, `:711-721`, `:733-743` | rich-comments, nav-indicators, resource-patch-index 번들(위 define을 씀) | 4절 |
| `:913-954` | 패치마다 `PatchDetailPage`를 그립니다. 셸 패치면 DB를 읽습니다(5절). | 5절 |
| `package.json:23` | `cf:patch:deploy`가 `NEXT_PUBLIC_SUPABASE_ENV=production`를 넣습니다. | 데이터 env 이름을 정리할 때 함께 바꿉니다. |
| `package.json:31` | `patch:build`가 마지막에 `security-headers.spec.ts .patch-worker/assets`를 돌립니다. | 6절 |
| `package.json:87` | `@supabase/supabase-js` 의존성 | 패치 클라이언트가 안 쓰게 된 뒤에도 Worker 어댑터와 스크립트가 쓰는지는 다른 영역에서 확인해야 합니다. |
| `.github/workflows/cloudflare-workers.yml:29-32`, `:156-158` | `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/ENV`, `ALLOW_BUILD_WITHOUT_SUPABASE`를 검증합니다. | main Worker API 변수(`:287-288`)가 7단계까지 이 값을 쓰므로 검증은 남깁니다. 패치 빌드에서 쓰는 곳만 없어집니다. |

## 3. `src/components/patches/patch-comments-client.js` (묶지 않음, 모든 패치·404 페이지에서 `main()` 실행)

공용 Supabase 헬퍼:

| 줄 | 함수 | Supabase 사용 |
|---|---|---|
| 78-89 | `readConfig` | `supabaseUrl`이나 `supabaseAnonKey`가 없으면 null을 돌려줍니다. 그러면 `main()`이 페이지의 모든 댓글 루트를 unavailable로 그리고 반응 버튼을 끕니다(`:1233-1238`, `:2014`). |
| 389-409 | `authStorageKey` / `readStoredSession` / `writeStoredSession` | localStorage `sb-<ref>-auth-token`. ref를 `config.supabaseUrl`에서 뽑으며, 따로 찾는 fallback이 없습니다. |
| 435-457 | `authRequest` | `POST {supabaseUrl}/auth/v1/{path}`를 anon 키로 보냅니다. |
| 463-496 | `ensureSession` | `token?grant_type=refresh_token`로 갱신하고, 실패하면 `signup`으로 익명 가입합니다. 브라우저가 Supabase Auth를 직접 부릅니다. |
| 498-526 | `restRequest` | `{supabaseUrl}/rest/v1/{path}` |
| 528-545 | `commentsPath`, `commentLikesPath` | legacy 쿼리 문자열을 만듭니다. |

화면별 legacy 경로와 api 대응:

| 줄 | 기능 | legacy (Supabase 직접) | api 경로 (지금 있음) | 그룹 |
|---|---|---|---|---|
| 640-730 (`openStoryComposer`) | 패치 줄 이야기 작성(rich 번들이 실패했을 때만 보임) | 703-722: REST `POST community_stories`, `ensureSession` 토큰 | 675-702: `apiWriteAsUser` `POST /api/write/stories`. `:653`에서 config가 없으면 throw | stories |
| 913-965 (`loadApiState`) | 댓글 목록과 내 좋아요 | — | `GET /api/read/engagement?threads=`, `GET /api/me/engagement`. 쿠키 모드는 `ensureClaimed` 뒤(936-946), 토큰 모드는 살아 있는 Supabase 토큰을 Bearer로(947-955) | comments |
| 967-1003 (`loadState`) | 댓글 목록 legacy | REST `comments`, `comment_likes` 합계, 내 좋아요(토큰) | 968-971에서 api 먼저 | comments |
| 1021-1105 (submit) | 댓글 작성 | 1087-1101: REST `POST comments` | 1053-1086: `POST /api/write/comments` | comments |
| 1107-1195 (click) | 좋아요, 삭제 | 1159-1191: REST `comment_likes` POST/DELETE, `comments` DELETE | 1113-1158: `PUT`/`DELETE /api/write/comment-likes?id=`, `DELETE /api/write/comments?id=` | comments |
| 1659-1673 (`courierItems`) | 배달부(최신 댓글 12개, 모든 패치 페이지) | 1660-1667: REST `comments?select=id,story_id,content,created_at…limit=12` | 1668-1672: `/api/read/nav` 스냅샷의 `courier` | nav |
| 1630-1656 (`loadNavSnapshot`) | 네비 스냅샷(번들과 공유) | — | `GET /api/read/nav`. `body.env !== configEnv(config)`이면 legacy(1651). `configEnv`(1621-1628)는 설정 JSON의 `supabaseEnv`를 읽습니다. | nav |
| 1895-1943 (`refreshReelWeek`) | 셸 패치 철학자 릴의 이번 주 | 1910-1915: REST `colorful_philosopher_posts` | 1900-1908: `GET /api/read/colorful-philosophers/reel` (D1 어댑터 `workers/api/d1-adapters/index.ts:41`) | colorful-philosophers |
| 1945-1978 (`refreshReelCounts`) | 릴 반응 합계 | 1966-1976: REST `resource_reaction_counts` | 1951-1965: `GET /api/read/engagement?reactions=`. 대상 전부가 api 규칙을 통과할 때만 | comments |
| 2020-2094 (`applyStaticReaction`) | 릴 버프·너프·재작업 반응 | 2061-2080: `ensureSession` 뒤 REST `resource_reactions` DELETE/PATCH/POST | 2031-2060: `PUT /api/write/reactions` | comments |

api 공용 기능:

| 줄 | 함수 | 하는 일 | 6단계 |
|---|---|---|---|
| 1546-1600 | `apiRequest` / `apiRequestOnce` | 같은 출처 요청입니다. 표식 헤더(`x-slseoun-api`)가 없거나 409 `surface_legacy`면 그룹을 내리고 `legacy` 오류를 던집니다. `write_paused` 503은 다시 보냅니다. | legacy가 없어지면 이 신호들은 그냥 "응답 없음"이 됩니다. |
| 1606-1619 | `apiWriteAsUser` | 쿠키 모드(1503-1526)를 먼저 해 봅니다. 실패하면 토큰 경로로 가서 `ensureSession`을 부르는데, api 경로인데도 브라우저가 Supabase Auth를 직접 부릅니다. | 쿠키 전용으로 바꿉니다. |
| 1428-1480 | `claimIdentity` / `ensureClaimed` | `POST /api/auth/claim`에 저장된 Supabase 토큰을 보냅니다. Worker가 새로 가입시킨 세션은 `sb-<ref>-auth-token`에 써 둡니다(1478). | 계획 5.3대로 7단계까지 이 토큰을 읽고 써야 합니다. 그래서 ref를 URL 없이 구해야 합니다(`src/lib/api-identity.ts:54-69`의 상수나 scan 방식). |
| 1494-1496, 1508, 1518, 1523 | `tokenPathAfterClaim` | claim 거절(`token_invalid`: 180일 기한 초과나 HS256)이나 `token_expired`면 토큰 경로로 갑니다. | 토큰 경로가 없어지면 대체 행동을 정해야 합니다(7절). |
| 1528-1539 | `commentsViaApi` / `reactionsViaApi` | `THREAD_KEY`와 `REACTION_PART` 규칙에 맞지 않는 키는 legacy에 남깁니다. | 규칙 밖 키가 실제로 생기는지 확인해야 합니다. |

- Realtime: 이 파일에는 없습니다.
- 정적 클라이언트와 rich 번들의 관계: rich 번들이 댓글 루트에 `data-rich-comment-mounted`를 먼저 찍으므로(`patch-rich-comments-client.tsx:197`), 정적 클라이언트의 댓글 렌더(1228-1242)는 rich 번들이 실패했을 때만 돕니다.
- 정적 클라이언트가 늘 직접 도는 것: 배달부(1233), 릴(1244-1259), 반응(2006-2094), 프로필 아이콘(1204-1213), 이야기 버튼 클릭(736-745). 이야기 버튼은 rich 쪽 리스너가 정적 작성 창을 지우고 자기 창을 띄웁니다(`patch-rich-comments-client.tsx:129`).

## 4. esbuild IIFE 번들 (metafile로 확인)

| 번들 | 진입점 | 크기 / supabase-js | `src/lib/supabase.ts`를 직접 import하는 모듈 |
|---|---|---|---|
| `_patches/patch-rich-comments.js` | `src/components/patches/patch-rich-comments-client.tsx` | 1,657,987 B / 217,265 B | `hooks/use-auth.ts`, `hooks/use-comments.ts`, `hooks/use-comment-likes.ts`, `hooks/use-likes.ts`, `hooks/use-resource-reactions.ts`, `hooks/use-community-stories.ts`, `lib/api-session.ts`, `components/story-composer-modal.tsx`, `components/colorful-philosophers/resource-thread.tsx` (comment-section, like-button, resource-reaction-bar를 거침) |
| `_patches/resource-patch-index.js` (`/patches/changes`) | `src/components/patches/resource-patch-index-client.tsx` → `resource-patch-index-explorer.tsx:25-27,44-47,703,705` | 1,754,627 B / 217,265 B | 위 9개, 그리고 `lib/nav-seen.ts`(`site-nav-items.ts`를 거침) |
| `_patches/patch-nav-indicators.js` | `src/components/patches/patch-nav-indicators-client.ts:1-33` | 292,285 B / 216,674 B | `lib/nav-seen.ts`, `lib/nav-snapshot.ts` |
| `_patches/patch-global-search.js` | — | 13,579 B / 0 | 없음 |
| `_patches/patch-static-card-preview.js` | — | 2,944 B / 0 | 없음 |

번들 안의 Supabase 사용과 api 대응. 모두 공용 모듈이라 Next 앱과 같은 코드입니다:

| 모듈:줄 | legacy Supabase | api 대응 | 6단계에서 걸리는 것 |
|---|---|---|---|
| `src/lib/nav-seen.ts:295-339`, `:365` | `combo_posts`, `transfigure_posts`, `this_or_that_posts`, `favorite_tournament_posts`, `chemical_posts`, `decisions_decisions_posts`, `pagestorm_posts`, `runs`의 created_at, `colorful_philosopher_posts` week_start. 스냅샷에 없는 표면도 legacy로 읽습니다(365). | `fetchUnreadSurfaceIds`(372-383) → `/api/read/nav` | 저장 키 `navSeenStorageKey` 등(94-104, 257)이 `supabaseEnv`를 접미사로 씁니다. 값이 바뀌면 사용자의 읽음 상태가 초기화됩니다. |
| `src/lib/nav-snapshot.ts:50` | — | env 검사 `validateNavSnapshot(value, supabaseEnv)` | 데이터 env를 어디서 받을지 정해야 합니다. |
| `src/hooks/use-auth.ts:14-34`, `:42-82`, `:86-127` | `auth.setSession`, `getSession`, `signInAnonymously`, `onAuthStateChange` | 쿠키 모드 `claimNewIdentity`, `cookieModeFallbackUid` | `:38` `ready`, `:42` `if (!supabaseEnabled) return null` → define을 빼면 userId가 없어져 쓰기가 전부 막힙니다. |
| `src/lib/api-session.ts:18-26`, `:81-95` | `auth.getSession`, `refreshSession`(토큰 경로) | 쿠키 경로 `apiFetchWithCookie` | 토큰 경로를 지웁니다. |
| `src/hooks/use-comments.ts:66-75`, `:176-187`, `:233` | `comments` select/insert/delete | `engagementApiFor` + `/api/read/engagement`, `/api/write/comments` | `:111`, `:126`, `:211` `!supabaseEnabled` 검사가 api 경로도 막습니다. |
| `src/hooks/use-comment-likes.ts:57-80`, `:157-160` | `comment_likes` | `/api/me/engagement`, `/api/write/comment-likes` | `:137` 검사 |
| `src/hooks/use-likes.ts:29-34`, `:89-93`, `:208-230` | `likes` | `/api/write/likes`, engagement | `:131`, `:140`, `:171` 검사 |
| `src/hooks/use-resource-reactions.ts:52-54`, `:96-99`, `:144-146`, `:202-204`, `:287-291` | `resource_reaction_counts`, `resource_reactions` | `/api/read/engagement?reactions=`, `/api/write/reactions` | `:50`, `:136`, `:193` 검사 |
| `src/hooks/use-community-stories.ts:161-171`, `:270-283`, `:326-331` | `community_stories` select/insert/delete | `/api/read/stories`(limit 100·200·1000, `src/lib/stories-api-rules.ts:11`), `/api/write/stories` | `:145`, `:226`, `:307` 검사 |
| `src/hooks/use-community-stories.ts:176-191`, `:212` | **Realtime** `supabase.channel("community_stories")` `postgres_changes` INSERT (legacy일 때만) | 없음(계획 5.4: 대체하지 않음) | 지웁니다. CSP의 `wss://*.supabase.co`도 함께 뺍니다. |
| `src/components/colorful-philosophers/resource-thread.tsx:72-74`, `:89-91` | `colorful_philosopher_posts` | engagement API | `supabaseEnabled` 검사 |
| `src/components/story-composer-modal.tsx:171`, `:225`, `:236`, `:329-349` | (렌더 중 `supabaseEnabled`) | — | define을 빼면 작성 창이 늘 비활성이 되고 `storageDisabled` 문구가 뜹니다. |

## 5. `patch:build`(그리고 `next build`)의 DB 읽기

| 위치 | 읽는 것 | 지금 쓰는 곳 | api·D1 대응 | 6단계 문제 |
|---|---|---|---|---|
| `src/components/patches/patch-detail-page.tsx:844-850` → `src/lib/transfigure-data.ts:7-71` | `transfigure_posts` `select *` 15개. development면 production 행으로 대체(45-57). 실패하면 `BUILTIN_SAMPLE_TRANSFIGURES` | `BackstabTransfigureSection`의 정적 카드 렌더(`backstab-transfigure-section.tsx:95-99`). 브라우저 쪽 갱신은 일부러 없습니다(`patch-comments-client.js:2002-2003`). | `/api/read/toybox-feed?service=transfigure`가 있습니다(`d1-adapters/index.ts:55`). 다만 카드 얼굴은 React 렌더라 HTML 주입이 쉽지 않습니다. | 결정이 필요합니다(7절). 표본 글 대체는 계획 5.7이 없애려는 것입니다. |
| 같은 곳 → `src/lib/colorful-philosophers-gallery.ts:21-104` | `colorful_philosopher_posts` 12개와 `resource_reaction_counts` | `BackstabColorfulPhilosophersSection`의 초기 릴. 브라우저가 3절의 api로 다시 채웁니다. | `/api/read/colorful-philosophers/reel`, `/api/read/engagement?reactions=` | 글이 0개면 섹션이 `return null`(`backstab-colorful-philosophers-section.tsx:258`) → `captureReelTemplate`(`patch-comments-client.js:1794-1797`)과 `reelStack`(`:1788-1791`)이 비고 `refreshReelWeek`가 바로 끝납니다(`:1896-1897`). DB 읽기만 지우면 릴이 사라지므로 빈 틀이나 템플릿 카드를 구워야 합니다. |
| `src/lib/build-supabase-read.ts:1-41` | 운영 빌드 실패 정책, `ALLOW_BUILD_WITHOUT_SUPABASE` | 위 두 곳 | — | 지웁니다. `scripts/build-supabase-read.spec.ts`와 CI 변수(`cloudflare-workers.yml:32`)도 함께 지웁니다. |
| `src/app/(main)/dev/patch-types/patch-types-dev-page.tsx:135-136` | 같은 두 함수 | `next build`의 dev 페이지 | — | 같이 바꿉니다. |

- 런타임 HTML 주입(`slseoun-initial-data`, HTMLRewriter)은 아직 어디에도 없습니다. `SURFACE_MAP.md:592`의 "3단계에 HTML 주입"은 구현되지 않았습니다.
- 패치 Worker에는 D1 binding이 없습니다(`wrangler.patch.jsonc`). 주입을 한다면 main Worker가 `PATCH_WORKER.fetch` 응답을 고치는 것(`main-worker.ts:481`)이 후보입니다.

## 6. CSP와 헤더 (패치 Worker 쪽)

| 위치 | 내용 |
|---|---|
| `workers/security-headers.ts:19-21` | `connect-src 'self' https://*.supabase.co wss://*.supabase.co …`. 주석 19는 Supabase 근거입니다. Report-Only입니다(`:36`). |
| `public/_headers:6` | 같은 정책. `scripts/security-headers.spec.ts:31-44`가 두 파일이 같은지 확인합니다. |
| `scripts/copy-patch-worker-assets.mjs:87-96` | `public/_headers`의 `/*` 규칙을 `.patch-worker/assets/_headers`로 복사합니다(빌드 산출물). Supabase 사용은 없습니다. |
| `workers/patch-worker.ts:59-61` | Worker가 만드는 응답에 `withSecurityHeaders`. Supabase 사용, env, D1은 없습니다. |
| `scripts/cloudflare-testbed.spec.ts:48-71` | CSP 위반이 하나라도 있으면 실패합니다. Supabase 항목을 뺀 뒤 브라우저에 남은 Supabase 호출을 잡는 검사가 됩니다. |

`security-headers.ts`와 `public/_headers` 두 파일을 같은 커밋에서 고치고, 두 Worker를 모두 다시 빌드·배포해야 합니다.

## 7. 6단계에 이 영역에서 할 일, 그리고 결정이 필요한 것

**할 일:**

1. `patch-comments-client.js`
   - `authRequest`, `ensureSession`, `restRequest`, `commentsPath`, `commentLikesPath`와 legacy 분기를 모두 지웁니다(703-722, 967-1003, 1087-1101, 1159-1191, 1660-1667, 1910-1915, 1966-1976, 2061-2093).
   - `readConfig`의 URL·키 조건(84)과 `!config` 차단(1233-1238, 2014, 653)을 없앱니다.
   - `authStorageKey`가 URL 없이 ref를 구하게 합니다. 토큰을 읽고 쓰는 일(1478)은 7단계까지 유지합니다.
   - `apiWriteAsUser`를 쿠키 전용으로 바꾸고 `loadApiState`의 토큰 분기(947-955)를 지웁니다.
   - `surfacePath`와 demote(1381-1396)는 지우거나 늘 api로 둡니다.
2. 번들 세 개: 4절 표의 `supabaseEnabled` 검사를 api 경로에서 걷어낸 뒤에 `src/lib/supabase.ts` 의존을 끊습니다. 순서가 중요합니다. 그다음 `build-patch-worker.tsx:691-692` define과 `:655-656` 설정을 지웁니다. 번들마다 약 217 KB가 줄어듭니다.
3. 5절의 빌드 읽기를 지우고, 철학자 릴 템플릿 문제를 해결합니다.
4. 6절의 CSP를 정리합니다.
5. 테스트를 고칩니다.
   - `scripts/api-identity-patch-client.spec.ts:13-14`: CONFIG의 `supabaseUrl`과 `AUTH_KEY`.
   - `scripts/api-write-retry.spec.ts:72`: 문법 검사만 하므로 영향이 적습니다.
   - `scripts/courier-comment-text.spec.ts:20`
   - `scripts/build-supabase-read.spec.ts`: 지웁니다.

**결정이 필요한 것:**

- **(a) 변형 릴의 데이터를 어디서 받을지.** 지금은 빌드 때 구운 정적 카드뿐입니다. 후보는 런타임 주입, 브라우저 렌더 번들, 표본 글 세 가지입니다.
- **(b) 데이터 env 값.** 네비 env 검사와 `sts-nav-*` 저장 키 접미사가 쓰므로 값(`production`)은 그대로 두어야 합니다. 정할 것은 Supabase와 무관한 이름으로 무엇을 쓸지입니다.
- **(c) 쿠키 전용이 된 뒤 claim이 거절되거나 `token_expired`가 오면 어떻게 할지.** 지금은 브라우저가 Supabase 토큰을 갱신합니다. 빈 claim으로 새 신원을 받으면 예전 uid를 잃습니다.
- **(d) 로컬 dev.** `pnpm dev` 프록시는 `/api`를 Next dev로 넘기고, Next dev에는 `/api/read`·`/api/write`가 없습니다(`next.config.ts:75-87`, `src/app/api/`에는 link-preview와 dev 경로뿐). `pnpm patch:dev`는 패치 Worker만 띄웁니다. 그래서 legacy를 지우면 로컬 패치 페이지의 댓글과 네비 점이 "응답 없음"이 됩니다. 로컬 확인은 `cf:testbed:local --api`(`scripts/run-cloudflare-testbed.mjs:392-409`)로만 가능해집니다.

**다른 영역에 넘길 것:**

- Worker는 경로 플래그가 legacy이거나, `API_RUNTIME_FLAGS=off`이거나, `slseoun_qa=no-supabase`일 때 409 `surface_legacy`를 답합니다(`workers/api/flag-cookie.ts:85-98`, `scripts/cloudflare-testbed.spec.ts:81-84`). 클라이언트에 legacy가 없어지면 이것이 곧 장애가 됩니다. 그래서 되돌리는 수단은 `source.<group>` 쪽이어야 합니다.
- `workers/detail-shell-og.ts:197-260`의 REST 읽기는 main Worker 영역이라 이 인벤토리에서는 확인만 했습니다.

## 주요 파일 (절대 경로)

- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/build-patch-worker.tsx`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/components/patches/patch-comments-client.js`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/components/patches/patch-rich-comments-client.tsx`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/components/patches/patch-nav-indicators-client.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/components/patches/resource-patch-index-client.tsx`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/components/patches/patch-detail-page.tsx`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/components/patches/backstab-colorful-philosophers-section.tsx`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/transfigure-data.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/colorful-philosophers-gallery.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/build-supabase-read.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/patch-worker.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/copy-patch-worker-assets.mjs`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/security-headers.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/public/_headers`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/dev-patch-proxy.mjs`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/wrangler.patch.jsonc`
- 번들 그래프 metafile과 import 경로 스크립트: `/private/tmp/claude-502/-Users-flavono123-P-scare-the-spire/05d90378-9b11-4d2c-9b88-1196a51c9c23/scratchpad/patchgraph/out/`

---

## 조사 4

# 6단계 클라이언트 정리: 브라우저 데이터 읽기·쓰기 목록 (src/ 아래)

## 0. 요약

- **`@supabase/supabase-js`를 직접 import하는 곳은 6개입니다.**
  - 브라우저에서 쓰이는 곳은 `src/lib/supabase.ts:1` 하나입니다.
  - 나머지는 빌드·서버 전용입니다: `transfigure-data.ts:1`, `colorful-philosophers-gallery.ts:1`, dev 화면 3개(`admin-dev-page.tsx:8`, `dev/colorful-philosophers/actions.ts:3`, `api/dev/contact-inbox/route.ts:21`).
- **supabase-js 없이 Supabase를 직접 부르는 파일이 하나 더 있습니다.** `src/components/patches/patch-comments-client.js`는 fetch로 `/rest/v1`(데이터)와 `/auth/v1`(로그인)을 직접 호출합니다. `.js`라서 ts/tsx 기준 grep에는 잡히지 않습니다. 패치 페이지에 실제로 도는 코드입니다.
- **새 코드가 필요한 축은 세 가지입니다.**
  1. **신원.** `use-auth.ts`, `api-session.ts`, `use-puzzlebox-scores.ts`, 패치 클라이언트가 아직 `supabase.auth`나 Supabase Auth REST에 기댑니다. Worker 쿠키 신원만 쓰도록 바꿔야 합니다.
  2. **api 분기가 아예 없는 legacy 전용 코드.** 대부분 dev 화면 전용입니다.
  3. **api 조건을 넘는 입력.**
     - 런 id 100개 초과
     - 형식 규칙(`isRunId`/`isRowId`)에 안 맞는 런 id
  - 이 셋을 빼면 거의 모든 legacy 분기는 api 경로가 이미 있어 기계적 삭제입니다.
- **Worker 경로는 모두 있습니다.** 클라이언트가 부르는 `/api` 읽기 경로는 전부 D1 읽기 어댑터가 있고(`workers/api/d1-adapters/index.ts:34-68`), 쓰기 경로는 전부 D1 쓰기 핸들러가 있습니다(`workers/api/d1-write/index.ts:35-64`). 클라이언트 쪽에서 "api 경로가 없어서" 막히는 화면 그룹은 없습니다.

## 1. 공통 기반 모듈

| 파일:줄 | 하는 일 | 6단계 처리 |
|---|---|---|
| `src/lib/supabase.ts:1-22` | `createClient`(모듈 범위에서 생성), `supabaseEnabled`(URL·키 환경변수가 있는지), `supabaseEnv`(NEXT_PUBLIC_SUPABASE_ENV), `isCheckViolation`(23514), `supabaseClientOptions` | 클라이언트는 삭제합니다. `supabaseEnv`는 37개 파일이, `isCheckViolation`은 `use-combo-posts.ts`, `use-transfigure-posts.ts`, `toybox-api.ts`가 쓰므로 다른 모듈로 옮겨야 합니다(기계적). |
| `src/lib/supabase-timeout.ts:1-26` | `withSupabaseTimeout` | legacy 호출과 함께 사라집니다. dev 라우트만 남습니다. |
| `src/lib/runtime-flags.ts:47-55` | `surfacePath(group)`(slseoun_rf 쿠키와 demoted 집합), `demoteSurface` | 클라이언트 분기를 없애면 쓸 곳이 없습니다. `slseounRuntime().nav` 공유(`:21-36`)는 `nav-snapshot.ts`가 계속 씁니다. |
| `src/lib/api-surfaces.ts:22-24` | `SurfacePath = "legacy" \| "api"` | Worker와 `scripts/runtime-flags.ts`가 같이 씁니다. 클라이언트에서만 걷어내면 됩니다. |
| `src/lib/api-client.ts` | `SurfaceLegacyError` `:28-33`, `requireApiVersion` `:81-85`, `shouldUseLegacy` `:88-90`, `writeMayGoLegacy` `:93-95`, 표식 헤더 없음 → demote `:156-163`, 409 surface_legacy → demote `:177-180` | legacy 신호를 "사용 불가(unavailable)"로 바꾸면 됩니다(기계적). 호출하는 쪽의 `if (!shouldUseLegacy(e)) throw` 패턴도 모두 정리합니다. |
| `src/lib/api-session.ts` | `currentAccessToken` `:18-26`(`supabase.auth.getSession`), `apiFetchWithCookie` `:52-76`, `apiFetchWithToken` `:78-92`(`supabase.auth.refreshSession`) | **새 코드 필요.** 쿠키 경로만 남깁니다. `tokenPathAfterClaim` `:37-39`이 토큰 경로로 넘기던 두 경우(IdentityLegacyError, claim이 `token_invalid`)를 갈 곳이 없어집니다. 3절에서 다룹니다. |
| `src/lib/api-identity.ts` | supabase-js를 쓰지 않습니다(`:21`). localStorage의 `sb-…-auth-token`을 직접 읽습니다(`:53-97`). 키는 `NEXT_PUBLIC_SUPABASE_URL`에서 만들고 없으면 키 목록을 훑습니다(`:56`). | 유지합니다. 7단계까지 토큰을 보존하므로 환경변수도 유지하거나 키 탐색 fallback에 맡깁니다. |
| `src/lib/api-engagement.ts:80-82` | `engagementApiFor` = surfacePath("comments") 그리고 키 형식 규칙 | 키 규칙만 남깁니다. 주석상 "2026-11-06 기준 양 env의 모든 스레드 키가 규칙을 통과"(`engagement-keys.ts:7`)하므로 기계적입니다. |
| `src/lib/toybox-api.ts:21-23` | `toyboxViaApi()` | 항상 api로 처리합니다(기계적). |

## 2. 그룹별 목록

표기: R = 읽기, W = 쓰기. "기계적" = api 분기가 이미 있어 legacy 분기를 지우기만 하면 됨.

### nav

| 파일:줄 | R/W | legacy 동작 | api 경로 | 처리 |
|---|---|---|---|---|
| `src/lib/nav-seen.ts:295-310` `weeklyHasNewer` | R | colorful_philosopher_posts의 week_start 최신 1행 | `/api/read/nav`의 `weekly` | 기계적 |
| `nav-seen.ts:312-328` `surfaceHasNewer`, `:330-339` `legacyUnreadSurfaceIds` | R | 표면별 `created_at > since` limit 1 | `/api/read/nav`의 `latest` | 기계적 |
| `nav-seen.ts:364` (`unreadFromSnapshot` 안) | R | 스냅샷이 모르는 표면은 legacy로 | 위와 같음 | 기계적. `nav-surfaces.ts:8-15`가 nav-seen의 모든 테이블 표면을 덮으므로 죽은 분기입니다. |
| `nav-seen.ts:372-383` `fetchUnreadSurfaceIds` | R | 분기 | `loadNavSnapshot` | 기계적 |
| `nav-seen.ts:94-104,257` | – | `supabaseEnv`로 저장소 키를 만듦 | – | 상수만 옮깁니다. |
| `src/lib/nav-snapshot.ts:4,51` | R | `validateNavSnapshot(value, supabaseEnv)` | `/api/read/nav` | 상수만 옮깁니다. |
| `src/components/comment-courier.tsx:159-172` `legacyCourierRows` | R | comments 최근 순 LIMIT | `/api/read/nav`의 `courier` | 기계적 |
| `comment-courier.tsx:175-184` `courierRows`, `:275` 게이트 | R | 분기 | 위와 같음 | 기계적 |
| `src/hooks/use-mailbox-reply.ts:6,14` | – | 캐시 키에 `supabaseEnv` | (contact 그룹 함수 호출) | 상수만 옮깁니다. |

### comments (참여: 댓글, 좋아요, 반응)

| 파일:줄 | R/W | legacy 동작 | api 경로 | 처리 |
|---|---|---|---|---|
| `src/hooks/use-comments.ts:66-88` | R | `comments` select * | `GET /api/read/engagement?threads=` (`:90-109`) | 기계적 |
| `use-comments.ts:185-201` | W | comments insert | `POST /api/write/comments` (`:137-165`) | 기계적 |
| `use-comments.ts:231-239` | W | comments delete | `DELETE /api/write/comments?id=` (`:207-227`) | 기계적 |
| `src/hooks/use-comment-likes.ts:57-68` `loadLegacyMine`, `:71-92` 개수 쿼리 | R | comment_likes select | 개수는 스레드 행의 `like_count`, 내 좋아요는 `GET /api/me/engagement?threads=` (`:95-110`) | 기계적. 유일한 호출자 `comment-section.tsx:127`은 항상 `useComments` 행(like_count 포함)을 넘깁니다. |
| `use-comment-likes.ts:157-163` | W | comment_likes insert/delete | `PUT/DELETE /api/write/comment-likes?id=` (`:141-155`) | 기계적 |
| `src/hooks/use-likes.ts:26-39,42-51` | R | likes maybeSingle (내 상태) | `GET /api/me/engagement?likes=` | 기계적 |
| `use-likes.ts:86-108` | R | likes count:exact head | `GET /api/read/engagement?likes=` (`:110-129`) | 기계적 |
| `use-likes.ts:201-240` | W | likes insert/delete | `PUT/DELETE /api/write/likes?key=` (`:181-199`) | 기계적 |
| `src/hooks/use-resource-reactions.ts:142-165` | R | resource_reaction_counts maybeSingle | `GET /api/read/engagement?reactions=` (`:166-182`) | 기계적 |
| `use-resource-reactions.ts:201-214` | R | 내 resource_reactions | `GET /api/me/engagement?reactions=` (`:216-226`) | 기계적 |
| `use-resource-reactions.ts:275-301` | W | delete/update/insert | `PUT /api/write/reactions` (`:254-273`) | 기계적 |
| `use-resource-reactions.ts:47-74` `fetchResourceReactionCounts`, `:76-108` `saveResourceReaction` | R/W | **api 분기 없음** | 경로는 있음: `/api/read/engagement?reactions=`, `PUT /api/write/reactions` | 유일한 호출자가 dev 전용 React 릴(5절)입니다. 그 릴과 함께 지우면 됩니다. |
| `src/hooks/use-engagement-counts.ts:37-58` | R | `rpc get_engagement_counts` | `GET /api/read/engagement-counts` (`:60-80`) | 기계적 |
| `src/components/colorful-philosophers/resource-thread.tsx:71-80` | R | 이 리소스의 colorful_philosopher_posts 20개 | `GET /api/read/engagement?philosophers=` (`:82-92`) | 기계적 |

### stories

| 파일:줄 | R/W | legacy 동작 | api 경로 | 처리 |
|---|---|---|---|---|
| `src/hooks/use-community-stories.ts:160-175` | R | community_stories select | `GET /api/read/stories?limit=&source=` (`:196-207`) | 기계적. api는 `limit ∈ {100,200,1000}`만 받습니다(`:142-144`, `stories-api-rules.ts:11`). 현재 호출자 5곳(byrdispatch, story-feed, patch-rich-comments `:60`, patch-note-with-story-actions `:301`, resource-patch-index-explorer `:705`)은 모두 100, 200, 1000 중 하나를 씁니다. |
| `use-community-stories.ts:176-193,212` | R | **Realtime** channel INSERT | 없음(plan 5.4 결정) | 삭제 |
| `use-community-stories.ts:268-297` | W | community_stories insert | `POST /api/write/stories` (`:237-266`) | 기계적 |
| `use-community-stories.ts:324-333` | W | delete | `DELETE /api/write/stories?id=` (`:309-321`) | 기계적 |

### colorful-philosophers (다채로운 철학자들)

| 파일:줄 | R/W | legacy 동작 | api 경로 | 처리 |
|---|---|---|---|---|
| `src/hooks/use-colorful-philosopher-posts.ts:83-111` (`useColorfulPhilosopherWeek`) | R | 그 주의 게시글 100개 | `GET /api/read/colorful-philosophers/week` (`:58-81`) | 페이지 자신의 env이면 기계적. `env !== supabaseEnv`(`:49`)이면 api가 없습니다. 이 경우는 `/dev/colorful-philosophers`(`colorful-philosophers-dev-page.tsx:133`)뿐이라 dev 전용입니다. |
| `use-colorful-philosopher-posts.ts:184-205` (`useColorfulPhilosopherPost`) | R | 게시글 1행 | `GET /api/read/colorful-philosophers/post?id=` (`:163-182`) | 기계적. uuid가 아닌 id는 지금도 api 경로에서 "없음"으로 끝납니다. |
| `use-colorful-philosopher-posts.ts:210-254` (`useColorfulPhilosopherCommentCounts`) | R | comments의 story_id in(…) | week 응답의 `commentCounts` | 기계적. `index-view.tsx:49`는 api 응답의 counts를 넘깁니다. |
| `use-colorful-philosopher-posts.ts:120-140` (`useColorfulPhilosophersNextWeekOpen`) | R | env=`production`의 다음 주 슬롯 | **없음** | dev 전용입니다(`site-navbar.tsx:787`, dev 네비 점). 지우거나 로컬 스크립트로 옮깁니다(plan 5.7). |

### contact / profile

| 파일:줄 | 그룹 | R/W | legacy 동작 | api 경로 | 처리 |
|---|---|---|---|---|---|
| `src/lib/contact-inquiries.ts:97-118` | contact | W | contact_inquiries insert | `POST /api/write/contact-inquiries` (`:75-95`) | 기계적 |
| `contact-inquiries.ts:180-193` | contact | R | 확인 안 한 답장이 있는지 | `GET /api/me/mailbox` (`:168-178`) | 기계적 |
| `contact-inquiries.ts:152-160` | profile | R | 내 문의 50개 | `GET /api/me/profile/inquiries` (`:138-150`) | 기계적 |
| `contact-inquiries.ts:212-222` | profile | W | reply_seen_at update | `POST /api/write/profile/inquiries-seen` (`:200-210`) | 기계적 |
| `src/hooks/use-profile-character-nicknames.ts:27-47` | profile | R | 닉네임 풀 select | `GET /api/read/profile/nicknames` (`:16-26`) | 기계적 |
| `src/hooks/use-profile-activity.ts:74-79` | profile | R | `rpc get_my_profile_activity_stats` | `GET /api/me/profile/stats` (`:65-73`) | 기계적 |
| `use-profile-activity.ts:99-111` | profile | R | `rpc get_my_profile_activity` | `GET /api/me/profile/activity` (`:89-98`) | 기계적 |

### puzzlebox

| 파일:줄 | R/W | legacy 동작 | api 경로 | 처리 |
|---|---|---|---|---|
| `src/hooks/use-puzzlebox-scores.ts:149-160` | W | `rpc submit_puzzlebox_run` | `POST /api/write/puzzlebox/runs` (`:136-148`) | 기계적 |
| `use-puzzlebox-scores.ts:242-262` | R | `rpc get_puzzlebox_leaderboard` | `GET /api/read` 또는 `/api/me/puzzlebox/leaderboard` (`:218-241`) | 분기는 기계적. 단 `:215`가 `currentAccessToken()`(supabase.auth)으로 me와 read 중 무엇을 부를지 정합니다. **새 코드 필요**: 쿠키 신원 기준(`claimedUid()` 또는 저장된 토큰)으로 바꿉니다. |
| `use-puzzlebox-scores.ts:305-318` | R | `rpc get_my_puzzlebox_standings` | `GET /api/me/puzzlebox/standings` (`:289-303`) | 분기는 기계적. `hasSession()` `:168-178`(`supabase.auth.getSession`)과 `:289`는 **새 코드 필요**(위와 같은 이유). |
| `encodePuzzleboxBoards`가 null (`:197,291`) | R | 보드 수나 형식이 규칙 밖이면 legacy | 없음 | null이면 실패로 처리합니다. 보드 목록은 코드 상수라 실제로 밖에 나는 경우는 확인하지 않았습니다. |

### history-runs (역사 강의서)

| 파일:줄 | R/W | legacy 동작 | api 경로 | 처리 |
|---|---|---|---|---|
| `src/lib/run-donation.ts:108-121` `selectDonatedRunForEnv` | R | runs 상세 | `GET /api/read/history-run?id=&view=detail` (`:100-107`) | 기계적. `isRunId`에 안 맞는 id는 legacy로 갑니다(아래 주). |
| `run-donation.ts:136-149` (recent), `:164-178` (reference) | R | runs 목록 | `GET /api/read/history-runs?view=recent` 또는 `reference` | 기계적 |
| `run-donation.ts:89-94` `runReadEnvs` | R | dev 도구가 켜진 production 아닌 빌드에서 production env도 읽음 | 없음(api는 자기 env만) | dev 전용입니다. 지웁니다. |
| `run-donation.ts:257-260` | W | runs insert | `POST /api/write/history-runs`, 409 `single_run_required`이면 `/share` (`:242-256`) | 기계적 |
| `run-donation.ts:365-401` | W | runs upsert (일괄) | `POST /api/write/history-runs/batch` → `/share` 하나씩 (`:347-361`) | 기계적 |
| `run-donation.ts:434-456` | W | cover_spec update | `PATCH /api/write/history-runs/cover?id=` | 기계적 (isRunId 조건) |
| `run-donation.ts:478-497` (og), `:518-536` (cover) | R | runs 1행 | `view=meta`, `view=cover` | 기계적 (isRunId 조건). `run-detail-loader.tsx:113`이 브라우저에서 부릅니다. |
| `run-donation.ts:550-559` `isRunDonated`, `:579-591` `isOwnDonation`, `:612-623` `listMyDonatedRunIds` | R | runs select | `view=meta`, `GET /api/me/history-runs(?id=)` | 기계적 |
| `run-donation.ts:636-645` | W | donor_nickname update | `POST /api/write/history-runs/nicknames` | 기계적 |
| `run-donation.ts:690-699` | W | runs delete | `DELETE /api/write/history-runs?id=` | 기계적 (isRunId 조건) |
| `src/hooks/use-history-course-engagement.ts:53-90` | R | likes, comments의 story_id in(…) | `GET /api/read/history-runs/engagement?ids=` (`:92-108`) | **새 코드 필요.** api는 id 100개 이하, 중복 없음, 전부 isRunId일 때만 탑니다(`:41-45`). 호출자 `history-course-run-index.tsx:243`은 이 브라우저의 로컬 런과 공유 런 100개를 합쳐 넘기므로 100개를 넘을 수 있습니다. 100개씩 나눠 부르는 코드가 필요합니다. |
| `src/lib/defragment-feed.ts:187-213` | R | runs 피드(history_course) | `GET /api/read/defragment-runs` (`:179-186`) | 기계적. `apiCursorOk` `:139-141`(isRowId, ISO)가 안 맞으면 legacy로 갑니다. |

주: 런 id가 `isRunId`나 `isRowId`(`/^[A-Za-z0-9_-]{1,64}$/`)에 안 맞으면 그 런은 지금 legacy로만 열립니다. legacy를 지우면 "없음"으로 바뀝니다. 운영 데이터에 그런 id가 있는지는 확인하지 않았습니다.

### toybox-feed (장난감 상자)

모든 행이 `if (toyboxViaApi()) { api… } else supabase…` 형태이고, 지금은 api 실패 중 legacy 신호일 때만 legacy로 다시 보냅니다. 6단계에서는 모두 기계적 삭제입니다(위의 isRowId 주의만 해당).

| 파일 | api 분기 시작 줄 → legacy 시작 줄 | api 경로 |
|---|---|---|
| `src/lib/toybox-feed.ts` `fetchToyboxFeedPage` | `:276` → `rpc get_toybox_feed` `:285` | `GET /api/read/toybox-feed` |
| `src/hooks/use-toybox-feed.ts:97-136` | **Realtime** UPDATE, DELETE 채널 | 없음(plan 5.4). 삭제 |
| `src/lib/defragment-feed.ts` `fetchDefragmentFeedPage` | `:265` → `rpc get_defragment_feed_v2` `:274` | `GET /api/read/defragment-feed` |
| `src/hooks/use-chemical-posts.ts` insert | `:65` → `:75` | `POST /api/write/toybox-post?service=chemical_x` |
| `src/components/chemicalx/post-view.tsx` 상세, 삭제 | `:60` → `:69`, `:92` → `:104` | `GET /api/read/toybox-post`, `DELETE /api/write/toybox-post` |
| `src/hooks/use-combo-posts.ts` insert, update, 상세, 삭제 | `:96→106`, `:141→152`, `:230→239`, `:288→303` | toybox-post POST, PATCH, GET, DELETE |
| `src/hooks/use-transfigure-posts.ts` update, insert, 상세, 삭제 | `:375→387`, `:421→430`, `:508→517`, `:565→580` | 위와 같음 |
| `src/hooks/use-decisions-decisions-posts.ts` insert, update, 상세, 삭제 | `:80→90`, `:122→134`, `:183→192`, `:228→243` | 위와 같음 |
| `src/hooks/use-pagestorm-posts.ts` 게시글 insert, update | `:68→90`, `:119→140` | toybox-post POST, PATCH |
| 같은 파일, 임시 저장 생성, 수정, 삭제 | `:184→193`, `:209→220`, `:236→247` | `POST/PATCH/DELETE /api/write/pagestorm/drafts` |
| 같은 파일, 임시 저장 1개와 목록 | `:291→278`, `:346→332` | `GET /api/me/pagestorm/drafts(?id=)` |
| 같은 파일, 목록, 상세, 삭제 | `:401→387`, `:457→443`, `:482→497` | `GET /api/read/pagestorm/posts`, toybox-post GET, DELETE |
| `src/hooks/use-pagestorm-toybox.ts` `fetchToyboxRow` | `:64→74` | `GET /api/read/toybox-post` |
| `src/hooks/use-favorite-tournament-posts.ts` insert, 기본 대회, 상세와 통계, 삭제 | `:85→96`, `:137→146`, `:193→207/216`, `:254→265` | toybox-post, `GET /api/read/favorite-tournament/presets`, `/stats` |
| 같은 파일, 플레이 완료와 통계 다시 읽기 | `:294→310` (`rpc complete_favorite_tournament_play`), `:327→336` | `POST /api/write/favorite-tournament/play`, `/stats` |
| `src/hooks/use-this-or-that-posts.ts` insert, 상세, 삭제 | `:88→99`, `:176→185`, `:217→228` | toybox-post |
| `src/hooks/use-this-or-that-likes.ts` 읽기, 토글 | `:54→68/77`, `:156→144/150` | `GET /api/read/this-or-that/like-counts`, `/api/me/this-or-that/likes`(100개씩 나눠 부름 `:23-30`), `PUT/DELETE /api/write/this-or-that/like` |
| `src/hooks/use-this-or-that-votes.ts` 읽기, 투표, 취소 | `:72→88` (`rpc get_this_or_that_vote_summaries`) `/96`, `:184→196`, `:241→251` | `/api/read/this-or-that/vote-summaries`, `/api/me/this-or-that/votes`, `PUT/DELETE /api/write/this-or-that/vote` |
| `src/hooks/use-defragment-posts.ts` update, 삭제, 상세 | `:83→107`, `:134→145`, `:160→172` | toybox-post PATCH, DELETE, GET (service=defragment) |
| `src/hooks/use-defragment-bodies.ts` 읽기, upsert | `:83→93` (isRowId 조건), `:121→140` | `GET /api/read/defragment-body`, `PUT /api/write/defragment-body` |

## 3. 신원: 새 코드가 필요

| 파일:줄 | 하는 일 | 대체 | 메모 |
|---|---|---|---|
| `src/hooks/use-auth.ts:24-31` | `supabase.auth.setSession` (Worker가 대신 가입한 세션을 supabase-js에 넘김) | Worker가 준 세션을 localStorage의 `sb-…-auth-token`에 직접 저장 | 7단계 되돌리기용 토큰 보존(plan 5.3)을 지키려면 직접 써야 합니다. 패치 클라이언트의 `writeStoredSession`(`patch-comments-client.js:403-409`)과 같은 일입니다. |
| `use-auth.ts:46-49,91-94` | `supabase.auth.getSession` | `claimedUid()`, 없으면 `storedSupabaseIdentity()?.uid` | `cookieModeFallbackUid` `:104,118`는 이미 있습니다. |
| `use-auth.ts:67-71` | `signInAnonymously` (토큰 모드) | `ensureClaimedIdentity()`, 저장된 토큰이 없으면 `claimNewIdentity()` (`POST /api/auth/claim`) | identity.mode=cookie가 전제입니다. |
| `use-auth.ts:116-121` | `onAuthStateChange` (탭끼리 동기화) | `storage` 이벤트로 `IDENTITY_MARKER_STORAGE_KEY` 감시 | 대체 코드가 아직 없습니다. |
| `src/lib/api-session.ts:18-26,78-92` | 토큰 경로와 `refreshSession` | 삭제 | **판단이 필요합니다.** 지금은 claim 거부(`token_invalid`, 즉 토큰 exp 뒤 180일이 지남, `workers/api/identity/claim.ts:36,115`)와 IdentityLegacyError를 supabase-js가 세션을 갱신해 살립니다. supabase-js를 지우면 이 사용자들은 새 uid를 받습니다. 갱신을 대신할 `/api` 경로는 없습니다. |
| `src/hooks/use-puzzlebox-scores.ts:168-178,215,289` | 세션 유무, 토큰 유무 | 쿠키 신원 기준 | 2절 puzzlebox 행과 같습니다. |

## 4. 패치 정적 클라이언트 `src/components/patches/patch-comments-client.js`

Supabase를 fetch로 직접 부릅니다. 빌드가 넣는 설정은 `scripts/build-patch-worker.tsx:654-657`(supabaseUrl, anonKey, env)과 `:691-693`(번들 define)에서 옵니다.

| 줄 | 그룹 | R/W | legacy 동작 | api 경로 | 처리 |
|---|---|---|---|---|---|
| `:78-89` `readConfig`, `:1215-1222` `main` | – | – | supabaseUrl이나 anonKey가 없으면 config가 null이고, 그러면 api 경로여도 댓글이 "응답 없음"이 되고 반응도 막힘(`:2014`) | – | **새 코드 필요**: config 의존을 끊습니다. |
| `:389-409` | – | – | `sb-` 키를 `config.supabaseUrl`에서 만듦 | – | 키 출처를 바꿉니다(api-identity처럼 키 탐색). |
| `:435-457` `authRequest`, `:463-496` `ensureSession` | 신원 | W | `/auth/v1/token?grant_type=refresh_token`, `/auth/v1/signup` | `/api/auth/claim` (`:1429-1481`) | **새 코드 필요**: `apiWriteAsUser` `:1606-1619`의 토큰 fallback을 없애고 쿠키만 씁니다. |
| `:498-526` `restRequest` | – | R/W | PostgREST 직접 호출 | – | 아래 legacy 분기를 다 지우면 함께 삭제 |
| `:654,703-721` | stories | W | community_stories insert | `POST /api/write/stories` (`:675-701`) | 기계적 |
| `:967-1003` `loadState` | comments | R | comments, comment_likes REST (`:972,980,986`) | `/api/read/engagement?threads=`, `/api/me/engagement` (`:914-965`) | 기계적 |
| `:1086-1100` | comments | W | comments insert | `POST /api/write/comments` (`:1053-1085`) | 기계적 |
| `:1158-1192` | comments | W | comment_likes insert/delete, comments delete | `/api/write/comment-likes`, `/api/write/comments` (`:1110-1157`) | 기계적 |
| `:1385-1396` | – | – | 자체 `surfacePath` | – | 삭제 |
| `:1621-1628` `configEnv` | nav | – | `config.supabaseEnv`로 스냅샷 env 대조 | – | env 값은 config에 남겨야 합니다. |
| `:1659-1673` `courierItems` | nav | R | comments REST (`:1661`) | `/api/read/nav` (`:1630-1656`) | 기계적 |
| `:1910-1915` | colorful-philosophers | R | 철학자 게시글 REST | `/api/read/colorful-philosophers/reel` (`:1900-1908`) | 기계적 |
| `:1966-1977` | comments | R | resource_reaction_counts REST | `/api/read/engagement?reactions=` (`:1956`) | 기계적 |
| `:2061-2079` | comments | W | resource_reactions POST, PATCH, DELETE | `PUT /api/write/reactions` (`:2031-2059`) | 기계적 |

## 5. api 분기가 없는 legacy 전용 코드 (지우는 판단이 필요)

| 파일:줄 | 무엇 | 범위 | 처리 |
|---|---|---|---|
| `src/components/patches/backstab-colorful-philosophers-section.tsx:165-192,246` | 릴 주간 select와 반응 합계 읽기·쓰기 (`use-resource-reactions.ts`의 legacy 전용 함수 사용) | dev 전용. 하이드레이션이 `/dev/patch-types`에서만 일어납니다(SURFACE_MAP.md:745-749). | 효과를 지웁니다(구운 `initialPosts` 유지). 살리려면 `/api/read/colorful-philosophers/reel`, `/api/read/engagement?reactions=`, `PUT /api/write/reactions` 호출 코드를 새로 써야 합니다. |
| `src/components/patches/backstab-transfigure-section.tsx:102-122` | transfigure_posts `select *` 15개 | dev 전용(SURFACE_MAP.md:751-755). 결정 #21(SURFACE_MAP.md:1684)이 열려 있습니다. | 지웁니다(`initialPosts`나 `BUILTIN_SAMPLE_TRANSFIGURES` 유지). 맞는 api 경로가 없습니다. 장난감 상자 피드 행은 `select *`가 아닙니다. |
| `use-colorful-philosopher-posts.ts:120-140` | 다음 주 슬롯 (dev 네비 점) | dev 전용 | 지우거나 로컬 스크립트로 옮깁니다. |
| `use-colorful-philosopher-posts.ts:49` (env 지정) | 다른 env의 주간 게시글 | `/dev/colorful-philosophers` | dev 전용 |
| `run-donation.ts:89-94` | production 데이터 같이 읽기 | dev 도구 빌드 | 지웁니다. |

## 6. 빌드·서버 전용 (브라우저 경로는 아니지만 패키지 제거에 걸림)

| 파일:줄 | 무엇 | 메모 |
|---|---|---|
| `src/lib/transfigure-data.ts:1-72` | `createClient`로 transfigure_posts 15개 (production 빌드가 아니면 production 데이터를 빌려 옴 `:52`) | `next build`와 `patch:build`가 부릅니다(`patch-detail-page.tsx:848`, `patch-types-dev-page.tsx:135`). plan 5.7: 빌드는 DB를 읽지 않습니다. 화면은 builtin 샘플로 바뀝니다(보이는 변화). |
| `src/lib/colorful-philosophers-gallery.ts:1-101` | 릴 12개와 반응 합계 | `patch-detail-page.tsx:849`. 런타임에는 `patch-comments-client.js:1895`가 다시 읽습니다. |
| `src/lib/toybox-post-og-fields.ts:13-32` (6개 함수) | 상세 OG 1행 | `generateMetadata`(`src/app/*/[id]/page-content.tsx`)에서 부릅니다. 정적 빌드에서는 셸 세그먼트라 `metadataRecordId`가 undefined를 돌려 DB를 읽지 않습니다(`static-detail-shell.ts:11-14`). 실제 OG 보강은 `workers/detail-shell-og.ts`가 합니다. 삭제는 기계적입니다. |
| `run-donation.ts:460` `getDonatedRunOgFields` | 위와 같은 서버 호출(`history-course/[runId]/page-content.tsx:40`)과 브라우저 호출(`run-detail-loader.tsx:113`) | 브라우저 쪽은 api 분기(view=meta)가 있습니다. |
| `src/app/(main)/dev/admin/admin-dev-page.tsx:8,58,155-702`, `dev/colorful-philosophers/actions.ts:3,21-25,85`, `api/dev/contact-inbox/route.ts:13-32`, `api/dev/history-course-runs/route.ts:33-49`, `.../[runId]/route.ts:42-58` | anon 클라이언트와 service role 클라이언트 | `src/app` 아래라 영역 밖이지만 supabase-js를 import합니다. plan 5.7: `wrangler d1 execute` 로컬 스크립트로 옮깁니다(새 코드). |

## 7. `supabaseEnabled` / `supabaseEnv` 게이트 (데이터 호출 없이 화면만 막는 곳)

`supabaseEnabled`는 dev와 `supabase.ts`를 빼고 226줄입니다. 데이터 호출이 없는 컴포넌트만 추리면 다음과 같습니다. 모두 "api 사용 가능"이나 항상 참으로 바꾸면 되는 기계적 작업입니다.

- `story-composer-modal.tsx:171,225,236,329-349`(`storageDisabled` 문구)
- `contact-page.tsx:65`
- `profile-activity.tsx:143,163`
- `use-profile-activity.ts:147-148,153,156,191,195,225`
- `history-course/donation-panel.tsx:73`
- `history-course-run-index.tsx:156,183,299,371,469,510`
- `run-upload-zone.tsx:147,336`
- `combo-history-run-picker.tsx:141`
- `defragment-post-view.tsx:56-57,70`
- `use-defragment-feed.ts:35,38,43,50,84`
- 각 훅의 초기 `loading`과 `unavailable` 상태

`supabaseEnv`는 행에 담는 `env` 필드(장난감 상자, 댓글, 런 등의 쓰기 본문)와 캐시 키로 계속 쓰이므로 상수를 다른 모듈로 옮겨야 합니다.

## 8. 클라이언트 밖이지만 legacy 삭제를 막는 것

- **로컬 개발.** `pnpm dev`(`scripts/dev-patch-proxy.mjs`)는 `/api`를 Worker로 넘기지 않습니다. legacy를 지우면 로컬에서 데이터가 안 뜹니다. 개발 프록시를 `wrangler dev`의 로컬 D1(plan 5.6)으로 연결하는 작업이 필요합니다.
- **Worker의 409 surface_legacy.** Worker는 지금 다음 경우에 409를 돌려줍니다(`workers/api/router.ts:208,224-233`):
  - 경로가 없을 때(no_route)
  - 플래그가 꺼졌을 때(disabled)
  - 그룹 플래그가 legacy일 때
  - QA no-supabase 쿠키가 있을 때
  - 클라이언트에 legacy가 없으면 이 응답은 그대로 실패가 됩니다.
  - `path.<group>`로 되돌리는 수단도 사라집니다. 남는 되돌리기 수단은 D1 원본 플래그(`source.<group>`)뿐입니다.
- **전제 조건.** 운영에서 identity.mode=cookie와 모든 `path.<group>`=api가 켜져 있어야 합니다. 현재 운영 플래그 값은 이 조사에서 확인하지 않았습니다.
- **고쳐야 할 테스트.** legacy 경로를 검증하는 spec이 다음에 있습니다: `scripts/api-client.spec.ts`, `api-write-retry.spec.ts`, `api-identity-patch-client.spec.ts`, `courier-comment-text.spec.ts`, `direct-writes-policies.spec.ts`, `write-gate-equivalence.spec.ts`.

---

## 조사 5

## 6단계 빌드 시점·Worker 쪽(비 `/api`) Supabase 읽기 목록

조사만 했습니다. 파일 수정, 커밋, 배포, 플래그 변경은 하지 않았습니다. 확인용으로 운영 사이트에 공개 GET 요청을 네 번 보냈고, GitHub secret·variable은 이름만 조회했습니다.

### 요약

1. **실제로 운영에 나가는 빌드 시점 DB 읽기는 `patch:build` 한 곳**입니다. 쉘 패치 2개(2026-09-11 `wither`, 2026-11-12 `gambit`)를 14개 언어로 구울 때 두 릴의 데이터를 Supabase에서 읽습니다. 하나는 변형 최근 글 15개, 다른 하나는 다채로운 철학자들 이번 주 글과 반응 수입니다.
2. **`next build`도 같은 두 함수를 부르지만 결과물이 나가지 않습니다.** `/patches*` 요청은 main Worker가 PATCH_WORKER로 넘기고, Next가 만든 패치 페이지는 정적 페이지로 복사되지 않습니다. 그런데도 CI 배포에서 운영 게이트가 켜져 있어, Supabase 장애가 나면 main 배포가 멈춥니다.
3. **`workers/detail-shell-og.ts`의 상세 OG 보강은 운영에서 지금 꺼져 있습니다.** Worker에 `NEXT_PUBLIC_SUPABASE_URL`·`_ANON_KEY` 변수가 없기 때문입니다(tasks/010 #32). 2026-11-09에 실제 글 상세를 열어 보니 목록 기본 제목·이미지가 나왔습니다. 켜는 조건을 D1 binding(`env.DB`) 존재로 바꾸면 운영에서 OG 보강이 처음으로 켜집니다. 지금과 같게 두려면 꺼진 채로 옮겨야 합니다.
4. **`static:data`와 `cf:build`의 나머지 스크립트는 DB를 읽지 않습니다.** generator 4개, ensure-* 스크립트가 실행하는 것, collect·copy·prune, `cf:assets`를 모두 열어 봤습니다.
5. **Worker 쪽 `/api` 밖 Supabase 호출은 두 묶음입니다.** 하나는 `detail-shell-og.ts`이고, 다른 하나는 `workers/sync/*`(2단계 동기화)입니다. sync는 되돌릴 길이라 7단계까지 남깁니다.
6. **CI 토큰의 D1 권한은 확인하지 못했습니다.** `CLOUDFLARE_API_TOKEN`은 지금 `wrangler deploy`에만 쓰이고, D1 질의를 하는 CI 단계는 없습니다.
7. **계획 5.7절 문장과 "화면 그대로"가 부딪힙니다.** 5.7절은 "`next build`와 `patch:build`는 DB를 읽지 않는다, 글 데이터는 런타임 주입으로만"이라고 씁니다. 하지만 패치 페이지는 React가 hydrate하지 않는 정적 HTML입니다. 그래서 요청 시점 주입으로는 같은 화면을 만들 수 없고, 같은 화면을 지키려면 빌드 때 D1을 읽어야 합니다. **결정이 필요합니다(4절).**

---

### 1. 빌드 시점 DB 읽기

| # | 위치 | 읽는 것 | 실행하는 빌드 | 보이는 페이지 | 실패할 때 | 화면을 그대로 두는 대체 |
|---|---|---|---|---|---|---|
| B1 | `src/lib/transfigure-data.ts:7-19`(클라이언트 선택), `:34-42`(`transfigure_posts` `select *`, env, `created_at desc`, limit 15, 30초 제한), `:45-57`(운영이 아닌 env에 행이 없으면 production 행을 빌림), `:59-72`(실패하면 `BUILTIN_SAMPLE_TRANSFIGURES`) | 변형 최근 글 15개 | `patch:build` → `scripts/build-patch-worker.tsx:913-955` → `PatchDetailPage`(`src/components/patches/patch-detail-page.tsx:842-849`, `:918`) | https://scare-the-spire.flavono123.workers.dev/patches/2026-09-11 , https://scare-the-spire.flavono123.workers.dev/patches/2026-11-12 와 13개 언어 접두(`/en/patches/…` 등) | 운영 빌드면 중단, 아니면 표본 글 | 4절 A 또는 B. SQL은 `posts p CROSS JOIN post_transfigure s … WHERE p.service='transfigure' ORDER BY p.created_at DESC, p.id DESC LIMIT 15`이고, 행은 `postObject("transfigure", …)`(`workers/api/d1-adapters/toybox.ts:98-111`)로 Supabase 모양으로 바꾼 뒤 `normalizeTransfigurePost`에 넣음 |
| B2 | `src/lib/colorful-philosophers-gallery.ts:21-32`(env·주 단위 캐시), `:34-63`(`colorful_philosopher_posts`, `week_start <= 이번 KST 주`, limit 12), `:66-104`(`resource_reaction_counts`로 수를 덮어씀, 실패는 삼킴) | 다채로운 철학자들 릴(최신 주의 주제·카드·유물 글 3개와 강화·약화·재작업 수) | B1과 같음(`patch-detail-page.tsx:849`, `:864`) | B1과 같은 페이지 | 운영 빌드면 중단, 아니면 `[]` | D1 `Q_F3`(`workers/api/d1-adapters/queries.ts:310-311`), `Q_E5`(`:26-27`). D1에는 글 행의 옛 카운트 열이 없음(`d1/migrations/0006_…:122-138`). 그래서 수 읽기가 실패할 때의 대체값이 0이 됨. 수는 브라우저가 로드 뒤 다시 받으므로 첫 표시에만 차이 |
| B3 | 위 두 함수를 `next build`에서 부르는 곳: `src/app/(main)/patches/[version]/page.tsx:8-11,28`, `src/app/[gameLocale]/patches/[version]/page.tsx:13-21,34` | B1, B2와 같음 | `pnpm build`, `cf:build`(CI 배포 `cloudflare-workers.yml:270-272`, `ci.yml:59`) | **없음.** `/patches*`는 PATCH_WORKER로 감(`workers/main-worker.ts:56-66`, `:480-481`). `copy-cf-static-pages.mjs`에 patches가 없음. 개발 프록시도 `.patch-worker` 산출물을 씀(`scripts/dev-patch-proxy.mjs:304-308`) | CI 배포 job에는 Supabase 환경 변수가 있어 운영 게이트가 켜짐. Supabase 장애면 main 배포가 실패 | **읽지 않기만 하면 됨.** 화면 변화 없음. Next는 페이지를 여러 프로세스에서 생성하고 모듈 캐시는 프로세스마다 따로라 읽기가 반복될 수 있음(횟수는 재지 않음) |
| B4 | `src/app/(main)/dev/patch-types/patch-types-dev-page.tsx:130-137` | B1, B2와 같음 | `DEV_TOOLS_BUILD=1`일 때만(`next.config.ts:179`, `cf:preview`, `next dev`). 운영 빌드에서는 코드가 빠짐 | `/dev/patch-types`(개발 전용) | 같은 로더 | 같은 로더 또는 내장 표본 글 |
| B5 | `src/lib/build-supabase-read.ts:7-15`(`BUILD_SUPABASE_TIMEOUT_MS`, 30초), `:17-19`(운영 판정이 `NEXT_PUBLIC_SUPABASE_ENV === "production"`에 묶임), `:32-39`(`ALLOW_BUILD_WITHOUT_SUPABASE`) | 규칙만 있음 | B1~B4 | 없음 | 운영 빌드 중단 규칙, 우회 방법은 `docs/RELEASE_PROCESS.md:113-117` | 규칙을 유지한다면 판정 키를 다른 값으로 옮기고 변수 이름을 바꿔야 함. **CI에서 `NEXT_PUBLIC_SUPABASE_ENV`만 빼면 게이트가 소리 없이 꺼지고 표본 글이 나감** |
| B6 | `scripts/build-supabase-read.spec.ts`(`ci.yml:48`에서 실행) | 응답하지 않는 서버를 상대로 B1·B2를 시험 | CI | 없음 | 없음 | 새 읽기 방식에 맞춰 다시 쓰거나 지움 |
| B7 | `scripts/build-patch-worker.tsx:654-657` | DB 읽기는 아님. Supabase URL·anon 키·env를 모든 패치 HTML의 `sts-patch-comments-config`에 구움 | `patch:build` | 패치 페이지 전부 | 없음 | 클라이언트 정리 영역. 다만 `patch-comments-client.js:78-89`는 URL·키가 비면 `null`을 돌려주고, 그러면 `:1231-1237`에서 댓글 전체가 "unavailable"이 됨. 클라이언트를 바꾸기 전에 이 config를 빼면 안 됨 |
| B8 | `scripts/build-patch-worker.tsx:688-697` | esbuild define에 `NEXT_PUBLIC_SUPABASE_*`를 넣음. patch-rich-comments·nav-indicators·resource-patch-index 번들(`:699-742`)의 의존 그래프에 `src/lib/supabase.ts`가 들어감(예: `src/lib/nav-seen.ts:13` ← `patch-nav-indicators-client.ts`) | `patch:build` | 패치 페이지 | 없음 | 클라이언트 정리 영역(supabase-js를 지우면 이 번들의 import가 깨짐) |

`patch:build`로 구운 데이터가 지금 운영 화면 그대로라는 근거입니다. https://scare-the-spire.flavono123.workers.dev/patches/2026-11-12 에 서로 다른 `/transfigure/<id>` 링크 15개와 `data-colorful-philosophers-card` 3개가 있습니다(2026-11-09 확인).

**구운 뒤 브라우저가 무엇을 하는지(그래서 빌드 데이터가 왜 필요한지):**
- **변형 릴은 구운 그대로입니다.** 패치 페이지는 React가 hydrate하지 않습니다(`backstab-transfigure-section.tsx:25-26`). 상대 시간만 인라인 스크립트로 다시 계산합니다(`:28-56`, `:247`). 회전 스크립트는 로드할 때 카드를 한 번만 잡으므로 나중에 붙인 카드는 보이지 않습니다(`patch-comments-client.js:2002-2003`). 구운 글의 자원이 entityMap에 없으면 내장 표본 글을 보입니다(`backstab-transfigure-section.tsx:127-132`).
- **다채로운 철학자들 릴은 로드 뒤 주와 수를 다시 받습니다.** 주는 `patch-comments-client.js:1894-1943`(`api`이면 `/api/read/colorful-philosophers/reel`, 아니면 REST), 수는 `:1946-1975`에서 받습니다. 하지만 구운 글이 0개면 섹션이 아예 `null`입니다(`backstab-colorful-philosophers-section.tsx:258`). 그러면 카드 틀(`patch-comments-client.js:1794-1797`)도, 카드를 담을 영역도 없어서 다시 받아도 그릴 수 없습니다.

---

### 2. Worker 쪽(비 `/api`) Supabase 호출

#### 2.1 `workers/detail-shell-og.ts`(main Worker, 레코드 상세 쉘 HTML의 OG 보강)

- **호출 경로:** `main-worker.ts:290-311`(`maybeServeStaticServiceDetailShell`) → `maybeEnrichServiceDetailShell`(`:590-639`) → `fetchDetailShellOgData`(`:271-478`) → `fetchSupabaseRestSingleRow`(`:223-252`). 이 함수는 PostgREST에 `id=eq.&env=eq.&limit=1`로 GET 한 번을 보내고 600ms 제한을 둡니다(`:233`).
- **켜지는 조건:** `resolveSupabaseConfig`(`:197-221`)가 `env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || process.env…`와 anon 키를 찾습니다. 없으면 `:276`에서 null을 돌려줍니다.
  - 운영과 testbed Worker 변수는 `API_RUNTIME_FLAGS`(`wrangler.jsonc` vars)와 배포 때 `--var`로 넣는 `API_SUPABASE_URL/KEY/DATA_ENV`뿐이라 **꺼져 있습니다.**
  - 2026-11-09 확인: https://scare-the-spire.flavono123.workers.dev/this-or-that/98738f2a-5805-480c-97f4-6fb7603675c8 (그 시점 최신 이거 아님 저거? 글)에서 `x-cf-static-page: shell`, `<title>이거 아님 저거? - 슬서운 이야기</title>`, og:image는 목록 기본값이었습니다.
  - 메인 checkout의 로컬 `wrangler dev`는 `.env.local`을 Worker 변수로 읽어서 켜집니다(`docs/supabase-exit/SURFACE_MAP.md:1251-1257`).
- **보강이 성공했을 때만** Cache API에 1시간 넣습니다(`:620-633`). `*.workers.dev`에서는 효과가 없습니다.
- **Env 타입:** 이 파일만 쓰는 Supabase 필드가 두 곳에 있습니다(`detail-shell-og.ts:55-68`, `main-worker.ts:9-19`).
- **경로 점검:** `scripts/check-cloudflare-route-coverage.ts:126-129`가 Supabase 환경 변수를 지우고 네트워크를 막아 OG를 끈 채 돌립니다. 넘기는 env(`:144~`)에 DB가 없으므로 D1로 바꿔도 꺼진 채입니다.
- **시험:** `scripts/detail-shell-og.spec.ts:304-328`이 `stub.supabase.co`로 fetch를 바꿔치기합니다(CI에는 없음). D1 stub으로 바꿔야 합니다.

분기별 D1 대응입니다. 하나의 PK 행을 읽는 것은 `/api/read/toybox-post`의 D1 어댑터와 같습니다. `postSql(service)`(`toybox.ts:231-236`)와 `postObject`(`:98-111`)를 쓰며, 이 어댑터가 JSON 열도 풀어 줍니다. uuid 서비스는 ID를 소문자로 바꿉니다(`toybox.ts:347` 선례). Postgres uuid 비교는 대소문자를 가리지 않지만 D1 TEXT는 가리기 때문입니다.

| 분기(줄) | Supabase 표·열 | 지금 운영 결과 | D1에서 같은 결과를 내는 읽기 |
|---|---|---|---|
| history-course(`:284-309`) | `runs`: `character, cover_spec` | 꺼짐 | `Q_R5`(`queries.ts:211`). `cover_spec`은 JSON TEXT라 parse 필요 |
| c-c-c-combo, defragment-combo(`:311-335`) | `combo_posts`: `content_text, content, resources` | 꺼짐 | `postSql("combo")`. resources는 하위 질의(`toybox.ts:131-133`) |
| chemical-x, defragment-chemical_x(`:337-356`) | `chemical_posts`: `content_text, content` | 꺼짐 | `post_chemical_x` |
| this-or-that, this-or-that-tournament, defragment-this_or_that(`:358-382`) | `this_or_that_posts`: `reason, left_type, left_id` | 꺼짐. 켜져도 토너먼트 ID는 이 표에 없어 null(SURFACE_MAP 1647 버그) | `post_this_or_that`. 토너먼트 ID는 행이 없어 null로 같음 |
| transfigure, defragment-transfigure(`:384-412`) | `transfigure_posts`: `title, transformed_name, resource_type, resource_id` | 꺼짐 | `posts.title`과 `post_transfigure` |
| pagestorm, defragment-pagestorm(`:414-433`) | `pagestorm_posts`: `title, content_text, content` | 꺼짐 | `posts.title`과 `post_pagestorm`(content는 object JSON) |
| defragment(`:435-454`) | `defragment_posts` | 꺼짐. 이 표에는 행이 없었음 | 질의 없이 null(`toybox.ts:349` 선례) |
| decisions-decisions, defragment-decisions_decisions(`:456-475`) | 없는 표 `decisions_posts`, 없는 열 `situation_character` | 켜져도 늘 null(SURFACE_MAP 1646 버그) | 지금과 같게 하려면 질의 없이 null. 고치는 것은 tasks/010 대상 |
| colorful-philosophers, defragment-favorite_tournament, defragment-history_course | 분기 없음(`:477`) | null | null |

**지금과 같게 두는 조건(결정 필요):** 지금 운영 결과는 "보강 없음"입니다. 켜는 조건을 `env.DB`로 바꾸면 운영에서 기록별 OG가 켜집니다. 그러면 기록 쉘 HTML 요청(크롤러 포함)마다 D1 PK를 한 번 읽습니다. 이는 tasks/010 #32를 고치는 것이고, 그 문서 7행에 "결정 대기"로 적혀 있습니다. 운영 버그 기록 규칙대로라면 리팩토링 묶음 뒤에 고칠 대상입니다. 그래서 지금과 같게 하려면 D1 코드로 옮기되 기본으로 꺼 두는 스위치를 두어야 합니다.

#### 2.2 `workers/sync/*`(2단계 Supabase → D1 동기화, cron)

| 파일 | 하는 일 | 6단계 처리 |
|---|---|---|
| `workers/main-worker.ts:516-519` | 매분 `runSync`와 `scheduledOutboxMirror` | 남김 |
| `workers/sync/sync-env.ts:30-40` | `API_SUPABASE_URL`과 `API_SUPABASE_SECRET_KEY`로 service 설정 | 남김 |
| `workers/sync/supabase-reads.ts`(`:51-260`) | PostgREST 변경 로그·행 읽기 | 남김 |
| `workers/sync/run-sync.ts:217~` | 1분 동기화(`sync.enabled`일 때만, 5단계 전환 때 꺼짐) | 남김. 되돌리기 스크립트가 다시 켜는 되돌릴 길이고, 계획 7단계에서 지움 |
| `workers/sync/read-after-write.ts:206-219` | 1단계 쓰기 뒤 Supabase 행을 다시 읽어 D1에 반영 | 남김 |

그 밖에 `workers/security-headers.ts:19-21`과 `public/_headers:6`의 CSP `connect-src`에 `https://*.supabase.co wss://*.supabase.co`가 있습니다(양쪽 Worker 공통). DB 읽기는 아니지만 6단계 범위입니다. 패치 Worker(`workers/patch-worker.ts`, `wrangler.patch.jsonc`)에는 Supabase도 DB binding도 없습니다.

---

### 3. CI의 Supabase 확인과 환경 변수(`.github/workflows/cloudflare-workers.yml`)

| 줄 | 내용 | 영향 | 6단계에서 |
|---|---|---|---|
| 25 | `environment: cloudflare-production` | secret이 있는 곳 | – |
| 27 | `CLOUDFLARE_ACCOUNT_ID`(secrets 아니면 vars) | 실제로는 var | D1 HTTP 읽기에도 씀 |
| 29-31 | job 전체 env `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/ENV` | 모든 단계에 들어감. `next build`는 브라우저 번들에 인라인(`src/lib/supabase.ts:3-8`, `src/lib/api-identity.ts:56`. 뒤쪽은 저장된 `sb-*-auth-token` 키를 찾는 대체 경로가 있음), `patch:build`는 HTML config와 번들에 구움(B7, B8), 빌드 읽기(B1, B2)와 운영 게이트(B5)의 기준값 | 빌드 단계에는 필요 없어짐. 배포 단계(282-308)는 7단계까지 필요 |
| 32 | `ALLOW_BUILD_WITHOUT_SUPABASE: vars.…` | var가 없어 빈 값이고 게이트가 켜져 있음 | 규칙을 남기면 이름을 바꿈 |
| 150-160 | 설정 검증. 156-158이 Supabase URL·키, `ENV=production` | 배포 전 확인 | 배포 변수 확인은 남기고 빌드용은 정리. 계획상 "CI의 Supabase 확인" 제거는 7단계 |
| 169 | `patch:test` | DB 없음 | – |
| 172-190 | 패치 배포 `pnpm cf:patch:deploy` = `NEXT_PUBLIC_SUPABASE_ENV=production pnpm patch:build && wrangler deploy`(`package.json:23`). `CLOUDFLARE_API_TOKEN`(189) | **B1과 B2가 여기서 실행됨.** 토큰과 계정 ID가 이미 이 단계 env에 있음 | 4절 A를 고르면 이 단계에서 D1을 읽음 |
| 270-272 | `pnpm cf:build`(토큰 없음, job env에 Supabase 있음) | B3이 운영 게이트와 함께 실행됨 | 읽지 않게 함 |
| 282-308 | main 배포. 287-289에서 `API_SUPABASE_URL/KEY/DATA_ENV`를 `NEXT_PUBLIC_*`에서 만듦, 290은 `check-api-vars.ts`, 294-296은 `--var` | Worker 안 Supabase 어댑터·미러·sync가 씀 | 7단계까지 유지. 브라우저 인라인을 끊으려면 이 값을 이 단계의 env로만 옮기는 안이 있음 |
| 373-391 | main 뒤 패치 재배포(172-190과 같음) | B1과 B2 | 위와 같음 |

`.github/workflows/ci.yml`에는 environment가 없어 secret도 없습니다. 48행이 B6, 59행이 `cf:build`입니다. Supabase 변수가 없으니 운영이 아닌 빌드로 판정되어 표본 글로 계속 진행하고, 로그에 `THIS BUILD CONTAINS FALLBACK DATA`가 남습니다. 새 읽기 방식도 자격 증명이 없을 때 이 동작을 유지해야 합니다.

**CI 자격 증명(이름만, `gh` 조회 2026-11-09):**
- `cloudflare-production` 환경 secret: `CLOUDFLARE_API_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `cloudflare-production` 환경 variable: `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_SITE_ORIGIN`, `NEXT_PUBLIC_SUPABASE_ENV`
- 저장소 단위 secret·variable: 없음
- 참조하지만 없는 것: `ALLOW_BUILD_WITHOUT_SUPABASE`, `NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`, `CLOUDFLARE_D1_API_TOKEN`·`SUPABASE_SERVICE_ROLE_KEY`(`d1-reconcile.yml:56-57,98-99`. 그래서 정기 대조 실행은 notice를 남기고 건너뜀)
- `CLOUDFLARE_API_TOKEN`의 권한은 저장소에서 알 수 없습니다. 지금은 두 Worker의 `wrangler deploy`에만 쓰이고, D1 질의를 하는 CI 단계는 없습니다. **D1 query API를 부를 수 있는지는 확인하지 못했습니다.** 저장소 주석은 읽기 전용이면 "D1 read"로 충분하다고 보고(`scripts/d1-reload-supabase.ts:17`), 쓰는 스크립트는 "D1 edit"을 요구합니다(`d1-reconcile.ts:18`, `d1-cutover.ts:17`).
- Worker 쪽 이름: binding `DB`(slseoun-prod, testbed는 slseoun-testbed), `ASSETS`, `PATCH_WORKER`, rate limiter. var는 `API_RUNTIME_FLAGS`. 배포 var는 `API_SUPABASE_URL/KEY/DATA_ENV`. secret은 `API_SUPABASE_SECRET_KEY`, `API_IDENTITY_SECRET`(`docs/release/history/2026-11-09.md:51`)이고, 선택으로 `API_SUPABASE_LEGACY_JWT_SECRET`.

---

### 4. `patch:build` 릴 데이터의 대체안(결정 필요)

| 안 | 방법 | 화면이 같은가 | 필요한 것 | 걸리는 점 |
|---|---|---|---|---|
| **A. 빌드 때 D1 HTTP API** | 기존 `scripts/d1-sync/d1-http-client.ts:61-104`와 `d1DatabaseId`(`scripts/d1-sync/reconcile.ts:63-76`), 1절의 SQL | 같음 | `CLOUDFLARE_ACCOUNT_ID`(있음)와 D1 질의 권한이 있는 토큰. 기존 `CLOUDFLARE_API_TOKEN`(권한 미확인. 172-190과 373-391 단계에 이미 있음)을 넓히거나 새 secret `CLOUDFLARE_D1_API_TOKEN`(없음)을 둠. testbed 빌드(`run-cloudflare-testbed.mjs:309-311`)는 slseoun-testbed와 OAuth 또는 토큰 | 5.7절의 "빌드는 DB를 읽지 않는다"와 충돌. B5의 운영 게이트를 다른 키로 옮겨야 함. 운영이 아닌 env가 production 행을 빌리던 동작(`transfigure-data.ts:45-57`)은 DB가 나뉘어 사라짐 |
| **B. 빌드 때 배포된 같은 출처 `/api`** | `NEXT_PUBLIC_SITE_ORIGIN`(있음)으로 `/api/read/toybox-feed?service=transfigure&sort=latest`(20개 중 앞 15개, 행 모양은 `{id,…,post}`), `/api/read/colorful-philosophers/reel`, `/api/read/engagement?reactions=…` | 같음(데이터는 `source.<group>`이 고른 저장소) | 새 secret 없음 | 간접적이지만 여전히 빌드가 DB에 기댐. 배포된 main Worker가 떠 있어야 함(CI는 패치를 먼저 배포하므로 직전 main 버전을 읽음). testbed는 testbed 주소가 필요 |
| **C. 요청 시점 주입(5.7절 문장 그대로)** | `main-worker.ts:480-481`에서 PATCH_WORKER 응답을 가로채 D1을 읽고 HTMLRewriter로 넣음(패치 Worker에는 DB binding이 없음) | **다름. 새 기능 작업** | Worker 안에서 TransfigurePostCard·릴 카드 HTML을 그리거나 새 클라이언트 렌더러 | 패치 페이지는 hydrate하지 않음. 변형 회전은 나중 카드를 받지 못함. 철학자 릴은 구운 글이 0개면 영역 자체가 없음(1절) |

`next build`(B3)는 어떤 안이든 "읽지 않음"으로 바꾸면 됩니다. 결과물이 나가지 않으니 화면 변화가 없습니다.

---

### 5. 따로 하면 깨지는 것

- B5 게이트는 `NEXT_PUBLIC_SUPABASE_ENV`(`build-supabase-read.ts:18`, `package.json:23`, CI 31행)에 묶여 있습니다. 이 env를 먼저 빼면 표본 글이 경고 없이 나갑니다.
- B7의 패치 HTML config를 클라이언트보다 먼저 빼면 패치 페이지 댓글이 전부 "unavailable"이 됩니다(`patch-comments-client.js:78-89,1231-1237`). nav 스냅샷의 env 비교(`:1621-1628`)도 이 값을 씁니다.
- CI 29-31행을 지우면 배포 단계(287-289)가 쓰는 `API_SUPABASE_*`도 사라집니다. Worker 어댑터·미러·sync가 7단계까지 쓰므로 그 전에 이 값을 따로 받게 해야 합니다.
- `transfigure-data.ts:1,3`, `colorful-philosophers-gallery.ts:1,10`, `src/lib/toybox-post-og-fields.ts:3`이 supabase-js를 import합니다. 마지막 파일은 상세 페이지 `generateMetadata`에서 부르지만 `metadataRecordId`가 `__id__`를 걸러서 빌드 때 질의는 없습니다(`src/lib/static-detail-shell.ts`, 호출부는 `src/app/{transfigure,c-c-c-combo,chemical-x,this-or-that,pagestorm}/[id]/page-content.tsx`의 33-43행, `defragment/[id]/page-content.tsx:33`, `defragment/[id]/[postId]/page-content.tsx:51`). 그래도 패키지를 지우면 빌드가 깨지므로 같이 정리해야 합니다.
- `scripts/check-cloudflare-worker-size.mjs:73`의 supabase-js 유입 검사는 패키지를 지운 뒤에도 그대로 둬도 됩니다.

---

## 조사 6

# 6단계 인벤토리: CSP·헤더·설정·개발 도구

경로는 모두 `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/` 기준이고, 맨 끝에 절대 경로 목록을 따로 붙였다. 읽기만 했다. 파일 수정·커밋·배포·플래그 변경은 하지 않았다. 작업 트리에 원래 있던 변경(`package.json`의 `d1:exercise` 한 줄, `scripts/d1-exercise-writes.ts`)에도 손대지 않았다. import 그래프는 저장소의 esbuild로 metafile을 뽑아 확인했고, 그 스크립트는 scratchpad에 두었다.

## 0. 요약
- **CSP는 두 곳에만 있다:** `workers/security-headers.ts:21`과 `public/_headers:6`. 두 값은 바이트까지 같아야 한다. 정책은 Report-Only이고 `report-uri`나 `report-to`가 없다. 그래서 `*.supabase.co`를 빼도 막히는 요청은 없다. 위반은 브라우저 콘솔과 `cloudflare-testbed.spec.ts` afterEach에서만 드러난다.
- **`@supabase/supabase-js`를 import하는 파일은 `src/` 안의 6개뿐이다.** `workers/`와 `scripts/`에는 하나도 없다. Worker는 fetch 기반 PostgREST 어댑터를 쓰고, 스크립트는 fetch, pglite, `supabase` CLI를 쓴다. 이 6개를 정리하면 `package.json:87`과 lock에 있는 패키지 8개를 모두 지울 수 있다.
- **이름에 Supabase가 들어간 env(`NEXT_PUBLIC_SUPABASE_ENV`, 코드에서는 `supabaseEnv`)는 Supabase와 상관없는 용도로도 브라우저 전역에서 쓰인다.** 저장소 키, 스냅샷 검증 같은 것들이다. `src/lib/supabase.ts`를 지우려면 이 값을 다른 곳으로 옮겨야 한다(5절).
- **`pnpm dev`와 `qa:mobile`에는 Worker `/api`가 없다.** 그래서 지금은 legacy 경로로만 데이터를 본다. legacy를 지우면 로컬 dev에서는 데이터를 볼 길이 없다.
- **QA 차단은 두 겹이다:** 브라우저 DNS 차단과 `slseoun_qa=no-supabase` 쿠키. 이 쿠키가 있으면 Worker는 모든 `/api`에 409 legacy를 돌려준다. 6단계 뒤에는 DNS 차단이 할 일이 없어진다. 쿠키는 D1 읽기까지 409로 만든다.

## 1. CSP와 보안 헤더

| 위치 | 하는 일 | 6단계 |
|---|---|---|
| `workers/security-headers.ts:11-29` | `CONTENT_SECURITY_POLICY` 배열 | — |
| `workers/security-headers.ts:19` | 주석 "The Workers have no env vars, so Supabase cannot name the project host."(와일드카드를 쓰는 이유) | 지운다 |
| `workers/security-headers.ts:20` | YouTube oEmbed 주석 | 그대로 둔다 |
| `workers/security-headers.ts:21` | `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cloudflareinsights.com https://www.youtube.com` | `https://*.supabase.co`와 `wss://*.supabase.co`를 둘 다 뺀다 |
| `workers/security-headers.ts:7-9`, `:36` | 헤더 이름이 `Content-Security-Policy-Report-Only`다. 강제하려면 두 곳의 이름을 바꾸고 `upgrade-insecure-requests`를 더해야 한다 | 바꾸지 않는다 |
| `workers/security-headers.ts:33` | `Referrer-Policy: strict-origin-when-cross-origin`. 6단계 넘어갈 조건("Supabase 로그에 운영 referer 0건", plan 487행)은 이 정책이 origin을 referer로 붙여 주는 데 기댄다 | 그대로 둔다 |
| `workers/security-headers.ts:40-46` | `withSecurityHeaders`: Worker가 직접 만드는 응답에 헤더를 붙인다 | 없음 |
| `public/_headers:1-6` | `/*` 전역 규칙. 6행이 같은 CSP 문자열이다 | `:21`과 같은 문자열로 동시에 고친다 |
| `workers/main-worker.ts:44,525,528` | `/api`와 `routeRequest`를 감싼다 | 없음 |
| `workers/patch-worker.ts:3,59,61` | 패치 Worker도 같은 헤더를 쓴다 | 없음. 다만 패치 Worker는 따로 배포되므로 CSP 변경은 main과 패치 두 배포에 모두 실린다. 되돌릴 때도 두 Worker 버전을 다 되돌려야 한다 |
| `scripts/copy-patch-worker-assets.mjs:83-95` | `public/_headers` 전역 규칙으로 `.patch-worker/assets/_headers`를 만든다 | 따로 할 일 없이 반영된다 |
| `next.config.ts:93-169` `headers()` | 캐시 헤더만 있다. CSP와 Supabase 항목은 없다 | 없음 |
| `vercel.json`, middleware | 없다. CSP의 원천은 위 두 파일뿐이다 | — |

`*.supabase.co`로 브라우저에서 직접 나가는 요청이 다 없어져야 빼도 깨끗하다. 남아 있으면 Report-Only라서 콘솔 경고만 나지만, testbed spec은 실패한다.
- **`wss://`(Realtime 채널, legacy 경로에서만 연다):** `src/hooks/use-toybox-feed.ts:103,135`, `src/hooks/use-community-stories.ts:177,212`
- **`https://`:** `src/lib/supabase.ts:20-22` 클라이언트, `src/components/patches/patch-comments-client.js:438`(`/auth/v1`), `:501`(`/rest/v1`)
- **빌드된 HTML:** 패치 페이지마다 `sts-patch-comments-config`에 Supabase URL과 키가 박힌다(`scripts/build-patch-worker.tsx:654-657`, esbuild define은 `:691-693`).

## 2. 헤더 검사와 게이트

| 위치 | 검사하는 것 | 6단계 |
|---|---|---|
| `scripts/security-headers.spec.ts:31-44` | `public/_headers`와 인자로 받은 빌드 디렉터리의 `_headers`가 `SECURITY_HEADERS`와 deepEqual인지, 규칙 수와 줄 길이 한도 | Supabase 문자열은 없다. 두 파일을 똑같이 고치면 그대로 통과한다 |
| `scripts/security-headers.spec.ts:59-109` | 리다이렉트, 304, main Worker 경로 10개, 패치 Worker 2개가 헤더를 보내는지 | 없음 |
| `package.json:14` `cf:assets` | `.cloudflare/assets`에 대해 spec을 돌린다 | 자동 |
| `package.json:31` `patch:build` | `.patch-worker/assets`에 대해 spec을 돌린다 | 자동 |
| `package.json:57`, `.github/workflows/ci.yml:40` | `test:security-headers` | 자동 |
| `scripts/cloudflare-route-smoke.mjs:10,489` | 배포된 응답의 헤더를 로컬 `public/_headers`와 비교한다(`--no-security-headers`로 끌 수 있다) | 이전 버전으로 되돌린 Worker를 smoke하면 CSP가 달라 실패한다. 그때는 이 옵션이 필요하다 |
| `scripts/cloudflare-testbed.spec.ts:48-71` | 열어 본 모든 페이지의 `securitypolicyviolation`을 모아 비어 있어야 통과한다 | 남은 Supabase 호출을 잡아 주는 가드가 된다 |
| `scripts/check-cloudflare-worker-size.mjs:67-77` | Worker 번들에 `GoTrueClient`, `SupabaseClient`, `@supabase/`, `realtime-js`가 있으면 실패한다 | 그대로 둔다. 클라이언트 번들(`.cloudflare/assets/_next/static`, `.patch-worker/assets`)을 검사하는 같은 가드는 지금 없다 |

참고로 로컬 `.cloudflare` 빌드는 다른 커밋(`11bed990`, build-record 기준)에서 만든 것이다. 그 빌드에서 supabase-js 코드는 `_next/static/chunks/6309-7376a2b82f21f1e3.js`(206,471 B)와 `50bd6b7f-8da073e9d77c03d1.js`(67,460 B, gzip 14,364 B)에 있었다. 문자열 `supabase.co`는 청크 4개와 패치 HTML 전부에서 나온다.

## 3. 설정

| 위치 | 내용 | 6단계 |
|---|---|---|
| `package.json:87` | `"@supabase/supabase-js": "^2.118.0"`(dependencies) | 4절의 6개 파일을 정리한 뒤 지운다 |
| `pnpm-lock.yaml:17-19`, `:2057-2083`, `:6596-6630`, `iceberg-js` `:3504,6617,8194` | supabase-js와 그 하위 패키지(auth-js, functions-js, phoenix, postgrest-js, realtime-js, storage-js, iceberg-js). 다른 패키지는 이것들에 의존하지 않는다 | 함께 빠진다 |
| `package.json:23` `cf:patch:deploy` | `NEXT_PUBLIC_SUPABASE_ENV=production pnpm patch:build` | data env 라벨로 계속 필요하다(5절) |
| `package.json:58` `test:api` | api-client, api-identity-client, api-identity-patch-client spec을 포함한다(9절) | spec을 고친다 |
| `next.config.ts` | Supabase 항목이 없다. `:171-179`에서 `DEV_TOOLS_BUILD`를 빌드 시점에 넣는다(dev 페이지 제거용) | 없음 |
| `wrangler.jsonc:14-23` | 주석: `"off"`이면 모든 화면이 legacy이고, `API_SUPABASE_*`는 `--var`로 넘긴다. vars에는 `API_RUNTIME_FLAGS`만 있다 | 6단계 뒤에는 "legacy"가 클라이언트에 없다. 주석과 kill switch의 의미를 다시 정해야 한다(10절) |
| `wrangler.patch.jsonc` | Supabase 항목이 없다 | 없음 |
| `.github/workflows/cloudflare-workers.yml:29-32` | build env로 `NEXT_PUBLIC_SUPABASE_URL`, `_ANON_KEY`, `_ENV`, `ALLOW_BUILD_WITHOUT_SUPABASE`를 둔다 | `ALLOW_BUILD_WITHOUT_SUPABASE`는 빌드 시점 읽기가 사라지면 함께 지운다 |
| `.github/workflows/cloudflare-workers.yml:152-158` | URL과 키가 있는지, env가 production인지 확인한다 | URL과 키는 아래 Worker 변수의 원천이라 7단계까지 남긴다 |
| `.github/workflows/cloudflare-workers.yml:285-295` | `API_SUPABASE_URL`과 `API_SUPABASE_KEY`를 `NEXT_PUBLIC_*`에서 만들어 `--var`로 넘기고 `scripts/check-api-vars.ts`로 검사한다 | 남긴다. 이 값이 없으면 `flagsDisabledReason`이 `not_configured`가 되어 D1을 쓰는 경로까지 모든 `/api`가 legacy가 된다(`workers/api/flags.ts:138-142`) |
| `.github/workflows/ci.yml:46,48` | `test:api`, `build-supabase-read.spec.ts` | `:48`은 빌드 시점 읽기와 함께 지운다 |
| `.github/workflows/d1-reconcile.yml:51-61,101` | 스크립트용 service 키 | 7단계까지 둔다 |
| `scripts/check-api-vars.ts:9,18-33` | Worker 변수 형식 검사 | 7단계까지 둔다 |
| `scripts/check-cloudflare-route-coverage.ts:126-129` | Supabase env 키 4개를 지우고 fetch를 막아, 상세 OG 조회가 꺼진 상태로 확인한다 | OG가 D1 binding으로 옮겨지면 이 키 삭제는 의미가 없다. binding이 없는 상태로 확인하도록 맞춘다 |
| `.env.local.example:1-4` (`:6-19`는 CLI) | `NEXT_PUBLIC_SUPABASE_URL`, `_ANON_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_ENV=development` | 7단계 정리 대상(plan). 6단계에서는 `_ENV`만 계속 쓰인다 |
| `workers/main-worker.ts:13-18`, `workers/detail-shell-og.ts:62-67,197-221` | Worker env 타입과 OG 설정(`NEXT_PUBLIC_SUPABASE_*` 다음 `SUPABASE_*` 다음 `process.env` 순서). wrangler 쪽에서는 이 값들을 넣지 않는다 | OG를 D1으로 옮길 때 지운다(SURFACE_MAP 584행: 운영과 testbed에서 꺼져 있다. Cloudflare에서 직접 확인하지는 못했다) |

## 4. `@supabase/supabase-js` import 현황

| 파일 | 실행 위치 | 무엇을 하나 | 정리 뒤 |
|---|---|---|---|
| `src/lib/supabase.ts:1,20-22` | 브라우저와 빌드 시 Node | anon 클라이언트. import만 해도 생성된다 | 지운다 |
| `src/lib/transfigure-data.ts:1,7-19` | 빌드 시(`patch-detail-page.tsx:848`, dev `patch-types`) | 빌드 시점 DB 읽기 | 빌드 시점 읽기를 없애면서 지운다 |
| `src/lib/colorful-philosophers-gallery.ts:1` | 빌드 시(`patch-detail-page.tsx:849`) | 빌드 시점 DB 읽기 | 위와 같다 |
| `src/app/(main)/dev/admin/admin-dev-page.tsx:8` | next dev 서버(`import "server-only"`, `:1`) | service 키 클라이언트 | 6.1절 |
| `src/app/(main)/dev/colorful-philosophers/actions.ts:3` | next dev 서버 액션 | service 키 upsert | 6.1절 |
| `src/app/api/dev/contact-inbox/route.ts:21` | next dev 라우트(동적 import) | service 키 count | 6.1절. 이 라우트가 남아 있으면 `next build`가 모듈을 풀어야 하므로 패키지가 남아야 한다 |

`workers/`와 `scripts/`에서 supabase-js를 쓰는 곳은 없다. grep으로는 `createClient`가 0건이고, 남은 매치는 `check-cloudflare-worker-size.mjs:73`의 가드 정규식뿐이다. Worker가 남기는 Supabase 경로는 fetch로 되어 있다: `workers/api/supabase-rest.ts`, `workers/sync/supabase-reads.ts`, `workers/api/identity/supabase-signup.ts`, `workers/api/supabase-jwks.ts`, `workers/api/d1-write/mirror.ts`. 스크립트는 `scripts/d1-sync/*`, `scripts/lib/supabase-pglite.ts`, `supabase` CLI를 쓴다. 그래서 7단계 전에도 패키지를 지울 수 있다. 막는 것은 위 dev 파일 3개뿐이다.

## 5. Supabase 이름 env와 `src/lib/supabase.ts` export의 다른 용도

`lib/supabase.ts`를 지울 때 옮겨야 할 것들이다. 그래서 `NEXT_PUBLIC_SUPABASE_ENV`는 build env에 남거나 이름을 바꿔야 한다. 넣는 곳은 GHA `:31,:158`, `package.json:23`, `scripts/run-cloudflare-testbed.mjs:42,309`이다.
- **저장소와 캐시 키:**
  - `src/lib/nav-seen.ts:94-102,257`
  - `src/hooks/use-mailbox-reply.ts:6,14`
  - `src/hooks/use-puzzlebox-scores.ts:101,204,281`
- **env 검증과 선택:**
  - `src/lib/nav-snapshot.ts:4,50`
  - `src/lib/run-donation.ts:57-58,89-93`
  - `src/hooks/use-colorful-philosopher-posts.ts:37,49`
- **dev 화면 표시:** `nav-indicators-dev-page.tsx:13,71`, `colorful-philosophers-dev-page.tsx:22,126-128`
- **패치 클라이언트:** `patch-comments-client.js:1622-1624`가 env를 읽는다. 값은 `build-patch-worker.tsx:654-657`이 넣는다.
- **claim:** `src/lib/api-identity.ts:56`은 `NEXT_PUBLIC_SUPABASE_URL`로 localStorage 키 `sb-<ref>-auth-token`을 만든다. 값이 없으면 `:64-67`에서 정규식으로 찾는다. 이 파일은 supabase-js를 import하지 않는다(`:20`). plan 5.3대로 7단계까지 둔다.
- **다른 export:** `isCheckViolation`(`lib/supabase.ts:11-13`)은 `use-combo-posts.ts:13`과 `use-transfigure-posts.ts:10`이 쓴다. `supabaseClientOptions`(`:18`)는 `transfigure-data.ts:3`과 `colorful-philosophers-gallery.ts:10`이 쓴다.

## 6. 개발 도구

### 6.1 `/dev` 페이지와 `/api/dev` 라우트
운영 빌드에서는 모두 빠진다. 페이지는 `DEV_TOOLS_BUILD`나 `NODE_ENV` 분기로, 라우트는 `devToolsEnabled()`(`src/lib/dev-tools.ts:1-5`)로 막힌다. secret 키는 next dev 서버 안에만 있고 브라우저로 나가지 않는다.

| 위치 | Supabase를 쓰는 방식 |
|---|---|
| `dev/admin/page.tsx:20-49` | `DEV_TOOLS_BUILD`일 때만 `admin-dev-page`를 import한다 |
| `admin-dev-page.tsx:154-167` | `NEXT_PUBLIC_SUPABASE_URL`과 `SUPABASE_SECRET_KEY`(또는 `SERVICE_ROLE_KEY`)로 클라이언트를 만든다 |
| `admin-dev-page.tsx:169-182` | 문의 읽기(`reply_email` 포함) |
| `admin-dev-page.tsx:184-205` | anon `supabase`로 comments 읽기 |
| `admin-dev-page.tsx:249-537` | anon으로 글 테이블 9개 읽기(267, 298, 332, 372, 402, 432, 462, 492, 518행) |
| `admin-dev-page.tsx:539-567` | RPC `get_rls_activity_metrics`(`:548`). D1에 대응하는 것이 없다 |
| `admin-dev-page.tsx:584-641` | 닉네임 풀 읽기와 upsert |
| `admin-dev-page.tsx:643-719` | 서버 액션 3개: 닉네임 저장과 초기화, 문의 답변 update |
| `admin-dev-page.tsx:880-883,939`, `src/components/dev/admin-profile-nicknames.tsx:132` | 화면 문구에 Supabase env 이름이 나온다 |
| `dev/colorful-philosophers/page.tsx:8-17` | NODE_ENV=development일 때만 |
| `dev/colorful-philosophers/actions.ts:20-28,49-58,83-98` | service 키로 `colorful_philosopher_posts` upsert(`onConflict env,week_start,slot`) |
| `colorful-philosophers-dev-page.tsx:7,9,22,126-128,210` | legacy 훅 `useColorfulPhilosopherWeek(targetEnv)`로 다른 env도 읽는다 |
| `dev/nav-indicators/nav-indicators-dev-page.tsx:13,71` | `supabaseEnv`를 화면에 표시만 한다 |
| `dev/courier-tokens/courier-tokens-dev-page.tsx` | `comment-courier.tsx`를 거쳐 lib/supabase로 이어진다 |
| `dev/editors/editors-dev-page.tsx` | `comment-section.tsx`와 `use-auth.ts`를 거쳐 lib/supabase로 이어진다 |
| `dev/toybox-preview/toybox-preview-dev-page.tsx:34,48,68` | `lib/defragment-feed`와 `lib/toybox-feed`(legacy)를 쓰고 `/api/dev/history-course-runs`를 부른다 |
| `dev/patch-types/patch-types-dev-page.tsx:14,18,135-136` | 빌드 시점 리더 두 개를 요청 시점에 부른다 |
| `src/app/api/dev/contact-inbox/route.ts:13-36` | service 키로 `status=new` 문의 수를 센다. 호출: `src/hooks/use-dev-contact-inbox.ts:45`, `src/components/site-navbar.tsx:17,797` |
| `src/app/api/dev/history-course-runs/route.ts:33-57` | anon으로 운영 runs 100행. 호출: `src/components/history-course/prod-runs-dev-section.tsx:78`, `toybox-preview-dev-page.tsx:68` |
| `src/app/api/dev/history-course-runs/[runId]/route.ts:42-66` | anon으로 운영 run 1행. 호출: `prod-runs-dev-section.tsx:121` |
| `src/lib/run-donation.ts:89-93` | dev 도구가 켜져 있고 env가 production이 아니면 운영 행도 legacy로 읽는다 |

plan 5.7은 문의, 닉네임 풀, 활동 지표를 로컬 스크립트(`wrangler d1 execute --remote`)로 옮기라고 한다. 나머지 dev 페이지는 legacy 모듈을 쓰므로 그 모듈이 바뀌면 함께 바뀐다.

### 6.2 로컬에서 실행하는 도구
- **`pnpm dev`(`package.json:7`, `scripts/dev-patch-proxy.mjs`):**
  - `:174-216`에서 처음에 `patch:build`를 돌린다(빌드 시점 DB 읽기).
  - `:444-451`에서 패치 경로가 아닌 요청, 즉 `/api/*`를 next dev로 넘긴다(`:354-375`).
  - next dev에 있는 `/api`는 `src/app/api/{link-preview,dev/*}`뿐이다.
  - `src/lib/runtime-flags.ts:9-12`: 쿠키가 없으면 legacy다. legacy를 지우면 로컬 dev는 모든 커뮤니티 화면이 DB 응답 없음 상태가 된다.
- **`qa:mobile`·`dev:mobile`(`package.json:9-10`, `scripts/mobile-qa.mjs:82-90,150`):** next dev와 headed Chromium을 띄운다. Supabase 차단도 QA 쿠키도 없다. `pnpm dev`와 같은 문제가 생긴다.
- **`cf:preview`(`package.json:16`):** wrangler dev를 쓰지만 `API_SUPABASE_*`를 넘기지 않는다. 그러면 `not_configured`가 되어 모든 `/api`가 legacy일 가능성이 높다. 메인 checkout에 `.dev.vars`가 있는데 읽지 않았다(비밀값).
- **`cf:testbed:local --api`(`scripts/run-cloudflare-testbed.mjs:26-31,105-132,398-402`):** 데이터가 보이는 유일한 로컬 경로다. `.env.local`의 `NEXT_PUBLIC_SUPABASE_*`로 Worker 변수를 만든다.
- **`worldcup:seed`(`package.json:79`, `scripts/seed-favorite-tournament-builtins.ts:119-121`):** `supabase db query --linked`로 Supabase에 직접 쓴다.
- **`research/history-course-covers/harvest.mjs`:** Supabase URL, anon 키, secret 키를 쓴다. 연구용이고 배포되지 않는다.

## 7. QA의 Supabase 차단

| 위치 | 하는 일 | 6단계 뒤 |
|---|---|---|
| `playwright.config.ts:4,33-53` | `PLAYWRIGHT_BLOCK_SUPABASE=1`이면 `--host-resolver-rules=MAP *.supabase.co ~NOTFOUND`(`:38`)와 쿠키 `slseoun_qa=no-supabase`(`:41-42`)를 넣는다 | DNS 차단은 할 일이 없다. 쿠키는 D1 읽기까지 409로 만든다 |
| `scripts/run-cloudflare-testbed.mjs:261` | `qa:cf:testbed`에 `PLAYWRIGHT_BLOCK_SUPABASE=1`을 준다 | 같다 |
| `.codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs:40-42,59-65,69,108-111,573-574` | 기본으로 DNS 차단과 QA 쿠키를 넣고, `--allow-supabase`로 끈다(수정 금지) | 같다 |
| `.codex/skills/mobile-viewport-qa/SKILL.md:79` | 차단 설명(수정 금지) | 문구가 낡는다 |
| `scripts/cloudflare-testbed.spec.ts:81-85` | `page.route`로 `*.supabase.co`를 끊고 쿠키를 넣는다. 주석은 "sends them back to legacy" | 9절 |
| Worker의 쿠키 처리: `workers/api/flag-cookie.ts:57-72,85-92,124`, `workers/api/router.ts:226-227`, `workers/api/identity/claim.ts:136-137`, `src/lib/api-surfaces.ts:45-47` | 쿠키가 있으면 페이지 그룹을 비우고, `/api`는 legacy("qa") 409, claim도 legacy | 10절의 결정 2 |
| 문서: `docs/SUPABASE_EXIT_PARALLEL_WORK.md:60-61`, `docs/supabase-exit/STEP1_DESIGN.md:223-226,796-797` | 차단 규칙 | 낡는다 |

## 8. Storybook
- **설정:** `.storybook/main.ts`, `.storybook/preview.tsx`. Supabase mock은 없다. env가 없으면 `supabase`가 null로 떨어지고, 그 상태로 렌더한다.
- **lib/supabase.ts까지 닿는 스토리 두 개:**
  - `src/stories/engagement.stories.tsx`: `index-card-engagement.tsx`, `like-button.tsx`, `use-likes.ts`를 거쳐 닿는다.
  - `src/stories/feed-controls.stories.tsx`: `feed-sort-toggle.tsx`를 거치고, 직접 `import type`하는 `lib/toybox-feed.ts`를 거쳐 닿는다.
- 두 모듈이 바뀌면 함께 따라간다. 나머지 스토리 11개는 닿지 않는다.

## 9. legacy 동작을 단언하는 spec과 test

**A. 의미가 바뀌어서 고쳐야 하는 것**

| spec | 위치 | 내용 |
|---|---|---|
| `scripts/api-client.spec.ts` (`test:api`, CI) | `:28-40` | `surfacePath`의 legacy 기본값과 demote |
| | `:42-92` | `SurfaceLegacyError`, `writeMayGoLegacy`, legacy 신호 뒤 demote |
| | `:142-144` | "snapshot vs legacy" 동등성 주석 |
| | `:186-189,245-254,313-317` | engagement와 profile의 legacy 신호 |
| `scripts/api-identity-client.spec.ts` (`test:api`) | `:35-38` | 진짜 supabase-js를 가짜 저장소에 붙인다. 패키지를 지우면 import 단계에서 깨진다 |
| | `:162-165,175,203` | legacy claim 응답이면 Supabase bearer 토큰 경로로 간다 |
| | `:233` | supabase-js 타이머 때문에 `process.exit`를 부른다 |
| `scripts/api-identity-patch-client.spec.ts` (`test:api`) | `:13-14` | supabaseUrl과 키가 든 CONFIG, `AUTH_KEY` |
| | `:91-139` | Supabase 세션 유지, supabase-js용 세션 저장, legacy이면 토큰 경로 |
| `scripts/contact.spec.ts` (Playwright `playwright.config.ts:27`, next dev 대상) | `:19-52` | 가짜 HS256 Supabase 세션 |
| | `:117-121,153-171` | `**/auth/v1/signup`, `**/rest/v1/contact_inquiries` mock(legacy 문의 경로) |
| | `:187-191` | `/dev/admin` 렌더 |
| `scripts/cloudflare-testbed.spec.ts` (`qa:cf:testbed`) | `:81-85` | `blockSupabase` |
| | `:398-406` | "Supabase failure uses the shared unavailable state": legacy 경로가 실패해야 성립한다 |
| | `:408-450` | Supabase 없이 IndexedDB 런 재생 |
| | `:349,455,480` | `blockSupabase`를 쓰는 다른 곳 |
| | `:48-71` | CSP 위반 0건 확인(가드로 유지) |
| `scripts/build-supabase-read.spec.ts` (`ci.yml:48`) | `:26-63` 전체 | 빌드 시점 Supabase 읽기와 `ALLOW_BUILD_WITHOUT_SUPABASE`. 빌드 읽기를 없애면 함께 지운다 |
| `scripts/detail-shell-og.spec.ts` (CI에 없음) | `:305-328` | fetch stub과 `stub.supabase.co`. D1 binding mock으로 바꾼다 |
| `scripts/check-cloudflare-route-coverage.ts` (`cf:assets`) | `:126-129` | 3절 |

**B. 지금은 import 단계에서 `src/lib/supabase.ts`까지 닿는 것.** 모듈만 고치면 통과하고, 파일을 지우기만 하면 깨진다. esbuild metafile로 확인했다.
- **연결된 것:**
  - `api-client.spec.ts`, `api-identity-client.spec.ts`, `build-supabase-read.spec.ts`
  - `scripts/check-patch-pending-links.tsx`(`patch:test`가 돌린다, `package.json:37`, CI와 배포 둘 다): `patch-note-with-story-actions.tsx`, `story-composer-modal.tsx`를 거친다
  - `scripts/build-patch-worker.tsx`(`:1` 주석, 빌드 리더)
- **연결되지 않은 것(직접 돌리는 것):** `admin-rls-activity`, `defragment-feed`, `defragment-submit`, `dev-toybox-preview`, `history-course-index-sort`, `nav-seen`, `pagestorm`, `sts1-nav`, `toybox-feed`, `toybox-nav`의 `.spec.ts`, `scripts/check-search-canonical.ts`

**C. Worker 쪽 legacy(409) 단언.** Worker 어댑터가 남는 동안에는 유효하다. QA 쿠키나 kill switch의 의미를 바꾸면 함께 고친다.
- `scripts/api-worker.spec.ts:296,399-416,578-595`
- `scripts/api-identity.spec.ts:369,453`
- `scripts/api-comments.spec.ts:656-658`
- `scripts/cloudflare-route-smoke.mjs:329-337`(모르는 `/api` 경로에 409 `surface_legacy`)

**D. `scripts/security-headers.spec.ts`:** Supabase 문자열이 없다. 2절대로 바꿀 것이 없다.

## 10. 이 영역에 걸리는 다른 영역의 위험과 결정할 것

1. **Worker의 legacy 신호를 받을 곳이 클라이언트에 없어진다.**
   - legacy 409를 만드는 경우:
     - kill switch `off`나 `not_configured`(`workers/api/flags.ts:138-142`, `wrangler.jsonc:14-17`)
     - `path.<group>=legacy`. `scripts/runtime-flags.ts:8,39,64`가 아직 `legacy`를 받는다.
     - D1 플래그를 읽지 못함(`workers/api/router.ts:233-241`)
     - QA 쿠키나 `no_route`
   - 6단계 뒤에는 이 경우마다 화면이 그냥 깨진다. plan의 6단계 되돌리기는 "클라이언트는 이전 Worker 버전으로"다.
   - 그래서 세 가지가 필요하다. 클라이언트가 409를 unavailable로 다룬다. CLI에서 `legacy`를 막는다. `API_SUPABASE_*` 변수는 7단계까지 계속 넘긴다.
2. **QA 쿠키를 어떻게 할지:** `no-supabase`는 지금 D1 읽기까지 409로 만든다. "Worker가 Supabase를 부르지 않는다"는 뜻으로 좁힐지, 지금대로 둘지 정해야 한다. 정하면 `cloudflare-testbed.spec.ts:398-406`이 무엇을 흉내 낼지(예: `/api/**`를 503으로)도 정해진다.
3. **dev와 관리 쓰기가 D1을 건너뛴다.** 대상은 `admin-dev-page.tsx:624-641,681-719`, `colorful-philosophers/actions.ts:83-98`, `seed-favorite-tournament-builtins.ts:119-121`이다. 이들은 service 키로 Supabase에 바로 쓴다. 5단계에서 `source.<group>=d1`이 된 뒤에는 2단계 동기화가 꺼지므로, 운영자 답변, 닉네임 풀, 철학자 글이 사용자에게 보이지 않는다. 운영은 지금 1·2단계이므로(`docs/release/UNRELEASED.md:13`) 아직 생기는 문제는 아니다.
4. **로컬 dev에서 데이터를 볼 경로를 정해야 한다.** `dev-patch-proxy.mjs`가 `/api`를 wrangler dev로 넘기게 할지, DB 없음 상태를 받아들일지 정한다.
5. **skill 안내가 낡는다:** `.codex/skills/feature-implementation/SKILL.md:39-41,243,327`은 "브라우저에서 Supabase로 읽기"를 지시한다. `AGENTS.md:143`은 `StorageUnavailableNotice`를 "Supabase 저장소/조회 불가 UI"라고 부른다.

## 주요 파일 절대 경로
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/security-headers.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/public/_headers
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/security-headers.spec.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/copy-patch-worker-assets.mjs
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/cloudflare-route-smoke.mjs
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/check-cloudflare-worker-size.mjs
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/check-cloudflare-route-coverage.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/package.json
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/pnpm-lock.yaml
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/next.config.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/wrangler.jsonc
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/.github/workflows/cloudflare-workers.yml
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/.github/workflows/ci.yml
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/.env.local.example
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/supabase.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/transfigure-data.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/colorful-philosophers-gallery.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/app/(main)/dev/admin/admin-dev-page.tsx
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/app/(main)/dev/colorful-philosophers/actions.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/app/api/dev/contact-inbox/route.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/app/api/dev/history-course-runs/route.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/dev-patch-proxy.mjs
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/mobile-qa.mjs
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/run-cloudflare-testbed.mjs
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/playwright.config.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/.codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/cloudflare-testbed.spec.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/contact.spec.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/api-client.spec.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/api-identity-client.spec.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/api-identity-patch-client.spec.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/build-supabase-read.spec.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/detail-shell-og.spec.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/.storybook/main.ts
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/stories/engagement.stories.tsx
- /Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/stories/feed-controls.stories.tsx

import 그래프 확인 스크립트는 scratchpad에 있다(저장소 밖): /private/tmp/claude-502/-Users-flavono123-P-scare-the-spire/05d90378-9b11-4d2c-9b88-1196a51c9c23/scratchpad/graph/graph.mjs, /private/tmp/claude-502/-Users-flavono123-P-scare-the-spire/05d90378-9b11-4d2c-9b88-1196a51c9c23/scratchpad/graph/chain.mjs

---

## 비평

# 6단계 legacy 경로 제거: 인벤토리 완전성 검토

모든 경로는 `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit`(커밋 `cbbd8474`) 기준 상대 경로입니다. 파일 수정, 커밋, 배포, 플래그 변경은 하지 않았습니다. 브랜치 비교는 `git diff`/`git log`로 읽기만 했고, 저장소 밖 scratchpad에 임시 목록 파일 하나를 썼습니다.

**결론**: 클라이언트 코드 목록 자체는 거의 빠짐없습니다. 다음 세 가지가 더 중요합니다.
- **D1 읽기는 아직 이 브랜치에 없습니다.** D1 읽기 어댑터는 그림자 비교에만 연결돼 있고, D1에서 GET을 서비스하는 코드는 미병합 `step3/reads`에 있습니다.
- **Bearer 없는 클라이언트는 `write.<group>=rls`에서 쓰기가 실패합니다.** 신원 모드와 쓰기 모드의 실패 시 기본값도 아직 안전한 쪽이 아닙니다.
- **미병합 브랜치가 새 legacy 코드를 더합니다.** `step3/reads`와 `step4/prereqs`가 인벤토리에 없는 legacy 코드를 추가하고, 6단계와 같은 파일을 고칩니다.

---

## 1. 인벤토리가 놓친 것

### 1-1. D1 읽기 서비스가 이 브랜치에 없음
- `D1_ADAPTERS`를 쓰는 곳은 `workers/api/shadow/shadow.ts:109` 하나뿐입니다. 이 브랜치의 GET은 항상 Supabase PostgREST 라우트 핸들러가 답합니다.
- D1에서 GET을 서비스하는 코드는 **미병합** `step3/reads`에 있습니다. 커밋은 `948ec7a1`("Serve GET routes from D1 when read.<group> or source.<group> is d1"), 파일은 `workers/api/d1-read.ts`입니다.
- 따라서 이 브랜치에서 `source.<group>=d1`을 켜면 쓰기는 D1으로 가고 읽기는 Supabase(outbox 미러 경유)에서 옵니다.
- client-data 0절의 "클라이언트가 부르는 읽기 경로는 전부 D1 어댑터가 있다"는 어댑터 존재만 맞고, 서비스 경로는 아닙니다.
- `step3/reads`가 **새 legacy 분기**를 더합니다. 6단계에서 함께 지워야 합니다.
  - `src/lib/run-donation.ts`의 `fetchDonatedRunRaw`/`getDonatedRunRaw`: api `HISTORY_RUN_RAW_PATH`가 실패하면 `supabase.from("runs").select("raw")`로 다시 읽음
  - `src/lib/api-client.ts`의 `responseType: "text"`
  - `history-course-run-index.tsx` 변경

### 1-2. 미병합 `step4/prereqs`가 6단계와 같은 파일을 고침
- `97792fe0`: `src/lib/runtime-flags.ts`의 `defaultSurfacePath()`(`NEXT_PUBLIC_API_PATH_DEFAULT`), `patch-comments-client.js`의 `apiPathDefault`, CI env와 검증 줄, `workers/api/path-default.ts`. 모두 6단계에서 지울 대상이 됩니다.
- `f26a818a`: `workers/api/write-gate/me-read.ts`. 쿠키만 있는 신원의 `/api/me`를 service 키로 읽습니다. identity 인벤토리 5·8절의 선행 조건을 이 커밋이 구현합니다.
- `472dbb23`: JWKS를 D1으로 옮깁니다(claim과 resolve가 바뀜).
- **신원 모드 기본값은 이 브랜치에도 없습니다.** `workers/api/identity/mode.ts`는 변경 목록에 없습니다.

### 1-3. `write.<group>=rls`에서 쿠키 신원으로는 쓰기가 안 됨
- 실패 경로:
  - `router.ts:300`: `token: token ?? ""`
  - `supabase-rest.ts:141`: 토큰이 없으면 Authorization 헤더를 붙이지 않음 → anon
  - RLS가 거절(42501) → `routes/comments.ts:120`에서 `forbidden`
  - `api-session.ts:71`은 `token_invalid`/`token_expired`만 토큰 경로로 다시 보냄
- 그래서 Bearer가 없는 6단계 클라이언트는 **모든 쓰기 그룹이 `write.<group>=worker`이거나 `source.<group>=d1`일 때만** 동작합니다.
- `write-flags.ts:39-41`의 기본값은 `rls`입니다. D1 플래그 읽기가 실패하면 rls로 떨어져 쓰기가 실패합니다. `API_WRITE_MODE_DEFAULT=worker`가 선행 조건입니다.
- 계획 4단계의 되돌리기("토큰 전달, RLS 검사")는 6단계 뒤에는 쓸 수 없습니다.
- 6단계 뒤 장애가 되는 CLI 값은 셋입니다. 인벤토리에는 path만 있었습니다.
  - `scripts/runtime-flags.ts:64` `path.<group> legacy`
  - `:67` `identity.mode token`
  - `:68` `write.<group> rls`

### 1-4. 신원 모드는 실패하면 token으로 떨어짐
- `identity/mode.ts:44,48`: flags 읽기가 실패하면 `"token"`입니다.
- 이때 결과:
  - 사용자 경로: `resolve.ts:75-79`가 Bearer가 없으니 `token_invalid`를 돌려줌
  - claim: `claim.ts:140-141`이 409 legacy를 돌려줌
- `step4/prereqs`의 `withPathDefault`는 path만 덮습니다. D1 장애 때 path는 api로 남는데 신원만 token이 되는 상태가 생깁니다. 신원 기본값을 path 기본값과 짝으로 둬야 합니다.

### 1-5. 데이터 env 값이 쓰기에서도 강제됨
- `workers/api/d1-write/handlers/toybox.ts:208,547,582,652`: `body.env !== write.dataEnv`이면 `invalid`로 거절합니다.
- 두 값의 출처:
  - 클라이언트: `NEXT_PUBLIC_SUPABASE_ENV`(`supabase.ts:8`, 기본 `production`)
  - Worker: `API_DATA_ENV`(`cloudflare-workers.yml:289`, testbed는 `run-cloudflare-testbed.mjs:399`. testbed 빌드 env는 `:42,:309`)
- 이름을 바꿀 때 두 곳을 같이 바꿔야 합니다.
- `nav-snapshot.ts:38-41`의 env 불일치는 지금은 legacy로 넘어가지만, 6단계 뒤에는 네비 점과 배달부가 꺼집니다.

### 1-6. 신규 가입이 전부 Worker IP로 몰림
- `docs/supabase-exit/SURFACE_MAP.md:1359-1360`은 "Worker는 Supabase의 IP별 Auth 한도를 같이 쓴다, 1단계 동안 /auth/v1은 브라우저에 둔다"고 적어 두었습니다.
- 6단계는 브라우저의 `/auth/v1` 호출을 모두 없앱니다.
  - `use-auth.ts:67-71` `signInAnonymously`
  - `api-session.ts:85` `refreshSession`
  - `patch-comments-client.js:463-496`
- 그러면 신규 가입은 전부 `claim.ts:164-167` → `supabase-signup.ts:54-62`로, Cloudflare egress IP에서 나갑니다. 가입이 실패하면 503 `auth_unavailable`입니다.
- 이 위험은 어느 인벤토리에도 없습니다. 프로젝트의 실제 한도 값은 확인하지 못했습니다.

### 1-7. claim은 토큰을 쿠키보다 먼저 봄
- `claim.ts:155-158`이 본문 토큰을 유효 쿠키 확인(`:161-162`)보다 먼저 검증합니다. 그래서 오래된 토큰을 보내면 쿠키가 유효해도 401 `token_invalid`입니다.
- `ensureClaimedIdentity`(`api-identity.ts:187-200`)는 marker가 없거나 저장 uid가 marker와 다르면 토큰을 보냅니다.
- 6단계 뒤에는 토큰 갱신이 없어 이런 실패가 늘어납니다.
- 대체 동작이 필요합니다. 예: `token_invalid`이면 빈 claim으로 다시 보내 `kept` 응답을 받습니다.
- claim 기한 180일과 별개로, 사용자 쪽에서 결정할 것이 하나 더 생깁니다.

### 1-8. "정적 에셋 페이지는 쿠키를 못 받는다"는 전제는 main Worker에는 맞지 않음
- 모든 HTML은 `_cf_static_pages/`에 있고 Worker를 거쳐 나갑니다.
  - `copy-cf-static-pages.mjs:16`
  - `main-worker.ts:237-262`(`fetchStaticPageAsset`), `:529`(`withFlagCookie`)
  - `wrangler.jsonc:8-12`
  - 로컬 `.cloudflare/assets`(빌드 `11bed990`)에는 `_cf_static_pages` 밖 `.html`이 0개입니다.
- 실제로 쿠키가 없는 경우:
  - isolate 메모리에 플래그가 없거나 5분(`STALE_MAX_MS`, `flags.ts:27`)이 지났을 때. `pageFlags`가 null을 돌려주고(`flags.ts:173-174`) 쿠키를 건드리지 않습니다.
  - `Max-Age=86400`(`flag-cookie.ts:106`)이 지난 열린 탭
  - `pnpm dev`와 `qa:mobile`
  - 패치 Worker 자체 호스트
- `slseoun_idm`도 같은 조건입니다(`mode.ts:55-59`, `cookie.ts:34`).
- `surfacePath`를 없애면 경로 쪽 공백은 사라집니다. 하지만 `identityCookieMode()` 게이트를 남기면 같은 공백이 신원에 남습니다.
  - 게이트 위치: `api-session.ts:33`, `use-auth.ts:58`, `api-identity.ts:128-129`, `patch-comments-client.js:931,1607`

### 1-9. 갱신 함수의 legacy 기본 인자
- `use-combo-posts.ts:117-121`과 `use-transfigure-posts.ts:352-356`의 update 함수는 `viaApi = false`가 기본입니다.
- 유일한 호출자(`:269-272`, `:547-550`)는 `true`를 넘깁니다.
- legacy 분기만 지우면 기본값으로 부르는 경우 갈 경로가 없습니다. 인자 자체를 지워야 합니다.

### 1-10. 철학자 글 id가 uuid가 아닐 때 화면이 바뀜
- `use-colorful-philosopher-posts.ts:154`: uuid가 아닌 id는 지금 legacy로 갑니다.
- `id`가 uuid 열이라(`supabase/migrations/20260924020000_colorful_philosopher_posts.sql:2`) PostgREST가 오류를 내고, 화면은 "응답 없음"이 됩니다(`:186-197`).
- 6단계 뒤에는 "없음"으로 바뀝니다. client-data의 "지금도 api에서 없음"은 틀렸습니다.

### 1-11. 사용자에게 보이는 Supabase 문구
- `run-donation.ts:271,330,419`: "Supabase 연결이 설정되지 않았습니다."
- `contact-inquiries.ts:72,135`: "Supabase is not configured"

### 1-12. 저장소 밖에서 Supabase에 직접 쓰는 곳 하나 추가
- `.claude/skills/patch-note-revision/SKILL.md:63-70`과 `.codex/skills/patch-note-revision/SKILL.md:63-70`이 `supabase db query --linked "UPDATE public.community_stories …"`를 지시합니다.
- `source.stories=d1` 뒤에는 이 수정이 D1에 닿지 않습니다. csp 인벤토리 10.3절에 빠져 있습니다.

### 1-13. QA 쿠키는 testbed 전체 실행에 걸림
- `playwright.config.ts:33-53`은 `PLAYWRIGHT_BLOCK_SUPABASE=1`이면 모든 테스트에 `slseoun_qa=no-supabase`를 넣습니다.
- `run-cloudflare-testbed.mjs:261`이 `qa:cf:testbed` 전체에 이 값을 줍니다.
- 그래서 6단계 뒤에는 blockSupabase 테스트 5개가 아니라 **스위트 전체의 커뮤니티 화면**이 409, 곧 "응답 없음"이 됩니다.

### 1-14. 패치 Worker 배포 순서와 되돌리기
- `cloudflare-workers.yml:172-190`이 패치 Worker를 main보다 먼저 배포하고, `:373-391`에서 다시 배포합니다.
- 6단계 패치 클라이언트는 main 빌드가 끝날 때까지 이전 main Worker를 상대합니다. 되돌리기도 Worker마다 따로입니다.
- 계획의 "클라이언트는 이전 Worker 버전으로"에 두 Worker를 모두 명시해야 합니다. 인벤토리에는 CSP만 적혀 있습니다.

### 1-15. 번들 사이의 nav 스냅샷 계약
- `window.__slseounRuntime.nav` promise를 둘이 공유하는데, 거부하는 방식이 다릅니다.
  - `patch-comments-client.js:1634-1637`: 그룹을 내리고 일반 `Error`를 던짐
  - `nav-snapshot.ts:49-55`: `SurfaceLegacyError`를 던짐
- `nav-seen.ts:375-379`와 `comment-courier.tsx:180`은 demote 여부로 둘을 구분합니다. 두 쪽을 같은 배포에서 함께 바꿔야 합니다.

### 1-16. legacy 신호 헬퍼의 다른 출처
- `api-engagement.ts:151-154`의 `unknownBody()`도 legacy 신호입니다.
- `:285`가 `shouldUseLegacy`/`writeMayGoLegacy`를 다시 export합니다. `api-client`만 정리하면 이 경로가 남습니다.

### 1-17. 내 데이터 표시가 오류 없이 꺼짐
- 우편함 점: 모든 페이지의 `site-navbar.tsx:796` → `use-mailbox-reply.ts:38-66` → `contact-inquiries.ts:166-177`.
- 이 브랜치의 `me` 읽기는 토큰을 넘깁니다. 쿠키만 있으면 anon이 되어 `unseen=false`가 됩니다. 내 좋아요(`me.engagement`)도 같습니다.
- 오류가 아니라 표시만 꺼지는 방식입니다. `f26a818a`가 병합돼야 해결됩니다.

### 1-18. claim의 IP별 예산
- `claim.ts:146-147`은 `claim:<ip>`를 쓰기 limiter(`rate-limit.ts:28`, 분당 30)로 셉니다.
- 6단계 뒤에는 쿠키가 없는 방문자에게 브라우저 직접 가입 대체가 없습니다. 공유 IP(통신사 NAT 등)에서는 429가 곧 신원 실패가 됩니다. 영향은 작습니다.

---

## 2. 인벤토리 정정

- **client-data 8절 "고칠 테스트" 중 네 개는 legacy를 검증하지 않습니다.** 6단계에서 바꿀 필요가 없습니다.
  - `direct-writes-policies.spec.ts`, `write-gate-equivalence.spec.ts`: PGlite 위의 Supabase SQL과 Worker 게이트를 봅니다. `legacy`나 `no-supabase` 문자열이 없습니다.
  - `courier-comment-text.spec.ts`: `courierCommentText`가 패치 클라이언트에 남는지만 봅니다.
  - `api-write-retry.spec.ts`: `node --check`와 `write_paused` 재시도만 봅니다.
- **`isCheckViolation`은 `toybox-api.ts`가 import하지 않습니다.** `toybox-api.ts:33-38`의 `POSTGREST_CODES`가 api 오류를 23514 같은 코드로 바꿔 줘서 훅의 `isCheckViolation`이 api 오류에도 통하는 구조입니다. 함수를 옮길 때 이 매핑을 유지해야 합니다.
- **`slseoun_idm`과 `slseoun_rf`가 안 붙는 조건이 더 넓습니다.** "차가운 isolate의 첫 페이지"만이 아니라 "마지막 flags 읽기가 5분을 넘은 isolate"까지입니다.
- **1-1과 1-10의 정정**도 이 절에 해당합니다.

---

## 3. legacy를 지울 때의 위험

1. **운영 선행 조건 중 아직 안 된 것이 많습니다.**
   - 됨: 모든 그룹 `path=api`(`docs/release/history/2026-11-09.md:19`)
   - 안 됨:
     - `identity.mode=cookie`
     - 모든 `write.*=worker`와 `API_WRITE_MODE_DEFAULT=worker`(1-3)
     - 토큰 없는 `me` 읽기(`f26a818a`)
     - D1 GET 서비스(`step3/reads`)
     - `API_PATH_DEFAULT=api`와 신원 기본값(1-4)
2. **Worker의 409 legacy 응답이 모두 장애가 됩니다.**
   - 경우: kill switch `off`/`not_configured`(`flags.ts:138-142`), QA 쿠키(`router.ts:227`, `claim.ts:137`), flags 읽기 실패(`router.ts:240`), `path legacy`(`:241`), `no_route`(`:208`, 패치·main 버전이 어긋날 때)
   - `wrangler.jsonc:14-17`이 `"off"`를 안전한 상태로 설명하는데, 6단계 뒤에는 커뮤니티 기능 전체 중단입니다.
   - `not_configured`는 `API_SUPABASE_*` 변수에 묶여 있습니다. 그래서 7단계 전에는 이 변수를 빼면 안 됩니다.
3. **신원이 늙습니다.** 토큰 갱신이 없어지고(1-7, identity 인벤토리 7절), HS256 토큰은 거절되고, 가입은 Worker IP로만 갑니다(1-6).
4. **되돌리기 수단이 줄어듭니다.**
   - 남는 것: `source.<group>`, 그리고 두 Worker를 모두 이전 버전으로 돌리기
   - 못 쓰게 되는 것: `rls`, `identity.mode token`, `path legacy`
   - 오래 열어 둔 옛 탭은 계속 Supabase를 직접 부릅니다. 이 때문에 "운영 referer 0건" 판정이 늦어집니다.
5. **env 값이 묶여 있습니다(1-5).** 이름을 바꾸면 네비 비교, 쓰기 거절, 저장 키 접미사가 한꺼번에 영향을 받습니다.
6. **"그대로 이관" 원칙과 부딪히는 보이는 변화가 있습니다.**
   - 1-10의 "응답 없음" → "없음"
   - `isRunId`/`isRowId`에 안 맞는 id
   - dev 릴
   - OG 보강을 켤지 여부
   - `supabaseEnabled`를 상수로 바꿀 때는 반드시 `true`로 해야 합니다. 운영 빌드는 늘 true였습니다(`cloudflare-workers.yml:156-158`). `false`로 하면 미리 그린 HTML의 초기 상태가 바뀝니다(예: `use-toybox-feed.ts:51,54`, `use-auth.ts:38`).
7. **로컬과 QA에서 데이터를 볼 수 없게 됩니다.** `pnpm dev`와 `qa:mobile`에는 `/api`가 없고, `qa:cf:testbed`는 전체가 QA 쿠키를 받으며(1-13), Storybook에도 Worker가 없습니다.
8. **순서가 중요합니다.**
   - 검사(gate)를 먼저 지우고 env를 나중에 뺍니다.
   - 패치 HTML 설정의 URL과 키는 클라이언트를 바꾼 뒤에 뺍니다.
   - 클라이언트 `NEXT_PUBLIC_SUPABASE_*`를 지울 때 CI가 `:287-288`에서 만드는 `API_SUPABASE_*`는 따로 받게 해야 합니다.
9. **병합 순서가 중요합니다.** `step3/reads`와 `step4/prereqs`가 `run-donation.ts`, `api-client.ts`, `runtime-flags.ts`, `patch-comments-client.js`, `history-course-run-index.tsx`를 고칩니다. 두 브랜치를 병합한 뒤 다시 조사하지 않으면 인벤토리의 줄 번호와 legacy 목록이 낡습니다.

---

## 4. 확인하지 못한 것

- Supabase 익명 가입의 IP별 한도 값
- 운영의 `identity.mode`, `write.*`, `source.*` 현재 값(릴리스 기록에 path·shadow만 있음)
- 운영 데이터에 uuid가 아닌 철학자 글 링크나 `isRunId`/`isRowId`에 안 맞는 id가 있는지

---

## 주요 파일

- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/router.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/flags.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/flag-cookie.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/write-flags.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/supabase-rest.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/routes/comments.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/identity/mode.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/identity/claim.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/identity/resolve.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/d1-write/handlers/toybox.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/api/shadow/shadow.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/workers/main-worker.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/copy-cf-static-pages.mjs`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/scripts/runtime-flags.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/api-session.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/api-identity.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/nav-snapshot.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/api-engagement.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/toybox-api.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/run-donation.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/lib/contact-inquiries.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/hooks/use-combo-posts.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/hooks/use-transfigure-posts.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/hooks/use-colorful-philosopher-posts.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/hooks/use-mailbox-reply.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/src/components/patches/patch-comments-client.js`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/playwright.config.ts`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/.github/workflows/cloudflare-workers.yml`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/.claude/skills/patch-note-revision/SKILL.md`
- `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit/docs/supabase-exit/SURFACE_MAP.md`