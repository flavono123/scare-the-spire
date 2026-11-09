# Supabase 이관 중 병렬 작업 유의사항

Supabase를 Cloudflare D1으로 옮기는 작업이 진행 중이다. 전체 계획은
[SUPABASE_EXIT_PLAN.md](SUPABASE_EXIT_PLAN.md)에 있다. 이 문서에는 이관과 같은 시기에 다른 작업을 하는 세션이
지킬 것만 모았다. 이관 단계가 바뀌면 "지금 단계"를 고친다.

## 지금 단계

- 0단계 끝(2026-11-05): 운영 DB 백업을 로컬에 받았고, 모바일 뷰포트 QA가 기본으로 Supabase를 막는다.
- 1단계(같은 출처 API) 진행 중(2026-11-05 시작): worktree `.claude/worktrees/supabase-exit`, 브랜치
  `refactor/supabase-exit`. [UNRELEASED.md](release/UNRELEASED.md)에 등록했다.
- 5단계까지 운영(2026-11-09): 모든 화면이 같은 출처 `/api`로 읽고 쓰며, 쓰기 원본은 D1이고 Supabase는 outbox
  미러로만 따라간다([history/2026-11-09.md](release/history/2026-11-09.md)).
- 6단계(클라이언트 정리) 코드 완료, 배포 전(2026-11-10): 브라우저에 supabase-js와 Supabase 직접 경로가 없다.
  패치 빌드는 셸 패치 릴만 배포된 사이트의 `/api`에서 굽는다.

## 이관과 상관없는 작업

아래는 DB와 상관이 없다. 지금처럼 main에서 한다.

- 백과사전 데이터(JSON)와 새 항목, 이미지, 정적 페이지
- 패치 노트·니오우스레터 본문, 검색 색인, 게임 에셋 업데이트

새 백과사전 항목에는 댓글·좋아요·반응을 위해 따로 할 일이 없다. 상세 페이지는 공용 댓글 컴포넌트를 쓰고,
스레드는 `sts2-codex:<종류>:<id>` 키로 묶인다. 항목이 늘면 키만 새로 생긴다. 기존 항목의 id를 바꾸면 그
항목의 스레드가 끊긴다. 이건 이관과 상관없이 지금도 그렇다.

## Supabase를 쓰는 곳(이관 대상)

| 영역 | Supabase를 쓰는 부분 |
|---|---|
| 백과사전 상세(카드, 유물, 포션, 몬스터, 이벤트, 키워드, 에인션트 등) | 아래쪽 댓글, 좋아요, 반응 |
| 백과사전 목록 | 항목별 좋아요·댓글 수 |
| 슬서운변경·니오우스레터 | 줄별 댓글, 패치 상세의 다채로운 철학자들·변형 섹션 |
| 모든 페이지의 네비 | 새 글 표시 |
| 장난감 상자 | 피드, 글, 투표, 댓글 |
| 그 밖 | 이야기 피드, 프로필 활동, 문의, 역사 강의서 런 기부, 짜증나는 퍼즐상자 순위, 글 상세의 링크 미리보기(OG) |
| 빌드 | 패치 상세 페이지가 빌드할 때 릴 글을 읽음(6단계부터 Supabase가 아니라 배포된 사이트의 `/api`) |

운영 댓글 348개 가운데 백과사전 댓글이 103개로 가장 많다(2026-11-05).

## 유의사항

1. **배포가 사이트 `/api` 상태에 묶여 있다.** 백과사전 경로를 바꾸면 CI가 main Worker와 함께 패치 Worker도
   빌드한다. 패치 상세 페이지가 빌드 때 셸 패치 릴(변형, 다채로운 철학자들)을 읽는다. 6단계부터는 Supabase가
   아니라 배포된 사이트의 같은 출처 `/api`에서 읽는다(결정 D1 B안). 그 `/api`가 응답하지 않으면 운영 빌드가
   실패한다. `ALLOW_BUILD_WITHOUT_API=1`(옛 이름 `ALLOW_BUILD_WITHOUT_SUPABASE=1`도 받음)로 우회하면 그 섹션에
   표본 글이 들어간다. 빌드가 이 이유로 실패하면 사이트가 돌아온 뒤 다시 돌린다. `next build`는 아무것도 읽지
   않는다.
2. **이관이 고치는 파일은 피한다.** 아래 파일을 같은 시기에 고치면 이관 worktree와 충돌한다. 고쳐야 하면
   사용자에게 이관과 순서를 맞출지 묻는다. 백과사전 상세 컴포넌트의 레이아웃은 고쳐도 된다. 공용 댓글
   컴포넌트를 쓰는 방식만 그대로 둔다.
   - `supabase`라는 단어가 들어간 파일 전부(`grep -rli supabase src workers`로 확인)
   - 댓글·좋아요·반응 훅(`src/hooks/use-comments.ts`, `use-likes.ts`, `use-comment-likes.ts`,
     `use-resource-reactions.ts`, `use-engagement-counts.ts`, `use-auth.ts`)과
     `src/components/colorful-philosophers/resource-thread.tsx`
   - `src/components/site-navbar.tsx`, `src/hooks/use-nav-seen.ts`, `src/lib/nav-seen.ts`
   - `workers/main-worker.ts`, `workers/security-headers.ts`, `workers/detail-shell-og.ts`, `wrangler.jsonc`
   - `scripts/build-patch-worker.tsx`, `src/components/patches/patch-comments-client.js`
3. **DB를 쓰는 새 기능을 늘리지 않는다.** 새 테이블, RPC, 새 종류의 댓글, 새 `supabase.from(...)` 호출이
   여기에 든다. 이관 중에 생기면 옮길 대상이 계속 늘어난다. 꼭 필요하면 사용자에게 묻고, 3·4단계 뒤에 새 API
   위에서 만든다. Supabase 스키마를 바꿔야 하면 열·테이블 추가만 한다. 삭제나 이름 변경은 이관이 끝날 때까지
   하지 않는다. 이전 Worker 버전으로 되돌릴 수 있게 하기 위해서다.
4. **브라우저 QA는 Supabase를 DNS에서 막는다.** testbed와 운영이 Supabase 프로젝트 하나를 같이 쓰고, QA 부하로
   DB가 멈춘 적이 있다. 6단계 브라우저는 Supabase를 부르지 않고 같은 출처 `/api`(D1)만 부른다. 그래서 차단은 DNS로만
   한다: Playwright·Chrome QA는 `--host-resolver-rules=MAP *.supabase.co ~NOTFOUND`(Playwright는
   `PLAYWRIGHT_BLOCK_SUPABASE=1`). 이렇게 막아도 댓글·좋아요·피드 같은 데이터 화면이 그대로 뜬다. 막힌
   `*.supabase.co` 요청은 `ERR_NAME_NOT_RESOLVED`로 잡히고, 6단계 뒤에는 0건이어야 한다.
   - `slseoun_qa=no-supabase` 쿠키는 넣지 않는다. 이 쿠키가 있으면 Worker가 모든 `/api`를 409로 답해서 화면이
     "데이터베이스가 응답하지 않습니다"가 되고 확인할 대상이 사라진다. 그 상태를 보려는 시험만 직접 넣는다.
   - `.codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs`는 지금도 기본으로 DNS 차단과 이 쿠키를 함께
     건다. 데이터 화면을 확인할 때는 `--allow-supabase`를 붙인다(쿠키가 빠진다. 브라우저는 여전히 Supabase를
     부르지 않는다).
5. **댓글 이상은 이관 플래그부터 본다.** 1단계부터 화면별 런타임 플래그가 데이터 경로를 고른다. 댓글·좋아요·반응
   플래그 하나가 백과사전, 패치 노트, 장난감 상자 댓글을 함께 바꾼다. 그 화면이 이상하면 코드보다 먼저 플래그
   상태를 확인한다.
