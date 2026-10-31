# 배포 프로세스

작업 브랜치 규칙, 커밋별 기능 기대치 기록, 정기 배포(섀소식 동반)와 긴급 배포(패치노트)
절차, 배포에 딸린 Supabase 마이그레이션 적용을 정한다. 명령 자체의 사용법은 [DEPLOY.md](DEPLOY.md), 패치 Worker 정합성 계약은
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
- `supabase/migrations/`에 마이그레이션을 추가하는 커밋은 본문에 다음 줄을 더하고,
  UNRELEASED.md의 "Supabase 마이그레이션" 표에도 적는다. 전략 판정은
  `.codex/skills/supabase-migrations/SKILL.md`의 Production Compatibility Gate를 따른다.

  ```text
  Migration: <파일명>
  Rollout: <db-first-additive | versioned-contract | app-first-expand | contract-cleanup>
  Order: <before-push | after-push | later-release>   # 앱 push 기준 적용 시점
  ```
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
   **Supabase 마이그레이션 판정**도 여기서 한다(5절). 대기 중인 마이그레이션과 각각의
   적용 시점(push 전/후/다음 배포)을 정해 기능 목록에 붙인다.
4. **CI 게이트.** 회귀를 막는 최소 검증이다. 하나라도 실패하면 고치고 커밋한 뒤 다시 돌린다.
   - `./.githooks/pre-push` (`i18n:validate`, `lint`, `tsc --noEmit`)
   - `pnpm patch:test`, `pnpm codex:validate`, `pnpm test:version-api`
   - `pnpm cf:build`와 `pnpm cf:size` (main Worker 크기 초과는 과거 첫 배포 실패의 최다 원인)
5. **전수 스모크 테스트.** 페이지 안정성을 확인한다. `before-push` 마이그레이션이 있으면
   먼저 5절 절차로 적용하고(이 시점부터 운영 중인 이전 앱 + 새 DB 상태가 되므로 운영
   `cf:smoke`도 함께 본다), 그 뒤에 새 앱 + 새 DB로 스모크한다.
   - `pnpm cf:testbed -- --remote`로 격리된 testbed Worker에 올려 `qa:cf:testbed`와
     `cf:smoke --scope all`을 돌린다.
   - 주요 라우트가 2xx/3xx로 응답하는지, 콘솔 오류가 없는지, 한국어·영어 로케일이 깨지지
     않는지 본다.
6. **기능 QA.** 3단계 목록의 모든 항목을 `Expect`대로 확인한다. `qa` 스킬을 쓰고,
   범위에 따라 `mobile-viewport-qa`·`animation-playback-qa` 등으로 위임한다. 고친 것은 커밋한다.
7. **섀소식 대조.** 이번 섀소식이 언급한 기능이 모두 배포 범위에 있고 QA를 통과했는지 확인한다.
8. **push.** 사용자 승인을 받아 로컬 `main` HEAD 전체를 push한다(AGENTS.md 배포 규칙).
   push 전에 지금 정상 버전 ID를 UNRELEASED.md에 적는다. 롤백 절차는 [DEPLOY.md](DEPLOY.md)의
   "롤백"을 따른다.
9. **push 후 마이그레이션.** 운영 배포와 스모크가 통과하면 `after-push` 마이그레이션을 5절
   절차로 적용한다. `later-release`는 대장에 남겨 다음 정기 배포로 넘긴다.
10. **기록 정리.** 배포가 성공하면 UNRELEASED.md의 기능 기대치와 QA 결과를
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
4. **마이그레이션 확인.** 긴급 배포에서는 마이그레이션을 새로 적용하지 않는 것이 기본이다.
   다만 함께 나가는 커밋이 아직 적용 안 된 마이그레이션을 필요로 하면(새 앱 + 이전 DB가
   깨지면) push 전에 멈추고, 5절 판정 결과와 함께 사용자에게 "지금 적용"과 "push 보류" 중
   무엇을 할지 묻는다. "지금 적용"은 이전 앱 + 새 DB가 안전할 때만 고를 수 있다.

## 5. Supabase 마이그레이션

세부 판정 기준은 `.codex/skills/supabase-migrations/SKILL.md`를 따른다. 원격 DB와 앱은
따로 배포되는 것으로 다룬다. 운영 DB 적용은 되돌리기 어려우므로 실제 적용(`db push`)은
매번 사용자 승인을 받는다.

1. **CLI 준비.** `set -a && source .env.local && set +a`. 링크 정보는
   `supabase/.temp/project-ref`에 있다. 없으면 `.env.local.example` 주석대로
   `supabase link`를 한다. 키·비밀번호는 출력하지 않는다.
2. **대기 목록.** `supabase migration list --linked`에서 `local`만 있고 `remote`가 빈 항목이
   대기 중인 마이그레이션이다. 추가로 `git diff --name-only <기준>..main -- supabase/`로 이번
   범위의 변경을 본다.
   - 이미 적용된 마이그레이션 파일이 수정됐거나, 014 이전의 최상위 `supabase/*.sql`이
     바뀌었으면 적용하지 말고 사용자에게 보고한다.
   - `remote`에만 있는 항목(로컬에 없는 원격 적용분)이 있으면 멈추고 보고한다.
     `migration repair`는 승인 없이 쓰지 않는다.
3. **판정.** 대기 중인 각 마이그레이션의 `Rollout`/`Order`를 커밋 본문과 UNRELEASED.md에서
   읽는다. 없거나 의심스러우면 스킬의 4가지 상태(이전/새 앱 × 이전/새 DB)를 직접 확인해
   정한다. 시점은 다음과 같다.
   - `db-first-additive`, `versioned-contract`: **before-push**.
   - `app-first-expand`: **after-push**. 두 계약을 모두 받는 앱이 운영에 배포되고 확인된 뒤에
     적용한다.
   - `contract-cleanup`: **later-release**. 모든 배포된 앱이 옮겨간 뒤, 다음 정기 배포 이후에
     적용한다.
4. **적용.** `supabase db push --linked --dry-run` 결과를 사용자에게 보여 주고, 이번에 적용할
   것 외에 섞인 마이그레이션이 없는지 확인한 뒤 승인을 받아 `supabase db push --linked`를
   실행한다.
5. **확인.**
   - `supabase migration list --linked`로 원격에 반영됐는지 본다.
   - `supabase db dump --linked --schema public`으로 테이블·컬럼·제약·함수·권한·RLS 정책을
     확인한다.
   - 새 결과 변형마다 비어 있지 않은 대표 데이터로 운영 화면을 확인한다. 콘솔 오류,
     `StorageUnavailableNotice`, 오류 경계가 없어야 한다.
6. **기록.** UNRELEASED.md의 표에 적용 여부·시각·확인 방법을 적고, 배포 보고에 스킬의
   Commit Discipline 항목(파일, dry-run 여부, 적용 여부, 확인 방법, 전략, 호환 근거)을 남긴다.
