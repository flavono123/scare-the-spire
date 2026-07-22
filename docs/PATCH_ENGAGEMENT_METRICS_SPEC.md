# 패치 읽힘·참여자 지표 계획 및 명세

- 상태: 계획 확정, 구현 전
- 대상: 패치 노트 인덱스의 각 패치 항목과 패치 상세 페이지 상단
- 범위 밖: 이 문서 작성만으로 구현, 배포, 데이터베이스 변경을 승인하지 않는다.

## 1. 목적

패치 노트가 실제로 읽히고 이야기로 이어지고 있다는 신호를 서비스 안에 작게 노출한다. 숫자는 순위나 경쟁을 만들기보다, 아직 읽어 보지 않은 방문자에게 콘텐츠의 생동감과 커뮤니티의 존재를 알려 주는 보조 정보다.

한국어 기준 표현은 다음 두 줄로 고정한다.

```text
0.109.0 패치 · 약 1.2천 회 읽힘
등반가 28명이 이야기를 남겼어요
```

영어 표현은 다음과 같다.

```text
Patch 0.109.0 · about 1.2K reads
28 climbers joined the discussion
```

아이콘, 그래프, 툴팁, 링크, 실시간 애니메이션은 넣지 않는다. 텍스트 자체가 최종 정보 단위다.

## 2. 지표의 의미

### 2.1 읽힘

`읽힘`은 Cloudflare Web Analytics 비콘이 수집한 해당 패치 상세 페이지의 비봇 page load 추정치다.

- 소스: GraphQL Analytics API의 `rumPageloadEventsAdaptiveGroups`
- 범위: production host에 설치된 Web Analytics 비콘의 첫 production 이벤트부터 스냅샷 생성 시점까지
- 포함 경로: `/patches/{version}` 및 같은 버전의 모든 지원 언어 경로
- 제외 경로: `/patches`, `/patches/changes`, `/_patches/*`, 정적 자산, preview host
- 필터: `bot = 0`, production `requestHost`, 정확한 `requestPath`
- 쿼리 문자열과 언어 경로가 달라도 같은 패치 버전으로 합산한다.
- 새로 고침, 재방문, 같은 사용자의 반복 열람은 각각 한 번의 읽힘이다. 고유 방문자 수가 아니다.

Cloudflare의 adaptive dataset은 표본 추정치를 반환할 수 있다. 따라서 다음 원칙을 적용한다.

- API가 반환한 `count` 추정치를 사용하고 `sampleInterval`을 다시 곱하지 않는다.
- 긴 기간 하나를 한 번에 조회하지 않고 UTC 일 단위로 조회한 뒤 합산한다.
- 지원되는 경우 95% confidence interval도 스냅샷에 보관한다.
- 공개 숫자는 거친 단위로 반올림하고 항상 `약`을 붙인다.
- JavaScript를 실행하는 자동화, 브라우저의 추적 차단, 네트워크 실패는 완전히 제거하거나 복구할 수 없으므로 정확한 사람 수로 설명하지 않는다.

비콘 설치 전 과거 읽힘은 소급 생성하지 않는다. 첫 production 비콘 이벤트 시각을 `collectionStartedAt`으로 한 번 정하고 이후에도 바꾸지 않는다. Cloudflare가 전체 시작 시점까지 조회할 수 없게 되면 조용히 짧은 기간으로 바꾸지 않고, 공개 문구를 `최근 N일` 기준으로 변경하는 별도 결정이 필요하다.

### 2.2 이야기를 남긴 등반가

`등반가 N명이 이야기를 남겼어요`는 해당 패치 댓글 스레드에 현재 남아 있는 댓글을 쓴 서로 다른 Supabase 사용자 UUID 수다.

- 스레드 키: `buildPatchCommentThreadKey(version)`, 예: `sts2-patch:0.109.0`
- 필터: `comments.env = production`
- 계산: `count(distinct comments.user_id)`
- 한 사람이 여러 댓글을 남겨도 한 명으로 센다.
- 댓글이 실제 삭제되면 더 이상 세지 않는다.
- 좋아요, 반응, 정적 이야기 작성자는 포함하지 않는다.
- 닉네임과 UUID는 정적 결과물에 포함하거나 공개하지 않고 집계 숫자만 남긴다.

이 값은 댓글을 쓴 계정 식별자의 수이지, 전체 방문자나 검증된 실인원 수가 아니다. 따라서 `방문자 N명`으로 표현하지 않는다.

## 3. 노출 위치와 시각 규칙

### 3.1 패치 노트 인덱스

`PatchListPage`의 배포 완료된 각 패치 카드 안에서 제목·종류·날짜 다음, 패치 아트 이전에 표시한다. 인덱스 전체의 합계는 만들지 않는다. 각 카드와 상세 페이지가 같은 버전의 같은 스냅샷을 사용해야 한다.

`watching` 또는 `building` 상태의 항목에는 지표를 표시하지 않는다. 실제 상세 페이지 비콘과 댓글 스레드가 공개된 패치만 대상이다.

### 3.2 패치 상세

`PatchDetailPage`의 제목·종류·날짜·Steam 원문 링크가 있는 헤더 바로 아래, `PatchArtHero` 이전에 표시한다. 본문이나 댓글 영역까지 스크롤하지 않아도 보이되 제목보다 강하게 보이면 안 된다.

### 3.3 Ghost 표현

기존 `Badge`의 `ghost` variant를 재사용하되 상호작용 요소로 만들지 않는다.

- 시맨틱 요소: `span` 또는 읽기 전용 `aside`; 버튼과 링크 금지
- 배치: 두 줄 세로 배치, 왼쪽 정렬
- 크기: `text-xs`, `font-normal`
- 색: `text-muted-foreground/60` 수준
- 배경·테두리·그림자 없음
- 모바일: `whitespace-normal`, `max-w-full`로 긴 영어 문구 줄바꿈 허용
- 클릭 영역, hover 강조, 포커스 링 없음

두 값 모두 없으면 컴포넌트 전체를 렌더링하지 않는다. 읽힘만 있으면 첫 줄만, 참여자가 한 명 이상이면 둘째 줄을 표시한다. `0명이 이야기를 남겼어요`는 표시하지 않는다.

## 4. 숫자 형식

공개 표현은 정확하지 않은 소수점이나 큰 정수를 피한다.

| 값 | 한국어 | 영어 |
| --- | --- | --- |
| `842` | `약 842회` | `about 842` |
| `1,000` | `약 1천 회` | `about 1K` |
| `1,240` | `약 1.2천 회` | `about 1.2K` |
| `12,430` | `약 1.2만 회` | `about 12.4K` |

- 읽힘은 가장 가까운 표시 단위로 반올림한다.
- `1.0천`, `1.0만`, `1.0K`처럼 의미 없는 `.0`은 제거한다.
- 댓글 작성자 수는 정확한 정수로 표시한다.
- 읽힘이 `0`, 음수, `null`, 비정상 값이면 읽힘 문구를 숨긴다.

## 5. 정적 데이터 계약

Worker 요청 시점에 Cloudflare나 Supabase를 호출하지 않는다. 배포 빌드가 한 번 생성한 스냅샷만 React 페이지에 주입하고, 최종 HTML에 숫자를 렌더링한다.

```ts
type PatchEngagementSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  collectionStartedAt: string;
  patches: Record<
    string,
    {
      reads: {
        estimatedCount: number;
        confidenceLower: number | null;
        confidenceUpper: number | null;
        through: string;
      } | null;
      participantCount: number | null;
    }
  >;
};
```

- 레코드 키는 화면용 제목이 아닌 canonical patch `version`이다.
- 스냅샷에는 패치별 집계 결과와 생성 시각만 넣는다.
- Cloudflare API token, Supabase key, UUID, referer, UTM, IP, User-Agent는 넣지 않는다.
- 정적 HTML 외에 공개 JSON endpoint는 v1에서 만들지 않는다.

## 6. 생성 및 주입 방식

### 6.1 빌드 단계 집계

빌드 전용 로더를 두고 한 빌드에서 한 번만 실행한다.

1. `data/sts2-patches.json`에서 공개 완료된 버전과 지원 언어 경로를 만든다.
2. Cloudflare GraphQL API를 일 단위로 조회하고 `requestPath`를 canonical version으로 합친다.
3. Supabase `comments`에서 해당 `sts2-patch:*` 스레드의 `story_id`, `user_id`만 페이지 단위로 읽고 버전별 distinct 수를 계산한다.
4. 스냅샷을 검증한 뒤 `PatchListPage`와 `PatchDetailPage`에 같은 객체를 전달한다.
5. `scripts/build-patch-worker.tsx`가 숫자를 정적 HTML에 포함한다.

현재 댓글 RLS가 public select를 허용하므로 v1에는 migration이나 service-role key가 필요 없다. 데이터가 커져 빌드 시 전체 패치 댓글 행 조회가 부담이 될 때만 `count(distinct user_id)` 집계 RPC를 별도 migration으로 검토한다.

### 6.2 자격 증명

- `CLOUDFLARE_ACCOUNT_ID`: 기존 production job 환경값 사용
- `CLOUDFLARE_API_TOKEN`: Analytics Read 권한이 포함된 CI secret 사용
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ENV`: 기존 production build 환경값 사용

Web Analytics의 공개 beacon token은 수집 사이트 식별자일 뿐 이 집계 API의 자격 증명으로 사용하지 않는다. GraphQL API token은 클라이언트 번들이나 정적 결과물에 절대 포함하지 않는다.

### 6.3 갱신과 실패

v1은 patch Worker 배포 시점에만 스냅샷을 새로 만든다. 실시간 숫자가 아니며 다음 배포 전까지 유지된다. 별도의 매일 배포는 초기 구현 범위에서 제외한다.

두 데이터 소스는 서로 독립적으로 실패할 수 있다.

- Cloudflare 조회 실패: 해당 패치의 읽힘 문구만 생략
- Supabase 조회 실패: 해당 패치의 참여자 문구만 생략
- 둘 다 실패: ghost 블록 전체 생략
- 선택적인 인기 지표 때문에 패치 공개 자체를 실패시키지 않는다.
- 공개 UI에 spinner, 오류 문구, 임시 `0`을 표시하지 않는다.
- 실패는 CI 경고와 실패한 source 이름으로 남기되 token이나 응답 원문은 출력하지 않는다.

## 7. 예상 구현 범위

후속 구현은 다음 단위로 진행한다.

1. 빌드 전용 Cloudflare/Supabase 집계 로더와 스냅샷 검증기
2. 읽힘·참여자 숫자 formatter와 한국어/영어 typed copy
3. 비상호작용 `PatchEngagementSummary` ghost 컴포넌트
4. `PatchListPage`, `PatchDetailPage`, `build-patch-worker.tsx` 데이터 주입
5. deterministic fixture를 이용한 formatter·경로 병합·distinct 집계 테스트
6. patch Worker 정적 HTML 및 모바일 시각 확인

새 Cloudflare 저장소, 요청 시점 subrequest, visitor cookie, Supabase auth 호출은 추가하지 않는다. 이 구조는 Patch Worker의 asset-first 원칙과 Workers Free의 10 ms CPU 제한에 새로운 요청 비용을 만들지 않는다.

## 8. 검증 기준

구현 완료 조건은 다음과 같다.

- 인덱스의 공개 완료 패치 카드와 같은 버전의 상세 페이지가 같은 두 숫자를 표시한다.
- 모든 지원 언어 경로의 page load가 한 canonical version에 합산된다.
- `/patches`, `/_patches/*`, 정적 자산, `bot = 1` 이벤트가 버전 읽힘에 섞이지 않는다.
- 참여자 수는 production 댓글의 distinct `user_id`와 일치한다.
- 누락 또는 실패한 값은 `0`으로 위장하지 않고 해당 문구만 숨긴다.
- 한국어와 영어의 큰 수 형식 및 단수/복수 표현이 테스트된다.
- 생성된 patch HTML에 숫자가 포함되고 페이지 로드 후 layout shift가 없다.
- `pnpm patch:build`와 `pnpm patch:test`를 통과한다.
- `/patches/{latest}`와 `/en/patches/{latest}`를 모바일 폭에서 확인한다.
- Worker 요청 경로에는 새 fetch, Supabase query, analytics query가 없다.

## 9. 명시적 비목표

- 전체 사이트 방문자 수 또는 온라인 사용자 수
- Supabase 익명 UUID를 이용한 방문 이력 추적
- 사람 한 명을 여러 브라우저에서 동일인으로 식별
- IP, referer, UTM, User-Agent의 공개 또는 저장
- 패치 인기 순 정렬, 랭킹, 배지 보상
- 실시간 카운터와 WebSocket/SSE 갱신
- 읽힘 수를 SEO 메타데이터나 Open Graph 문구에 포함

## 10. 참고 자료

- [Cloudflare Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/)
- [Cloudflare Analytics GraphQL sampling](https://developers.cloudflare.com/analytics/graphql-api/sampling/)
- [Cloudflare Analytics confidence intervals](https://developers.cloudflare.com/analytics/graphql-api/features/confidence-intervals/)
- [Patch Worker deploy contract](./PATCH_WORKER_DEPLOY_CONTRACT.md)
