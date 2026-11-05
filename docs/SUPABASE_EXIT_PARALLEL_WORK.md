# Supabase 이관 중 병렬 작업 유의사항

Supabase를 Cloudflare D1으로 옮기는 작업이 진행 중이다. 전체 계획은
[SUPABASE_EXIT_PLAN.md](SUPABASE_EXIT_PLAN.md)에 있다. 이 문서에는 이관과 같은 시기에 다른 작업을 하는 세션이
지킬 것만 모았다. 이관 단계가 바뀌면 "지금 단계"를 고친다.

## 지금 단계

- 0단계 끝(2026-11-05): 운영 DB 백업을 로컬에 받았고, 모바일 뷰포트 QA가 기본으로 Supabase를 막는다.
- 1단계(같은 출처 API)부터는 별도 worktree에서 한다. 시작하면 [UNRELEASED.md](release/UNRELEASED.md)에
  등록한다.

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
| 빌드 | 패치 상세 페이지가 빌드할 때 Supabase를 읽음 |

운영 댓글 348개 가운데 백과사전 댓글이 103개로 가장 많다(2026-11-05).

## 유의사항

1. **배포가 Supabase 상태에 묶여 있다.** 백과사전 경로를 바꾸면 CI가 main Worker와 함께 패치 Worker도
   빌드한다. 패치 상세 페이지가 빌드 때 Supabase를 읽으므로, Supabase가 응답하지 않으면 운영 빌드가 실패한다.
   `ALLOW_BUILD_WITHOUT_SUPABASE=1`로 우회하면 그 섹션에 표본 글이 들어간다. 빌드가 이 이유로 실패하면
   Supabase가 돌아온 뒤 다시 돌린다. 이 연결은 이관 6단계에서 빌드가 DB를 읽지 않게 되면서 끊긴다.
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
4. **브라우저 QA는 Supabase를 막는다.** testbed와 운영이 Supabase 프로젝트 하나를 같이 쓰고, QA 부하로 DB가
   멈춘 적이 있다. `.codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs`는 기본으로 막는다.
   댓글·좋아요·피드처럼 DB를 쓰는 화면을 확인할 때만 `--allow-supabase`를 붙인다. 다른 Playwright·Chrome QA는
   `--host-resolver-rules=MAP *.supabase.co ~NOTFOUND`로 막는다.
5. **댓글 이상은 이관 플래그부터 본다.** 1단계부터 화면별 런타임 플래그가 데이터 경로를 고른다. 댓글·좋아요·반응
   플래그 하나가 백과사전, 패치 노트, 장난감 상자 댓글을 함께 바꾼다. 그 화면이 이상하면 코드보다 먼저 플래그
   상태를 확인한다.
