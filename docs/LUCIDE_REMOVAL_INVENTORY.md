# Lucide Removal Inventory

## Status

2026-07-22 기준 `lucide-react`는 21개 파일에서 26종의 아이콘을 54회
import한다. 모든 사용처는 repository-local SVG 컴포넌트로 바꿀 수 있으며,
공개 기능을 삭제할 필요는 없다.

다만 이 작업은 [Cloudflare Worker Bundle Size Reduction
Plan](./CLOUDFLARE_WORKER_SIZE_PLAN.md)의 주 해결책이 아니다. 현재 Turbopack
artifact를 소스맵으로 나눈 추정치에서 Lucide 코드는 약 29 KiB raw, 약 2.8
KiB synthetic gzip이다. Webpack은 사용 아이콘을 더 잘 deduplicate하므로 실제
upload 절감량은 이보다 작을 수도 있다. 제거 목적은 외부 아이콘 의존성 축소,
시각 언어 통제, 이후 아이콘 변경의 예측 가능성 확보에 둔다.

## Current Lucide Usage

| 영역 | 파일 | 아이콘 |
| --- | --- | --- |
| 공통 이야기 | `src/components/story-feed.tsx` | `Search`, `Trash2`, `X` |
| 공통 이야기 | `src/components/story-composer-modal.tsx` | `AlertCircle`, `CheckCircle2`, `Search`, `X` |
| 패치 | `src/components/patches/resource-patch-index-explorer.tsx` | `Search` |
| 패치 | `src/components/patches/patch-note-with-story-actions.tsx` | `X` |
| This or That | `src/components/this-or-that/post-card.tsx` | `Check`, `Link2`, `MessageCircle`, `Trash2` |
| This or That | `src/components/this-or-that/composer-modal.tsx` | `X` |
| This or That | `src/components/this-or-that/post-view.tsx` | `ArrowLeft` |
| This or That | `src/components/this-or-that/resource-picker.tsx` | `X` |
| Combo | `src/components/combo/combo-post-view.tsx` | `ArrowLeft`, `Link2` |
| Combo | `src/components/combo/combo-post-card.tsx` | `Trash2` |
| Combo | `src/components/combo/combo-resource-picker.tsx` | `Check`, `Plus`, `Search`, `X` |
| Chemical X | `src/components/chemicalx/post-card.tsx` | `Trash2`, `ExternalLink` |
| Chemical X | `src/components/chemicalx/chemicalx-client.tsx` | `Eye`, `EyeOff` |
| Chemical X | `src/components/chemicalx/post-view.tsx` | `ArrowLeft`, `Link2`, `Eye`, `EyeOff` |
| 프로필 | `src/components/profile-activity.tsx` | `ChevronRight`, `LoaderCircle` |
| History Course | `src/components/history-course/run-upload-zone.tsx` | `AlertCircle`, `FolderUp`, `RefreshCw`, `Upload` |
| History Course | `src/components/history-course/upload-tutorial.tsx` | `Apple`, `Check`, `Copy`, `Terminal` |
| History Course | `src/components/history-course/donation-panel.tsx` | `Check`, `Copy`, `Share2`, `Undo2` |
| History Course | `src/components/history-course/run-card.tsx` | `Share2`, `Trash2`, `Undo2` |
| History Course | `src/components/history-course/random-pick-card.tsx` | `Shuffle` |
| History Course | `src/components/history-course/prod-runs-dev-section.tsx` | `ExternalLink`, `Loader2`, `Play`, `RefreshCw`, `Search` |

### Unique icon counts

| 아이콘 | 사용 횟수 | 주 역할 |
| --- | ---: | --- |
| `X` | 6 | modal 닫기, 선택 제거 |
| `Search` | 5 | 검색 입력과 탐색 |
| `Trash2` | 5 | 게시물/run 삭제 |
| `Check` | 4 | 선택·완료 확인 |
| `ArrowLeft` | 3 | 상세에서 뒤로 이동 |
| `Link2` | 3 | 링크 복사·표시 |
| `AlertCircle` | 2 | 업로드·작성 경고 |
| `Copy` | 2 | 클립보드 복사 |
| `ExternalLink` | 2 | 외부 링크 |
| `Eye` | 2 | 공개/표시 상태 |
| `EyeOff` | 2 | 비공개/숨김 상태 |
| `RefreshCw` | 2 | 새로고침·재시도 |
| `Share2` | 2 | 공유 |
| `Undo2` | 2 | 되돌리기 |
| `Apple`, `CheckCircle2`, `ChevronRight`, `FolderUp` | 각 1 | 플랫폼·상태·탐색·폴더 업로드 |
| `Loader2`, `LoaderCircle`, `MessageCircle`, `Play` | 각 1 | 로딩·댓글·실행 |
| `Plus`, `Shuffle`, `Terminal`, `Upload` | 각 1 | 추가·랜덤·CLI·업로드 |

`upload-tutorial.tsx`의 Windows 네 칸 표시는 이미 Lucide가 아닌 로컬 inline
SVG다. 로컬 아이콘의 크기, 색상, 접근성 API를 정할 때 참고할 수 있다.

## Replacement Design

### 원칙

- `src/components/ui/icons/` 아래에 repository-owned SVG 컴포넌트를 둔다.
- 공통 `IconProps`는 `className`, `size`, `strokeWidth`, `aria-hidden` 전달을
  지원하고 색상은 `currentColor`를 사용한다.
- 문자열 이름으로 모든 path를 조회하는 runtime registry는 만들지 않는다.
  파일별 named export 또는 작은 의미 그룹을 사용해 사용하지 않는 아이콘이
  client chunk에 따라오지 않게 한다.
- 장식 아이콘은 `aria-hidden="true"`와 `focusable="false"`를 기본값으로 한다.
  아이콘만 있는 버튼은 기존 `aria-label` 또는 화면 밖 label을 반드시
  유지한다.
- `Loader2`와 `LoaderCircle`의 `animate-spin`, stroke 두께, viewBox, 정렬 기준을
  보존한다.
- Lucide의 SVG geometry를 복사해 시각을 그대로 유지한다면 Lucide의 ISC
  license 고지를 저장소에 유지한다. Lucide 디자인까지 완전히 제거하려면
  자체 geometry로 교체하고 시각 QA 범위를 별도로 잡는다.

### 권장 순서

1. 가장 많이 쓰이는 `X`, `Search`, `Trash2`, `Check`와 공통 `IconProps`를 먼저
   만든다.
2. 탐색·상태 아이콘인 `ArrowLeft`, `ChevronRight`, `ExternalLink`, `Eye`,
   `EyeOff`, `Link2`, `MessageCircle`을 옮긴다.
3. History Course 전용 아이콘과 loader animation을 옮긴다.
4. `rg 'lucide-react' src` 결과가 0인지 확인한다.
5. `package.json`과 lockfile에서 `lucide-react`를 제거한다.
6. build와 모바일/키보드 QA가 통과한 뒤 실제 Worker gzip 차이를 기록한다.

아이콘 집합 생성, 영역별 교체, dependency 제거는 각각 독립적인 speculative
commit으로 나눈다. 중간 커밋에서도 build 가능한 상태를 유지한다.

## Verification Gates

- icon-only button의 접근 가능한 이름이 교체 전과 같다.
- hover, disabled, destructive, selected 색상이 `currentColor`를 통해 유지된다.
- 320 px와 375 px viewport에서 버튼 크기와 텍스트 정렬이 달라지지 않는다.
- modal close, 삭제, 공유, 복사, 공개/비공개 toggle, 업로드, 검색이 모두
  keyboard와 pointer로 동작한다.
- loader가 `prefers-reduced-motion`을 포함한 기존 CSS 정책을 따른다.
- `pnpm lint`, 관련 테스트, `pnpm cf:build`, `pnpm cf:size`가 통과한다.
- 제거 전후 gzip 크기는 동일 커밋과 동일 생성 데이터로 비교한다.

## What Radix Is in This Repository

Radix Primitives는 스타일을 제공하는 디자인 시스템이 아니라, ARIA 역할,
focus 관리, keyboard navigation, controlled/uncontrolled state 같은 동작을
제공하는 unstyled low-level UI primitive다.

shadcn/ui는 npm에서 완성 컴포넌트를 숨겨 제공하는 전통적인 라이브러리가
아니라, 프로젝트 안으로 수정 가능한 컴포넌트 코드를 배포하는 방식이다.
shadcn 컴포넌트는 Radix 또는 Base UI 같은 primitive 위에 스타일과 API를
얹을 수 있다. 따라서 **Radix가 shadcn 자체이거나 모든 shadcn 컴포넌트의
고정 기본값인 것은 아니다.** 2026년 shadcn은 Radix와 Base UI 구현을 모두
지원한다. 이 저장소의 로컬 UI 컴포넌트는 그중 unified `radix-ui` 패키지를
사용하는 Radix 구현이다.

현재 직접 사용처는 다음 4개뿐이다.

| 파일 | Radix primitive | 유지하는 동작 |
| --- | --- | --- |
| `src/components/ui/badge.tsx` | `Slot` | `asChild` 합성과 prop/ref 전달 |
| `src/components/ui/tabs.tsx` | `Tabs` | tab 상태, ARIA, keyboard/focus 이동 |
| `src/components/ui/toggle.tsx` | `Toggle` | pressed 상태와 접근성 semantics |
| `src/components/ui/toggle-group.tsx` | `ToggleGroup` | 단일/다중 선택, roving focus, keyboard 이동 |

소스맵 기준 Radix의 현재 Worker 기여 추정치는 약 8.2 KiB raw, 약 1.1 KiB
synthetic gzip이다. 제거해도 3 MiB 문제에는 거의 영향이 없다. 특히 tabs와
toggle group을 직접 다시 쓰면 절감량보다 접근성 회귀 위험이 크므로 Lucide
제거와 묶지 않는다. Radix까지 없애려면 먼저 네 wrapper별 keyboard, focus,
ARIA, controlled state 계약을 테스트로 고정한 뒤 별도 계획으로 진행한다.

## References

- [shadcn/ui introduction](https://ui.shadcn.com/docs)
- [shadcn/ui Base UI and Radix variants](https://ui.shadcn.com/docs/changelog/2026-01-base-ui)
- [shadcn/ui unified Radix package](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui)
- [Radix Primitives introduction](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [Radix accessibility overview](https://www.radix-ui.com/primitives/docs/overview/accessibility)
