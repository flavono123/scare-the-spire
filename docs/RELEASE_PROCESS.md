# 배포 프로세스

작업 브랜치 규칙, 커밋별 기능 기대치 기록, 정기 배포(섀소식 동반)와 긴급 배포(패치노트)
절차를 정한다. 명령 자체의 사용법은 [DEPLOY.md](DEPLOY.md), 패치 Worker 정합성 계약은
[PATCH_WORKER_DEPLOY_CONTRACT.md](PATCH_WORKER_DEPLOY_CONTRACT.md)를 따른다.

## 1. 작업 브랜치

- 기본은 로컬 `main`에서 작업하고 수정할 때마다 바로 커밋한다(speculative commit).
- 세션이 작업을 **대규모 리팩토링**(여러 서비스·공통 렌더·라우트 트리·데이터 스키마에 걸쳐
  한 번의 정기 배포 주기 안에 끝나지 않거나, 중간 상태로 배포되면 안 되는 작업)이라고
  판단하면, 작업을 시작하기 전에 사용자에게 worktree 사용 승인을 받는다.
  - 승인되면 `.claude/worktrees/<이름>`에 `refactor/<이름>` 브랜치로 worktree를 만든다.
  - worktree 안에서도 수정할 때마다 바로 커밋한다.
  - [release/UNRELEASED.md](release/UNRELEASED.md)의 "열린 worktree"에 이름·브랜치·목적·
    상태를 적는다.
  - 정기 배포 직후마다 로컬 `main`을 받아 rebase(또는 merge)해 충돌을 작게 유지한다.
- **병합할 때 정리한다.**
  - 브랜치를 로컬 `main`에 `git merge --no-ff`로 넣는다. 원격 `main`에 브랜치를 직접 push하지
    않는다.
  - 브랜치의 기능 기대치(2절)를 병합 커밋 본문 또는 UNRELEASED.md 항목으로 모은다.
  - `git worktree remove`와 `git branch -d`로 worktree와 브랜치를 지우고, UNRELEASED.md의
    "열린 worktree"에서 뺀다.

## 2. 커밋별 기능 기대치 기록

배포 세션이 "마지막 배포 이후 모든 커밋의 기능 요소"를 QA할 수 있도록, 작업 세션은
사용자에게 보이는 동작을 바꾸는 커밋마다 본문에 다음 줄을 남긴다(영어).

```text
<제목 한 줄>

Feature: <바뀐 기능 또는 요구사항>
Expect: <QA에서 확인할 관찰 가능한 결과>   # 여러 줄 가능
QA: <확인할 라우트·화면·로케일·뷰포트>
```

- 내부 리팩토링·문서·스크립트처럼 사용자에게 보이는 변화가 없으면 `QA: none`만 적는다.
- 여러 커밋에 걸친 기능, worktree 작업, 커밋 본문에 담기 어려운 시나리오는
  [release/UNRELEASED.md](release/UNRELEASED.md)의 "기능 기대치"에 항목으로 적고, 커밋
  본문에는 `QA: see docs/release/UNRELEASED.md#<항목>`으로 가리킨다.

## 3. 정기 배포 (섀소식 동반, 주 1회 지향)

섀소식(byrdispatch)을 쓴 뒤 배포한다. 배포 세션은 다음 순서로 진행한다.

1. **기준점 확인.** 마지막 배포는 성공한 마지막 프로덕션 실행의 커밋이다.
   `gh run list --workflow cloudflare-workers.yml --status success -L 1 --json headSha`.
   범위는 `<그 커밋>..main`이다.
2. **worktree 정리.**
   - `git worktree list`와 `git branch --no-merged main`으로 병합 안 된 worktree·브랜치를 찾는다.
   - 각각 이번 배포에 포함할지 판단하고, 판단이 서지 않으면 사용자에게 묻는다. 포함하면
     1절대로 병합하고 정리한다.
   - 이미 병합됐거나 버려진 worktree(UNRELEASED.md에 없는 것 포함)도 판단하거나 물은 뒤 정리한다.
3. **기능 목록 수집.** 범위의 커밋 본문(`git log --format='%h %s%n%b' <기준>..main`)과
   UNRELEASED.md를 합쳐 이번 배포의 기능 목록을 만든다. 기대치가 없는 사용자 영향 커밋은
   diff를 읽어 기대치를 보충하고 UNRELEASED.md에 적는다.
4. **CI 게이트.** 회귀를 막는 최소 검증이다. 하나라도 실패하면 고치고 커밋한 뒤 다시 돌린다.
   - `./.githooks/pre-push` (`i18n:validate`, `lint`, `tsc --noEmit`)
   - `pnpm patch:test`, `pnpm codex:validate`, `pnpm test:version-api`
   - `pnpm cf:build`와 `pnpm cf:size` (main Worker 크기 초과는 과거 첫 배포 실패의 최다 원인)
5. **전수 스모크 테스트.** 페이지 안정성을 확인한다.
   - `pnpm cf:testbed -- --remote`로 격리된 testbed Worker에 올려 `qa:cf:testbed`와
     `cf:smoke --scope all`을 돌린다.
   - 주요 라우트가 2xx/3xx로 응답하는지, 콘솔 오류가 없는지, 한국어·영어 로케일이 깨지지
     않는지 본다.
6. **기능 QA.** 3단계 목록의 모든 항목을 `Expect`대로 확인한다. `qa` 스킬을 쓰고,
   범위에 따라 `mobile-viewport-qa`·`animation-playback-qa` 등으로 위임한다. 고친 것은 커밋한다.
7. **섀소식 대조.** 이번 섀소식이 언급한 기능이 모두 배포 범위에 있고 QA를 통과했는지 확인한다.
8. **push.** 사용자 승인을 받아 로컬 `main` HEAD 전체를 push한다(AGENTS.md 배포 규칙).
9. **기록 정리.** 배포가 성공하면 UNRELEASED.md의 기능 기대치와 QA 결과를
   `docs/release/history/YYYY-MM-DD.md`로 옮기고, UNRELEASED.md를 비운다(열린 worktree는 남긴다).

## 4. 긴급 배포 (패치노트 원문 공개)

배포 속도가 우선이다. 3절의 전수 스모크·기능 QA를 생략하고, 패치 Worker의 최소 정합성과
서비스 안정성만 확인한다.

1. **패치노트 배포(최우선).** `slseoun-patch` 스킬로 패치노트를 만들고 `pnpm patch:test`를
   통과시킨 뒤 push한다. 빌드는 돌리지 않는다. 패치 Worker는 main Worker보다 먼저 배포된다.
2. **main Worker 패치 반영(다음 우선순위).** 코덱스 데이터·패치 내역을 반영하고, CI 게이트
   (3절 4단계)와 영향받는 라우트(`/compendium/*`, `/patches/*`) 스모크만 돌린 뒤 push한다.
3. **함께 나간 커밋 기록.** 로컬 `main` 전체가 push되므로 QA 안 된 커밋이 함께 배포될 수 있다.
   UNRELEASED.md에 "긴급 배포로 QA 없이 나감"으로 범위를 적어 두고, 다음 정기 배포에서 기능
   QA를 한다. 다음 정기 배포의 기준점은 이 긴급 배포가 아니라 그 전 정기 배포로 잡는다.
