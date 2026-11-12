# Cloudflare 한도 (운영 기준)

운영은 Cloudflare **Workers Free**다. 새 기능이 정적 파일·요청·D1 사용을 늘리면
착수 전에 지금 사용량과 남은 양을 확인한다.

```bash
pnpm cf:limits          # 사람이 읽는 표
pnpm cf:limits -- --json
```

dev 서버에서는 같은 내용이 `/dev/admin?tab=cloudflare`(어드민 "CF 한도" 탭)에 나온다.
코드: `scripts/lib/cloudflare-limits.ts`. 인증은 `gh` 로그인과 Wrangler 로그인
(또는 `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`)을 그대로 쓴다. 읽기만 한다.

## 숫자의 출처

| 항목 | 한도 | 출처 |
|---|---|---|
| main·patch Worker 정적 애셋 파일 수 | 버전당 20,000 | 운영 배포 GHA 로그의 wrangler `Success! Uploaded A files (B already uploaded)`, A + B = 업로드 manifest |
| main 정적 애셋 예산 | 19,500 (= 20,000 − 예비 500) | 같은 로그의 `pnpm cf:assets` 출력. 넘으면 빌드 실패 |
| main 정적 애셋 분포 | — | 같은 로그의 `Cloudflare static asset groups` (경로 앞 세 단계별 파일 수) |
| 파일 하나 크기 | 25 MiB | `pnpm cf:assets` 출력의 가장 큰 파일 |
| Worker 코드 gzip | 3 MiB (자체 예산 256 KiB) | `pnpm cf:size` 출력 |
| Worker 요청 | 계정 전체 하루 100,000 | GraphQL `workersInvocationsAdaptive`, 00:00 UTC부터 |
| D1 읽은 행 / 쓴 행 | 하루 5,000,000 / 100,000 | GraphQL `d1AnalyticsAdaptiveGroups`, 00:00 UTC부터 |
| D1 용량 | DB당 500 MB, 계정 5 GB | Cloudflare API `/d1/database` |

- 로그는 `main` 브랜치의 성공한 `cloudflare-workers.yml` 실행을 최신부터 최대 15개
  본다. main을 배포하지 않은 실행(patch만 바뀐 push)은 건너뛴다.
- 로그의 버전 ID를 Cloudflare API의 운영 배포 버전과 맞춰 본다. 다르면 CI 밖 배포나
  롤백이 있었다는 뜻이고, 그때 로그 숫자는 운영과 다를 수 있다.
- wrangler의 `Read N files from the assets directory`는 디렉터리까지 센 수라 한도
  비교에 쓰지 않는다. `cf:assets`의 used는 `_headers`까지 세서 manifest보다 1 크다.
- 일일 한도는 00:00 UTC(09:00 KST)에 초기화된다.

## 추가 1건당 main 정적 파일 비용

정적 파일은 `scripts/copy-cf-static-pages.mjs`가 복사한다. 로케일 접두는 기본 + 13개
게임 로케일 = 14개다.

| 추가하는 것 | 파일 | 근거 |
|---|---|---|
| STS2 백과사전 상세 항목 1개 | 4 + 이미지 | ko·en × HTML·RSC. 게임 전용 로케일은 상세를 복사하지 않는다. STS1 상세는 2026-11-13부터 어느 로케일에도 복사하지 않는다(목록 모달로 308, STS1 전용 워커 전까지) |
| 백과사전 목록(분류) 1개 | 28 | 로케일 14 × HTML·RSC |
| 서비스 라우트 1개 (`/foo`) | 28 | 로케일 14 × HTML·RSC |
| 서비스 상세 shell 1개 (`/foo/__id__`) | 28 | 로케일 14 × HTML·RSC |
| 짜퍼 새 게임 탭 1개 (`/vexing-puzzlebox/foo`) | 28 + 이미지 | 탭이 라우트다(`STATIC_EXACT_SERVICE_PAGES`) |
| 짜퍼 기존 게임에 문항 추가 | 이미지 수 | 페이지는 그대로 |
| `public/` 이미지·JSON 1개 | 1 | `cloudflare-asset-excludes.mjs` 제외 대상과 patch Worker 경로(`/images/neowsletters/`)는 0 |

`/_next/static` chunk 수도 페이지 종류가 늘면 조금 는다. 정확한 값은 로컬
`pnpm cf:build` 뒤 `Cloudflare static assets` 줄로 확인한다.

## 기능을 설계할 때

1. `pnpm cf:limits`로 main 정적 파일의 예산까지 남은 수를 본다.
2. 위 표로 기능이 늘릴 파일 수를 어림한다. 기획 문서에 "추가 N개, 예산까지 M개
   남음"을 적는다.
3. 예산을 넘기면 먼저 줄일 곳을 찾는다: 안 쓰는 asset 제외
   (`cloudflare-asset-excludes.mjs`), 큰 이미지 묶음을 patch Worker로 옮기기
   (`PATCH_WORKER_PUBLIC_PREFIXES`, 니오우스레터 이미지가 선례), 여러 파일을 한
   sprite·JSON으로 합치기. 예산 상향(`CLOUDFLARE_STATIC_ASSET_BUDGET`)은 사용자
   결정이다.
4. Worker 런타임 코드가 늘면 요청 CPU 10 ms, 하위 요청 50개도 같이 본다
   (`docs/DEPLOY.md`).
