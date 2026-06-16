# 배포 매뉴얼

## 1. GitHub 인증 (한 번만)

```bash
gh auth login
```

## 2. GitHub 레포 생성 + 푸시

```bash
gh repo create flavono123/scare-the-spire \
  --public \
  --description "슬서운 이야기 - Slay the Spire balance change history" \
  --source /Users/hansuk.hong/P/scare-the-spire \
  --push \
  --disable-issues \
  --disable-wiki
```

## 3. GitHub 권한 설정

Settings > Actions > General:
- Fork pull request workflows: "Require approval for all outside collaborators"

## 4. Vercel 배포

1. https://vercel.com/new 접속
2. "Import Git Repository" > `flavono123/scare-the-spire` 선택
3. Framework: Next.js (자동 감지)
4. Project Name: `scare-the-spire`
5. "Deploy" 클릭

## 5. 확인

- `https://scare-the-spire.vercel.app/` — 이야기 피드
- `https://scare-the-spire.vercel.app/cards` — 카드 브라우저

## 이미지

- WebP 340w, 총 28MB — git 직접 커밋 (LFS 불필요)
- 프로덕션 이미지는 Vercel Image Optimization을 사용하지 않음
- 이미지 컴포넌트는 `src/components/ui/static-image.tsx`를 기준으로 유지

## 6. Cloudflare Workers 병행 배포

Cloudflare 배포 대상은 Pages가 아니라 Workers + OpenNext다. 이 저장소의
`codex/cloudflare-workers-migration` 브랜치와, 병합 이후의 `main` 브랜치는
push만으로 `.github/workflows/cloudflare-workers.yml`를 통해 Cloudflare Workers에
배포된다. 긴급 재배포나 다른 브랜치 검증은 GitHub Actions의
`Cloudflare Workers` workflow를 `workflow_dispatch`로 수동 실행한다.

### Cloudflare 자격증명

GitHub Actions는 비대화형 환경이라 Wrangler 로그인 대신 다음 값을 읽는다.

- `CLOUDFLARE_ACCOUNT_ID`: 배포할 Cloudflare 계정 ID. GitHub Environment
  `cloudflare-workers`의 secret 또는 variable로 둔다.
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token. 반드시 GitHub secret으로만 둔다.
  Cloudflare dashboard의 Account API tokens에서 custom token을 만들고,
  permission policy는 `Edit Cloudflare Workers`를 선택한다. 계정 scope는
  scare-the-spire를 배포할 계정 하나로 좁힌다.

현재 `wrangler.jsonc`는 custom domain/zone route를 만들지 않고
`workers.dev` route에만 배포하므로 zone 권한은 필요 없다. 나중에
`wrangler.jsonc`로 zone route까지 관리하면 별도 token에 Zone/Workers Routes
권한을 추가한다. 수동 dashboard 연결로 custom domain을 붙이는 경우에는 GitHub
token 권한을 넓히지 않는다.

로컬에서 직접 배포하거나 `$cloudflare`/Wrangler 기반 도구를 쓸 때는
`pnpm exec wrangler login`으로 브라우저 OAuth 로그인을 하거나,
일회성 쉘에 `CLOUDFLARE_ACCOUNT_ID`와 `CLOUDFLARE_API_TOKEN`을 export한다.
토큰 값은 채팅, 문서, 커밋에 남기지 않는다.

공식 근거:

- Cloudflare Workers GitHub Actions: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- Cloudflare API token 생성: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
- workers.dev URL 형식: https://developers.cloudflare.com/workers/configuration/routing/workers-dev/

### GitHub Environment 설정

GitHub repository settings에서 Environment `cloudflare-workers`를 만들고,
interop 기간에는 deployment approval rule을 두지 않는다. 그래야
`codex/cloudflare-workers-migration`에 push하는 것만으로 Vercel처럼 쉽게 배포된다.
필요하면 allowed branches만 `main`과 `codex/cloudflare-workers-migration`으로 제한한다.

필수 secrets 또는 variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `NEXT_PUBLIC_SITE_ORIGIN`: 실제 Workers URL
  (`https://scare-the-spire.<account-subdomain>.workers.dev`)
- `NEXT_PUBLIC_SUPABASE_URL`: production Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: production Supabase anon key
- `NEXT_PUBLIC_SUPABASE_ENV`: `production`

선택 값:

- `NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`: Cloudflare Web Analytics token

`NEXT_PUBLIC_*` 값은 Next build time에도 필요하므로 GitHub Actions 환경에 둔다.
SSR Worker runtime에서도 같은 값을 읽을 수 있게 Cloudflare dashboard의 Worker
Variables에도 같은 값을 넣는다. 단, `CLOUDFLARE_API_TOKEN`은 Worker runtime 변수가
아니며 GitHub secret에만 둔다. `pnpm cf:deploy`와 `pnpm cf:upload`는
`--keep-vars`를 사용하므로 dashboard에 넣은 runtime variables를 지우지 않는다.

### 배포와 확인

```bash
pnpm i18n:validate
pnpm lint
pnpm cf:preview
pnpm exec wrangler deploy --dry-run --outdir /tmp/sts-worker-dry-run
pnpm cf:deploy
```

GitHub Actions는 `pnpm install --frozen-lockfile`, `pnpm i18n:validate`,
`pnpm lint`, `pnpm cf:deploy`를 실행하고, 배포 후
`NEXT_PUBLIC_SITE_ORIGIN/`와 `/generated/search-index.json`을 smoke 확인한다.

Cloudflare Workers Free plan을 유지하는 동안 dry-run의 gzip upload size가
3 MiB를 넘으면 배포를 중단하고 서버 번들 import를 줄인다.

## 7. Vercel과 Cloudflare 전환 계획

### 1단계: 비공개 병행 배포

- Cloudflare Worker를 `workers.dev`에 배포한다.
- Vercel canonical은 그대로 `https://scare-the-spire.vercel.app`에 둔다.
- Cloudflare 주소는 운영자만 확인하고, 댓글/좋아요/케미컬X/역사 강의서 공유런,
  Compendium 인덱스와 상세 페이지, OG metadata를 Vercel과 비교한다.

### 2단계: Vercel 앱에서 새 주소 안내

Vercel 프로젝트 환경변수에 다음을 추가한 뒤 Vercel을 재배포한다.

```text
NEXT_PUBLIC_CLOUDFLARE_SITE_ORIGIN=https://scare-the-spire.<account-subdomain>.workers.dev
NEXT_PUBLIC_SHOW_CLOUDFLARE_MIGRATION_NOTICE=1
NEXT_PUBLIC_SITE_ORIGIN=https://scare-the-spire.vercel.app
```

이렇게 하면 Vercel 앱 상단에 Cloudflare 병행 운영 안내가 표시된다. 링크는 현재
path와 query를 유지해 같은 화면을 Cloudflare 주소에서 열도록 만든다. Cloudflare
배포에는 `NEXT_PUBLIC_SHOW_CLOUDFLARE_MIGRATION_NOTICE`를 설정하지 않는다.

### 3단계: Cloudflare를 canonical origin으로 전환

- Cloudflare GitHub/Worker 변수의 `NEXT_PUBLIC_SITE_ORIGIN`을 Workers URL 또는
  custom domain으로 바꾼다.
- Vercel 앱은 당분간 2단계 안내 배너를 유지한다.
- 3-7일 동안 Cloudflare Metrics에서 Worker invocation, static asset 비율,
  error rate, CPU time을 확인하고 Vercel traffic 감소를 확인한다.

### 4단계: Vercel을 redirect landing으로 축소

- 별도 `vercel-landing` 브랜치를 만든다.
- 루트는 새 Cloudflare 주소를 안내하는 정적 landing으로 두고, deep link는 같은
  path의 Cloudflare URL로 redirect한다.
- 처음 1-2주는 임시 redirect(302/307)로 두고, 검색/공유/OG 문제가 없으면
  영구 redirect(308)로 바꾼다.
- 이 단계의 Vercel 앱은 Supabase, OpenNext, Cloudflare deploy 자격증명이 필요
  없고, `NEXT_PUBLIC_CLOUDFLARE_SITE_ORIGIN`만 있으면 된다.
